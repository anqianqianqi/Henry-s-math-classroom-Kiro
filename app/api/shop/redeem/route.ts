// app/api/shop/redeem/route.ts
// Atomic redemption API route.
// Routes to the correct RPC based on commodity_type:
//   standard / food / pet → redeem_item_v2
//   blindbox              → redeem_blindbox (returns image_url)
//   physical              → redeem_physical (notifies teacher)

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function mapRpcError(msg: string) {
  if (msg.includes('insufficient_balance')) return { error: 'Insufficient balance', status: 400 }
  if (msg.includes('out_of_stock'))         return { error: 'Item is out of stock', status: 400 }
  if (msg.includes('item_not_found'))       return { error: 'Item not found or inactive', status: 400 }
  return null
}

export async function POST(request: Request) {
  try {
    let body: { item_id?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!body.item_id || typeof body.item_id !== 'string') {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Look up commodity_type to route to the right RPC
    const { data: item, error: itemError } = await supabase
      .from('shop_items')
      .select('commodity_type')
      .eq('id', body.item_id)
      .eq('is_active', true)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found or inactive' }, { status: 400 })
    }

    const commodityType = item.commodity_type ?? 'standard'

    // ── Blind box ──────────────────────────────────────────────────────────
    if (commodityType === 'blindbox') {
      const { data, error } = await supabase.rpc('redeem_blindbox', {
        p_item_id: body.item_id,
      })
      if (error) {
        const mapped = mapRpcError(error.message ?? '')
        if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status })
        console.error('[shop/redeem] blindbox RPC error:', error)
        return NextResponse.json({ error: 'Internal server error', detail: error.message }, { status: 500 })
      }
      // data contains { success, image_ids, image_urls, image_id, image_url }
      return NextResponse.json({
        success: true,
        commodity_type: 'blindbox',
        image_urls: (data as any)?.image_urls ?? [],
        image_ids: (data as any)?.image_ids ?? [],
        // Legacy single-image fields for backward compat
        image_url: (data as any)?.image_url ?? null,
        image_id: (data as any)?.image_id ?? null,
      }, { status: 200 })
    }

    // ── Physical blind box (blind box + physical delivery) ─────────────────
    if (commodityType === 'physical_blindbox') {
      const { data, error } = await supabase.rpc('redeem_physical_blindbox', {
        p_item_id: body.item_id,
      })
      if (error) {
        const msg = error.message ?? ''
        console.error('[shop/redeem] physical_blindbox RPC error code:', error.code, 'msg:', msg, 'details:', error.details, 'hint:', error.hint)
        if (msg.includes('already_redeemed')) return NextResponse.json({ error: 'You have already redeemed this item' }, { status: 400 })
        const mapped = mapRpcError(msg)
        if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status })
        return NextResponse.json({ error: 'Internal server error', detail: msg }, { status: 500 })
      }
      return NextResponse.json({
        success: true,
        commodity_type: 'physical_blindbox',
        image_urls: (data as any)?.image_urls ?? [],
        image_ids: (data as any)?.image_ids ?? [],
        // Legacy single-image fields for backward compat
        image_url: (data as any)?.image_url ?? null,
        image_id: (data as any)?.image_id ?? null,
      }, { status: 200 })
    }

    // ── Physical prize ─────────────────────────────────────────────────────
    if (commodityType === 'physical') {
      const { error } = await supabase.rpc('redeem_physical', {
        p_item_id: body.item_id,
      })
      if (error) {
        const msg = error.message ?? ''
        if (msg.includes('already_redeemed')) return NextResponse.json({ error: 'You have already redeemed this item' }, { status: 400 })
        const mapped = mapRpcError(msg)
        if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status })
        console.error('[shop/redeem] physical RPC error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
      return NextResponse.json({
        success: true,
        commodity_type: 'physical',
      }, { status: 200 })
    }

    // ── Standard / food / pet ──────────────────────────────────────────────
    const { data, error } = await supabase.rpc('redeem_item_v2', {
      p_item_id: body.item_id,
    })
    if (error) {
      const mapped = mapRpcError(error.message ?? '')
      if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      console.error('[shop/redeem] standard RPC error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // If this shop item is linked to a pet_room_background, backfill pet_room_background_id
    // on the freshly-inserted redemption row so ownership queries work correctly.
    // Also handle book_skin_id for book cover/page skins.
    try {
      // Check pet room link
      const { data: linkedBg } = await supabase
        .from('pet_room_backgrounds')
        .select('id')
        .eq('shop_item_id', body.item_id)
        .maybeSingle()

      // Check book skin link
      const { data: linkedSkin } = await supabase
        .from('book_skins')
        .select('id')
        .eq('shop_item_id', body.item_id)
        .maybeSingle()

      if (linkedBg?.id || linkedSkin?.id) {
        // Find the newest redemption for this user + item (just inserted)
        const { data: newRedemption } = await supabase
          .from('redemptions')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('item_id', body.item_id)
          .is('refunded_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (newRedemption?.id) {
          const update: Record<string, string> = {}
          if (linkedBg?.id)   update.pet_room_background_id = linkedBg.id
          if (linkedSkin?.id) update.book_skin_id = linkedSkin.id

          await supabase
            .from('redemptions')
            .update(update)
            .eq('id', newRedemption.id)
        }
      }
    } catch (_) {
      // Non-fatal — ownership backfill failure shouldn't fail the purchase
    }

    return NextResponse.json({
      success: true,
      commodity_type: 'standard',
      ...(data as any),
    }, { status: 200 })

  } catch (err) {
    console.error('[shop/redeem] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
