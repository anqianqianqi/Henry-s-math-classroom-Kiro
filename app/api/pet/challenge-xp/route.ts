// app/api/pet/challenge-xp/route.ts
// Grants +10 XP to a student's pet on first challenge submission.
// Resubmissions are ignored (checked via challenge_id).

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
    const body = await request.json().catch(() => ({}))
    const challengeId: string | undefined = body?.challenge_id

    // Deduplication: skip if resubmission
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

    // Fetch current pet
    const { data: pet, error: fetchError } = await supabase
      .from('student_pets')
      .select('xp, species, evolution_stage, happiness, hunger')
      .eq('user_id', userId)
      .single()

    if (fetchError && fetchError.code === 'PGRST116') {
      await supabase
        .from('student_pets')
        .insert({ user_id: userId, xp: CHALLENGE_XP, evolution_stage: 'egg', species: null })
      return NextResponse.json({ ok: true, xp_gained: CHALLENGE_XP, new_xp: CHALLENGE_XP }, { status: 200 })
    }

    if (!pet) return NextResponse.json({ ok: true }, { status: 200 })

    const newXp = (pet.xp ?? 0) + CHALLENGE_XP
    const newStage = !pet.species ? pet.evolution_stage : (
      newXp >= 300 ? 'adult' : newXp >= 100 ? 'teen' : 'baby'
    )
    const newHappiness = Math.min((pet.happiness ?? 80) + 5, 100)
    const newHunger    = Math.min((pet.hunger    ?? 80) + 5, 100)

    await supabase
      .from('student_pets')
      .update({
        xp:              newXp,
        evolution_stage: newStage,
        happiness:       newHappiness,
        hunger:          newHunger,
        updated_at:      new Date().toISOString(),
      })
      .eq('user_id', userId)

    // Grant 10 points to wallet
    const { data: wallet } = await supabase
      .from('student_wallets')
      .select('total_earned, spendable_balance')
      .eq('user_id', userId)
      .single()

    if (wallet) {
      await supabase
        .from('student_wallets')
        .update({
          total_earned:      (wallet.total_earned ?? 0) + CHALLENGE_XP,
          spendable_balance: (wallet.spendable_balance ?? 0) + CHALLENGE_XP,
        })
        .eq('user_id', userId)
    }

    return NextResponse.json({ ok: true, xp_gained: CHALLENGE_XP, new_xp: newXp, new_stage: newStage }, { status: 200 })
  } catch (err) {
    console.error('[pet/challenge-xp] error:', err)
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}
