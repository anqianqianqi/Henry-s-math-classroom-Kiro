// app/api/pet/teacher-xp/route.ts
// Grants XP to a teacher's pet for teaching actions.
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
    const userId = session.user.id

    // Fetch current pet state
    const { data: pet, error: fetchError } = await supabase
      .from('student_pets')
      .select('xp, species, evolution_stage, happiness, hunger')
      .eq('user_id', userId)
      .single()

    if (fetchError && fetchError.code === 'PGRST116') {
      // No row — create one with the XP already applied
      await supabase
        .from('student_pets')
        .insert({ user_id: userId, xp: xpGained, evolution_stage: 'egg', species: null })
      return NextResponse.json({ ok: true, xp_gained: xpGained, new_xp: xpGained }, { status: 200 })
    }

    if (!pet) {
      return NextResponse.json({ ok: false, error: String(fetchError) }, { status: 200 })
    }

    const newXp = (pet.xp ?? 0) + xpGained
    const newStage = !pet.species ? pet.evolution_stage : (
      newXp >= 300 ? 'adult' : newXp >= 100 ? 'teen' : 'baby'
    )
    const newHappiness = Math.min((pet.happiness ?? 80) + 5, 100)
    const newHunger    = Math.min((pet.hunger    ?? 80) + 5, 100)

    const { error: updateError } = await supabase
      .from('student_pets')
      .update({
        xp:              newXp,
        evolution_stage: newStage,
        happiness:       newHappiness,
        hunger:          newHunger,
        updated_at:      new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('[pet/teacher-xp] update error:', updateError)
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 200 })
    }

    return NextResponse.json({
      ok: true, xp_gained: xpGained, new_xp: newXp, new_stage: newStage,
      new_happiness: newHappiness, new_hunger: newHunger,
    }, { status: 200 })
  } catch (err) {
    console.error('[pet/teacher-xp] error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 })
  }
}
