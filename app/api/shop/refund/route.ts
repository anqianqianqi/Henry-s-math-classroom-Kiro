// app/api/shop/refund/route.ts
// Teacher-only: refund a redemption.
// Deletes the redemption row and restores points to student wallet.
// Requires teacher or administrator role.

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { redemption_id } = await request.json()
    if (!redemption_id) {
      return NextResponse.json({ error: 'redemption_id is required' }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify teacher/admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', session.user.id)
      .is('class_id', null)

    const isTeacher = (roles as any[])?.some((r: any) =>
      r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
    )
    if (!isTeacher) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Use service role client to bypass RLS on wallet update
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Read redemption before deleting
    const { data: redemption, error: readErr } = await admin
      .from('redemptions')
      .select('user_id, points_spent')
      .eq('id', redemption_id)
      .single()

    if (readErr || !redemption) {
      return NextResponse.json({ error: 'Redemption not found' }, { status: 404 })
    }

    // Mark as refunded (soft delete) instead of hard delete
    const { error: updateErr } = await admin
      .from('redemptions')
      .update({
        refunded_at: new Date().toISOString(),
        refunded_by: session.user.id,
        points_spent: 0,  // zero out so wallet recalculations exclude it
      })
      .eq('id', redemption_id)

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to refund: ' + updateErr.message }, { status: 500 })
    }

    // Restore wallet — read current values then update
    const { data: wallet } = await admin
      .from('student_wallets')
      .select('total_spent, spendable_balance')
      .eq('user_id', redemption.user_id)
      .single()

    if (wallet) {
      await admin
        .from('student_wallets')
        .update({
          total_spent: Math.max(0, wallet.total_spent - redemption.points_spent),
          spendable_balance: wallet.spendable_balance + redemption.points_spent,
        })
        .eq('user_id', redemption.user_id)
    }

    return NextResponse.json({ success: true, points_refunded: redemption.points_spent })
  } catch (err) {
    console.error('[shop/refund] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
