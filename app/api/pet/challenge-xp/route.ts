// app/api/pet/challenge-xp/route.ts
// Called when a student submits a challenge answer for the first time.
// Grants +10 XP to the pet and +10 points to the wallet.
// Fire-and-forget from the client — always returns 200.

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CHALLENGE_XP = 10

export async function POST() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const userId = session.user.id

    // Ensure pet row exists (upsert with no-op on conflict)
    const { data: existingPet } = await supabase
      .from('student_pets')
      .select('xp, species, evolution_stage, happiness, hunger')
      .eq('user_id', userId)
      .single()

    if (!existingPet) {
      await supabase
        .from('student_pets')
        .insert({ user_id: userId, xp: 0, evolution_stage: 'egg' })
    }

    // Fetch current pet state
    const { data: pet } = await supabase
      .from('student_pets')
      .select('xp, species, evolution_stage, happiness, hunger')
      .eq('user_id', userId)
      .single()

    if (!pet) {
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const newXp = (pet.xp ?? 0) + CHALLENGE_XP

    // Recompute stage (only if species is set — egg stays egg)
    const newStage = !pet.species ? pet.evolution_stage : (
      newXp >= 300 ? 'adult' :
      newXp >= 100 ? 'teen' : 'baby'
    )

    // Update pet XP, stage, happiness, hunger
    await supabase
      .from('student_pets')
      .update({
        xp: newXp,
        evolution_stage: newStage,
        happiness: Math.min((pet.happiness ?? 80) + 5, 100),
        hunger: Math.min((pet.hunger ?? 80) + 5, 100),
        updated_at: new Date().toISOString(),
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
          total_earned: (wallet.total_earned ?? 0) + CHALLENGE_XP,
          spendable_balance: (wallet.spendable_balance ?? 0) + CHALLENGE_XP,
        })
        .eq('user_id', userId)
    }

    return NextResponse.json({
      ok: true,
      xp_gained: CHALLENGE_XP,
      new_xp: newXp,
      new_stage: newStage,
    }, { status: 200 })

  } catch (err) {
    console.error('[pet/challenge-xp] error:', err)
    return NextResponse.json({ ok: true }, { status: 200 }) // always 200 — fire-and-forget
  }
}
