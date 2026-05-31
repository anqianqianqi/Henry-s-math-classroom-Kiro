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

    // Ensure pet row exists
    const { data: existingPet } = await supabase
      .from('student_pets')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (!existingPet) {
      await supabase
        .from('student_pets')
        .insert({ user_id: userId, xp: 0, evolution_stage: 'egg' })
    }

    // Fetch current pet
    const { data: pet } = await supabase
      .from('student_pets')
      .select('xp, species, evolution_stage')
      .eq('user_id', userId)
      .single()

    if (!pet) return NextResponse.json({ ok: true }, { status: 200 })

    const newXp = (pet.xp ?? 0) + xpGained
    const newStage = !pet.species ? pet.evolution_stage : (
      newXp >= 300 ? 'adult' :
      newXp >= 100 ? 'teen' : 'baby'
    )

    await supabase
      .from('student_pets')
      .update({ xp: newXp, evolution_stage: newStage, updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    return NextResponse.json({ ok: true, xp_gained: xpGained, new_xp: newXp, new_stage: newStage }, { status: 200 })
  } catch (err) {
    console.error('[pet/teacher-xp] error:', err)
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}
