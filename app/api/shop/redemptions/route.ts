// app/api/shop/redemptions/route.ts
// Returns the authenticated student's redemption history with item titles.
// Uses the service role client so item titles are always resolved even when
// a shop item has been deactivated or deleted (bypasses the student RLS policy
// that only allows reading active items).

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Verify the user is authenticated
    const authClient = createRouteHandlerClient({ cookies })
    const { data: { session } } = await authClient.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Use service role to bypass RLS — needed so we can read shop_items
    // regardless of is_active status (for redemption history display)
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch this user's redemptions
    const { data: redemptions, error: redemptionsError } = await serviceClient
      .from('redemptions')
      .select('id, item_id, points_spent, redeemed_at')
      .eq('user_id', userId)
      .order('redeemed_at', { ascending: false })

    if (redemptionsError) {
      console.error('[shop/redemptions] redemptions error:', redemptionsError)
      return NextResponse.json({ error: 'Failed to fetch redemptions' }, { status: 500 })
    }

    if (!redemptions || redemptions.length === 0) {
      return NextResponse.json({ redemptions: [] }, { status: 200 })
    }

    // Fetch all referenced shop items (including inactive/deleted ones)
    const itemIds = [...new Set(redemptions.map(r => r.item_id))]
    const { data: shopItems } = await serviceClient
      .from('shop_items')
      .select('id, title, commodity_type')
      .in('id', itemIds)

    const itemMap: Record<string, { title: string; commodity_type: string }> = {}
    for (const item of shopItems ?? []) {
      itemMap[item.id] = { title: item.title, commodity_type: item.commodity_type }
    }

    // Fetch all blindbox_claims rows for this student (includes set_id and image_id)
    const { data: blindboxClaims } = await serviceClient
      .from('blindbox_claims')
      .select('item_id, image_id, set_id')
      .eq('student_id', userId)

    // Collect all unique set_ids that were claimed
    const claimedSetIds = [...new Set(
      (blindboxClaims ?? []).map((c: any) => c.set_id).filter(Boolean)
    )]

    // Collect all unique image_ids claimed without a set (legacy mode)
    const legacyImageIds = [...new Set(
      (blindboxClaims ?? [])
        .filter((c: any) => !c.set_id && c.image_id)
        .map((c: any) => c.image_id)
    )]

    // Fetch all images belonging to claimed sets (set-based model)
    const setImagesResult = claimedSetIds.length > 0
      ? await serviceClient
          .from('blindbox_images')
          .select('item_id, set_id, image_url')
          .in('set_id', claimedSetIds)
          .order('sort_order', { ascending: true })
      : { data: [] }

    // Fetch legacy images by image_id
    const legacyImagesResult = legacyImageIds.length > 0
      ? await serviceClient
          .from('blindbox_images')
          .select('id, item_id, image_url')
          .in('id', legacyImageIds)
      : { data: [] }

    // Also fetch images claimed via old claimed_by mechanism (oldest legacy)
    const oldLegacyResult = await serviceClient
      .from('blindbox_images')
      .select('item_id, image_url')
      .eq('claimed_by', userId)
      .eq('is_claimed', true)

    // Build a map: item_id → array of all claimed image URLs for this student
    const claimedImageMap: Record<string, string[]> = {}

    const addUrl = (itemId: string, url: string) => {
      if (!url) return
      if (!claimedImageMap[itemId]) claimedImageMap[itemId] = []
      if (!claimedImageMap[itemId].includes(url)) {
        claimedImageMap[itemId].push(url)
      }
    }

    // Set-based images (new model) — grouped by item_id
    for (const img of setImagesResult.data ?? []) {
      addUrl(img.item_id, img.image_url)
    }

    // Legacy individual image claims
    for (const img of legacyImagesResult.data ?? []) {
      addUrl(img.item_id, img.image_url)
    }

    // Oldest legacy (claimed_by column)
    for (const img of oldLegacyResult.data ?? []) {
      addUrl(img.item_id, img.image_url)
    }

    const result = redemptions.map(r => {
      const item = itemMap[r.item_id]
      const commodityType = item?.commodity_type ?? 'standard'
      const imageUrls = claimedImageMap[r.item_id] ?? []
      return {
        id: r.id,
        user_id: userId,
        item_id: r.item_id,
        points_spent: r.points_spent,
        redeemed_at: r.redeemed_at,
        item_title: item?.title ?? 'Deleted item',
        item_commodity_type: commodityType,
        blindbox_image_url:
          (commodityType === 'blindbox' || commodityType === 'physical_blindbox')
            ? (imageUrls[0] ?? null)
            : null,
        blindbox_image_urls:
          (commodityType === 'blindbox' || commodityType === 'physical_blindbox')
            ? imageUrls
            : [],
      }
    })

    return NextResponse.json({ redemptions: result }, { status: 200 })
  } catch (err) {
    console.error('[shop/redemptions] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
