// app/api/pet/debug/route.ts
// TEMPORARY debug endpoint — remove before production
// Visit /api/pet/debug in the browser to see exactly what's happening

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ step: 'no_session', sessionError }, { status: 200 })
    }

    // Step 1: check if student_pets table exists and has the row
    const { data: pet, error: petError } = await supabase
      .from('student_pets')
      .select('id, species, evolution_stage, xp')
      .eq('user_id', session.user.id)
      .single()

    // Step 2: check if extra columns exist
    const { data: extra, error: extraError } = await supabase
      .from('student_pets')
      .select('pet_name, happiness, hunger, current_streak')
      .eq('user_id', session.user.id)
      .single()

    return NextResponse.json({
      user_id: session.user.id,
      email: session.user.email,
      pet,
      petError: petError ? { code: petError.code, message: petError.message } : null,
      extra,
      extraError: extraError ? { code: extraError.code, message: extraError.message } : null,
    }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ step: 'unhandled_error', message: err?.message }, { status: 200 })
  }
}
