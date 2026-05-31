// app/api/pet/teacher-xp/route.ts
// Grants XP to a teacher's pet via SECURITY DEFINER RPC (bypasses RLS).
// Actions: 'grade' (+5 XP), 'create_challenge' (+10 XP)

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const XP_BY_ACTION: Record<string, number> = {
  grade:            5,
  create_challenge: 10,
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ ok: false, error: 'no session' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body?.action ?? 'grade'
    const xpGained = XP_BY_ACTION[action] ?? 5

    // Use SECURITY DEFINER RPC — bypasses RLS for teachers/admins
    const { data, error } = await supabase.rpc('grant_pet_xp', {
      p_xp_gained:       xpGained,
      p_happiness_boost: 5,
      p_hunger_boost:    5,
    })

    if (error) {
      console.error('[pet/teacher-xp] RPC error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error('[pet/teacher-xp] error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 })
  }
}
