// app/api/pet/feed/route.ts
// Applies a pending food item to the student's pet.
// Called from the /pet page when the student clicks the Feed button.

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    let body: { feeding_id?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!body.feeding_id || typeof body.feeding_id !== 'string') {
      return NextResponse.json({ error: 'feeding_id is required' }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('apply_pet_feeding', {
      p_feeding_id: body.feeding_id,
    })

    if (error) {
      const msg = error.message ?? ''
      if (msg.includes('feeding_not_found')) {
        return NextResponse.json({ error: 'Food item not found or already fed' }, { status: 400 })
      }
      console.error('[pet/feed] RPC error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error('[pet/feed] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
