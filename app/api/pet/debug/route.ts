// app/api/pet/debug/route.ts
// Debug endpoint — shows pet state and tests a direct XP update
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

    // 2. Try updating XP by +1
    const newXp = (pet?.xp ?? 0) + 1
    const { data: updateData, error: updateError } = await supabase
      .from('student_pets')
      .update({ xp: newXp, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select('xp, updated_at')

    // 3. Re-fetch to confirm
    const { data: afterPet } = await supabase
      .from('student_pets')
      .select('xp, happiness, hunger, evolution_stage')
      .eq('user_id', userId)
      .single()

    return NextResponse.json({
      userId,
      email,
      before: pet,
      updateAttempt: { newXp, updateData, updateError },
      after: afterPet,
      verdict: updateError ? '❌ UPDATE FAILED' : afterPet?.xp === newXp ? '✅ UPDATE WORKED' : '⚠️ UPDATE RETURNED NO ERROR BUT XP DID NOT CHANGE',
    })
  } catch (err) {
    return NextResponse.json({ step: 'exception', error: String(err) }, { status: 500 })
  }
}
