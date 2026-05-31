// app/api/pet/challenge-xp/route.ts
// Grants +10 XP to a student's pet via SECURITY DEFINER RPC (bypasses RLS).
// Idempotent: one challenge = one XP grant, resubmissions are ignored.

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CHALLENGE_XP = 10

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const userId = session.user.id

    // Parse challenge_id for deduplication
    const body = await request.json().catch(() => ({}))
    const challengeId: string | undefined = body?.challenge_id

    // If challenge_id provided, check for resubmission
    if (challengeId) {
      const { count } = await supabase
        .from('challenge_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('challenge_id', challengeId)
        .eq('user_id', userId)

      if ((count ?? 0) > 1) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'resubmission' }, { status: 200 })
      }
    }

    // Use SECURITY DEFINER RPC — bypasses RLS
    const { data, error } = await supabase.rpc('grant_pet_xp', {
      p_xp_gained:       CHALLENGE_XP,
      p_happiness_boost: 5,
      p_hunger_boost:    5,
    })

    if (error) {
      console.error('[pet/challenge-xp] RPC error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    }

    // Also grant 10 points to wallet
    const { data: wallet } = await supabase
      .from('student_wallets')
      .select('total_earned, spendable_balance')
      .eq('user_id', userId)
      .single()

    if (wallet) {
      await supabase
        .from('student_wallets')
        .update({
          total_earned: (wallet.total_earned ?? 0) + CHALLENGE_XP,
          spendable_balance: (wallet.spendable_balance ?? 0) + CHALLENGE_XP,
        })
        .eq('user_id', userId)
    }

    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error('[pet/challenge-xp] error:', err)
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}
