// app/api/pet/status/route.ts
// Lightweight endpoint that returns the current student's pet state
// for the desktop widget. Called once on page load, cached 60s client-side.
//
// Returns:
//   { hasPet: false }                          — no pet row yet
//   { hasPet: true, isEgg: true }              — egg stage
//   { hasPet: true, isEgg: false, ...fields }  — hatched pet

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ hasPet: false }, { status: 200 })
    }

    // Everyone (students, teachers, admins) gets a pet

    // Fetch pet data — select only base columns that always exist
    // Extra columns (pet_name, happiness, hunger, current_streak) added by migration
    // are fetched separately so a missing column doesn't break the whole widget
    const { data: pet, error } = await supabase
      .from('student_pets')
      .select('id, species, evolution_stage, xp')
      .eq('user_id', session.user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // No pet row yet — create one so the egg appears immediately
      const { error: insertError } = await supabase
        .from('student_pets')
        .insert({ user_id: session.user.id, xp: 0, evolution_stage: 'egg', species: null })
        .single()

      if (insertError && insertError.code !== '23505') {
        // 23505 = unique violation (row created by concurrent request) — safe to ignore
        console.error('[pet/status] Failed to create pet row:', insertError)
      }

      return NextResponse.json({ hasPet: true, isEgg: true, stage: 'egg', xp: 0, petName: null, happiness: 80, hunger: 80, streak: 0 }, { status: 200 })
    }

    if (error) {
      console.error('[pet/status] DB error:', error)
      return NextResponse.json({ hasPet: false }, { status: 200 })
    }

    const isEgg = !pet.species || pet.evolution_stage === 'egg'

    // Try to fetch extra columns added by the evolution migration (may not exist yet)
    let petName: string | null = null
    let happiness: number | null = null
    let hunger: number | null = null
    let streak: number | null = null
    try {
      const { data: extra } = await supabase
        .from('student_pets')
        .select('pet_name, happiness, hunger, current_streak')
        .eq('user_id', session.user.id)
        .single()
      if (extra) {
        petName = extra.pet_name ?? null
        happiness = extra.happiness ?? null
        hunger = extra.hunger ?? null
        streak = extra.current_streak ?? null
      }
    } catch { /* migration not run yet — fine, widget still shows */ }

    return NextResponse.json({
      hasPet: true,
      isEgg,
      species: pet.species,
      stage: pet.evolution_stage,
      xp: pet.xp,
      petName,
      happiness,
      hunger,
      streak,
    }, {
      status: 200,
      headers: {
        // Cache 60s on client, 30s on CDN edge
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
      },
    })
  } catch (err) {
    console.error('[pet/status] Unhandled error:', err)
    return NextResponse.json({ hasPet: false }, { status: 200 })
  }
}
