// app/api/admin/create-user/route.ts
// Admin-only endpoint to create a new user with email + password.
// Uses the service role key — never exposed to the browser.
// The created account is immediately active (email_confirm: true).

import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // ── Auth guard: caller must be an administrator ──────────────────────────
    const supabaseUser = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabaseUser.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check caller has administrator role
    const { data: roleCheck } = await supabaseUser
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', session.user.id)
      .is('class_id', null)

    const isAdmin = (roleCheck ?? []).some(
      (r: any) => r.roles?.name === 'administrator'
    )

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden — administrators only' }, { status: 403 })
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await request.json()
    const { email, password, firstName, lastName, nickname, role, classId } = body

    if (!email?.trim() || !password || !firstName?.trim()) {
      return NextResponse.json({ error: 'email, password and firstName are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // ── Create user via Admin API ─────────────────────────────────────────────
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName.trim(),
        last_name: (lastName ?? '').trim(),
        nickname: nickname?.trim() || null,
      },
    })

    if (createError) {
      if (createError.message?.toLowerCase().includes('already')) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
      }
      console.error('[admin/create-user] createUser error:', createError)
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    const newUserId = authData.user.id

    // ── Upsert profile row ────────────────────────────────────────────────────
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUserId,
        first_name: firstName.trim(),
        last_name: (lastName ?? '').trim(),
        nickname: nickname?.trim() || null,
        email: email.trim(),
      }, { onConflict: 'id' })

    if (profileErr) {
      console.error('[admin/create-user] profile upsert error:', profileErr)
      // Non-fatal — user was created, profile trigger may have run
    }

    // ── Optionally assign a role ──────────────────────────────────────────────
    if (role && ['student', 'teacher', 'administrator'].includes(role)) {
      const { data: roleRow } = await supabaseAdmin
        .from('roles')
        .select('id')
        .eq('name', role)
        .single()

      if (roleRow) {
        await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: newUserId, role_id: roleRow.id, class_id: null })
      }
    }

    // ── Optionally enroll in a class ─────────────────────────────────────────
    if (classId) {
      const { error: memberErr } = await supabaseAdmin
        .from('class_members')
        .insert({ class_id: classId, user_id: newUserId })

      if (memberErr && !memberErr.message?.includes('duplicate')) {
        console.error('[admin/create-user] class_members insert error:', memberErr)
      }
    }

    return NextResponse.json({
      ok: true,
      userId: newUserId,
      email: email.trim(),
      fullName: `${firstName.trim()} ${(lastName ?? '').trim()}`.trim(),
    })
  } catch (err) {
    console.error('[admin/create-user] unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
