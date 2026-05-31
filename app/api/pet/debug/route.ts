// app/api/pet/debug/route.ts
// Debug endpoint — tests pet XP update directly
// Visit: /api/pet/debug

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ step: 'auth', error: 'no session', sessionError }, { status: 401 })
    }

    const userId = session.user.id
    const email = session.user.email

    // 1. Fetch current pet
    const { data: pet, error: fetchError } = await supabase
      .from('student_pets')
      .select('id, xp, species, evolution_stage, happiness, hunger, updated_at')
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      return NextResponse.json({ step: 'fetch', userId, email, fetchError }, { status: 200 })
    }

    // 2. Try the exact same update as teacher-xp
    const newXp = (pet?.xp ?? 0) + 10
    const newHappiness = Math.min((pet?.happiness ?? 80) + 5, 100)
    const newHunger = Math.min((pet?.hunger ?? 80) + 5, 100)

    const { data: updateData, error: updateError } = await supabase
      .from('student_pets')
      .update({
        xp: newXp,
        evolution_stage: pet?.species ? (newXp >= 300 ? 'adult' : newXp >= 100 ? 'teen' : 'baby') : pet?.evolution_stage,
        happiness: newHappiness,
        hunger: newHunger,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select('xp, happiness, hunger, evolution_stage, updated_at')

    // 3. Re-fetch to confirm
    const { data: afterPet } = await supabase
      .from('student_pets')
      .select('xp, happiness, hunger, evolution_stage')
      .eq('user_id', userId)
      .single()

    return NextResponse.json({
      userId,
      email,
      before: { xp: pet?.xp, happiness: pet?.happiness, hunger: pet?.hunger, stage: pet?.evolution_stage },
      updateAttempt: { newXp, newHappiness, newHunger, updateData, updateError },
      after: afterPet,
      verdict: updateError
        ? `❌ UPDATE FAILED: ${updateError.message}`
        : afterPet?.xp === newXp
          ? '✅ UPDATE WORKED'
          : `⚠️ XP did not change (before: ${pet?.xp}, expected: ${newXp}, got: ${afterPet?.xp})`,
    })
  } catch (err) {
    return NextResponse.json({ step: 'exception', error: String(err) }, { status: 500 })
  }
}
