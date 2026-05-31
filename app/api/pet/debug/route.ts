// app/api/pet/debug/route.ts
// Temporary debug endpoint — remove after diagnosing teacher-xp issue

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'no session', sessionError }, { status: 401 })
    }

    const userId = session.user.id

    // 1. Fetch pet
    const { data: pet, error: fetchError } = await supabase
      .from('student_pets')
      .select('*')
      .eq('user_id', userId)
      .single()

    // 2. Try a simple XP update
    const newXp = (pet?.xp ?? 0) + 1
    const { data: updateData, error: updateError } = await supabase
      .from('student_pets')
      .update({ xp: newXp, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()

    return NextResponse.json({
      userId,
      pet,
      fetchError,
      updateData,
      updateError,
      newXp,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
