// app/api/pet/challenge-xp/route.ts
// Called when a student submits a challenge answer for the FIRST time.
// Grants +10 XP to the pet and +10 points to the wallet.
// Idempotent: one challenge = one XP grant, resubmissions are ignored.
// Fire-and-forget from the client — always returns 200.

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

    // Parse challenge_id from body — required for deduplication
    const body = await request.json().catch(() => ({}))
    const challengeId: string | undefined = body?.challenge_id

    // If challenge_id provided, check if this user already has a submission
    // (i.e. this is a resubmission — don't grant XP again)
    if (challengeId) {
      const { count } = await supabase
        .from('challenge_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('challenge_id', challengeId)
        .eq('user_id', userId)

      // count > 1 means there was already a prior submission before this one
      // (the current submission was just inserted, so count === 1 is the first time)
      if ((count ?? 0) > 1) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'resubmission' }, { status: 200 })
      }
    }

    // Fetch current pet state
    const { data: pet, error: fetchError } = await supabase
      .from('student_pets')
      .select('xp, species, evolution_stage, happiness, hunger')
      .eq('user_id', userId)
      .single()

    if (fetchError && fetchError.code === 'PGRST116') {
      // No pet row yet — create one
      await supabase
        .from('student_pets')
        .insert({ user_id: userId, xp: 0, evolution_stage: 'egg', species: null })
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    if (!pet) {
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const newXp = (pet.xp ?? 0) + CHALLENGE_XP

    // Recompute stage (only if species is set — egg stays egg)
    const newStage = !pet.species ? pet.evolution_stage : (
      newXp >= 300 ? 'adult' :
      newXp >= 100 ? 'teen' : 'baby'
    )

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      xp: newXp,
      evolution_stage: newStage,
      updated_at: new Date().toISOString(),
    }

    if (pet.happiness != null || pet.hunger != null) {
      updatePayload.happiness = Math.min((pet.happiness ?? 80) + 5, 100)
      updatePayload.hunger    = Math.min((pet.hunger    ?? 80) + 5, 100)
    }

    const { error: updateError } = await supabase
      .from('student_pets')
      .update(updatePayload)
      .eq('user_id', userId)

    if (updateError) {
      console.error('[pet/challenge-xp] update error:', updateError)
      // Fallback without happiness/hunger
      await supabase
        .from('student_pets')
        .update({ xp: newXp, evolution_stage: newStage, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
    }

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
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}
