// app/api/pet/hatch/route.ts
// Hatches the current user's egg into a baby Didi (cat).
// Uses service-role-style route handler client which respects RLS
// but runs as the authenticated user — bypasses any client-side issues.

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use SECURITY DEFINER RPC to bypass RLS (works for all roles)
    const { error } = await supabase.rpc('hatch_pet')

    if (error) {
      console.error('[pet/hatch] RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return updated status directly
    const { data: pet } = await supabase
      .from('student_pets')
      .select('id, species, evolution_stage, xp')
      .eq('user_id', session.user.id)
      .single()

    return NextResponse.json({
      ok: true,
      hasPet: true,
      isEgg: false,
      species: pet?.species,
      stage: pet?.evolution_stage,
      xp: pet?.xp,
      petName: null,
      happiness: 30,
      hunger: 20,
      streak: null,
    }, { status: 200 })
  } catch (err) {
    console.error('[pet/hatch] unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
