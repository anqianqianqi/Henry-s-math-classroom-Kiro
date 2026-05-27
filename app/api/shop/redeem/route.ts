// app/api/shop/redeem/route.ts
// Atomic redemption API route.
// Validates auth, calls the redeem_item() Supabase RPC, maps errors to HTTP responses.
//
// NOTE: This route never modifies challenge_submissions.points.
// Student scores only increase (when teacher grades). Spending only
// inserts into the redemptions table.

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Parse and validate request body
    let body: { item_id?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!body.item_id || typeof body.item_id !== 'string') {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 })
    }

    // Create server-side Supabase client and verify session
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call the atomic RPC — balance check, quantity check, and insert
    // happen in a single Postgres transaction (no race conditions)
    const { error } = await supabase.rpc('redeem_item', {
      p_item_id: body.item_id,
    })

    if (error) {
      // Map Postgres exception messages to user-friendly HTTP responses
      const msg = error.message ?? ''

      if (msg.includes('insufficient_balance')) {
        return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
      }
      if (msg.includes('out_of_stock')) {
        return NextResponse.json({ error: 'Item is out of stock' }, { status: 400 })
      }
      if (msg.includes('item_not_found')) {
        return NextResponse.json({ error: 'Item not found or inactive' }, { status: 400 })
      }

      console.error('[shop/redeem] Unexpected RPC error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[shop/redeem] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
