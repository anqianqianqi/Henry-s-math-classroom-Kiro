// app/api/pet/teacher-xp/route.ts
// Grants XP to a teacher's pet for teaching actions.
// Actions: 'grade' (+5 XP), 'create_challenge' (+10 XP)
// Fire-and-forget — always returns 200.

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
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body?.action ?? 'grade'
    const xpGained = XP_BY_ACTION[action] ?? 5
    const userId = session.user.id

    // Fetch current pet state (single query — same pattern as challenge-xp)
    const { data: pet, error: fetchError } = await supabase
      .from('student_pets')
      .select('xp, species, evolution_stage, happiness, hunger')
      .eq('user_id', userId)
      .single()

    if (fetchError && fetchError.code === 'PGRST116') {
      // No pet row — create one first
      await supabase
        .from('student_pets')
        .insert({ user_id: userId, xp: 0, evolution_stage: 'egg', species: null })
      // Return early — egg stage, no XP to grant yet
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    if (!pet) {
      console.error('[pet/teacher-xp] could not fetch pet:', fetchError)
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const newXp = (pet.xp ?? 0) + xpGained

    // Recompute stage (only if species is set — egg stays egg)
    const newStage = !pet.species ? pet.evolution_stage : (
      newXp >= 300 ? 'adult' :
      newXp >= 100 ? 'teen' : 'baby'
    )

    // Build update — try with happiness/hunger first, fall back without if columns missing
    const updatePayload: Record<string, unknown> = {
      xp: newXp,
      evolution_stage: newStage,
      updated_at: new Date().toISOString(),
    }

    // Only include happiness/hunger if they came back from the fetch (columns exist)
    if (pet.happiness != null || pet.hunger != null) {
      updatePayload.happiness = Math.min((pet.happiness ?? 80) + 5, 100)
      updatePayload.hunger    = Math.min((pet.hunger    ?? 80) + 5, 100)
    }

    const { error: updateError } = await supabase
      .from('student_pets')
      .update(updatePayload)
      .eq('user_id', userId)

    if (updateError) {
      console.error('[pet/teacher-xp] update error:', updateError)
      // Try again without happiness/hunger in case columns don't exist
      await supabase
        .from('student_pets')
        .update({ xp: newXp, evolution_stage: newStage, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
    }

    return NextResponse.json({ ok: true, xp_gained: xpGained, new_xp: newXp, new_stage: newStage }, { status: 200 })
  } catch (err) {
    console.error('[pet/teacher-xp] error:', err)
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}
