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

    // Fetch this user's redemptions (including soft-deleted/refunded for history display)
    const { data: redemptions, error: redemptionsError } = await serviceClient
      .from('redemptions')
      .select('id, item_id, points_spent, redeemed_at, refunded_at')
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

    // Fetch all blindbox_claims rows for this student, ordered by claim time
    const { data: blindboxClaims } = await serviceClient
      .from('blindbox_claims')
      .select('item_id, image_id, set_id, claimed_at')
      .eq('student_id', userId)
      .order('claimed_at', { ascending: true })

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
      .select('item_id, image_url, claimed_at')
      .eq('claimed_by', userId)
      .eq('is_claimed', true)
      .order('claimed_at', { ascending: true })

    // Build lookup maps
    // set_id → image URLs (all images in that set)
    const setImageMap: Record<string, string[]> = {}
    for (const img of setImagesResult.data ?? []) {
      if (!setImageMap[img.set_id]) setImageMap[img.set_id] = []
      if (img.image_url) setImageMap[img.set_id].push(img.image_url)
    }

    // image_id → image URL (legacy)
    const legacyImageUrlMap: Record<string, string> = {}
    for (const img of legacyImagesResult.data ?? []) {
      if (img.image_url) legacyImageUrlMap[img.id] = img.image_url
    }

    // Group claims by item_id, in chronological order — one entry per draw
    // Each draw = one set claim (set-based) or one image claim (legacy)
    const claimsByItem: Record<string, Array<{ urls: string[]; claimed_at: string }>> = {}

    for (const claim of blindboxClaims ?? []) {
      if (!claimsByItem[claim.item_id]) claimsByItem[claim.item_id] = []
      if (claim.set_id) {
        // Set-based draw: all images in the set
        const urls = setImageMap[claim.set_id] ?? []
        if (urls.length > 0) {
          claimsByItem[claim.item_id].push({ urls, claimed_at: claim.claimed_at })
        }
      } else if (claim.image_id) {
        // Legacy: single image
        const url = legacyImageUrlMap[claim.image_id]
        if (url) {
          claimsByItem[claim.item_id].push({ urls: [url], claimed_at: claim.claimed_at })
        }
      }
    }

    // Old legacy (claimed_by): group by item, one entry per image
    for (const img of oldLegacyResult.data ?? []) {
      if (!claimsByItem[img.item_id]) claimsByItem[img.item_id] = []
      if (img.image_url) {
        claimsByItem[img.item_id].push({ urls: [img.image_url], claimed_at: img.claimed_at })
      }
    }

    // Match each redemption to its corresponding draw by chronological order
    // redemptions are sorted desc (newest first), claims are sorted asc (oldest first)
    // We reverse-match: nth redemption for an item → nth claim for that item (both sorted by time)
    const redemptionCountByItem: Record<string, number> = {}

    // Sort redemptions oldest-first for matching, then we'll reverse the result
    const redemptionsSortedAsc = [...redemptions].sort(
      (a, b) => new Date(a.redeemed_at).getTime() - new Date(b.redeemed_at).getTime()
    )

    // Assign claim index to each redemption
    const redemptionClaimIndex: Record<string, number> = {}
    for (const r of redemptionsSortedAsc) {
      const commodityType = itemMap[r.item_id]?.commodity_type ?? 'standard'
      if (commodityType === 'blindbox' || commodityType === 'physical_blindbox') {
        const idx = redemptionCountByItem[r.item_id] ?? 0
        redemptionClaimIndex[r.id] = idx
        redemptionCountByItem[r.item_id] = idx + 1
      }
    }

    const result = redemptions.map(r => {
      const item = itemMap[r.item_id]
      const commodityType = item?.commodity_type ?? 'standard'
      const isBlindbox = commodityType === 'blindbox' || commodityType === 'physical_blindbox'

      let imageUrls: string[] = []
      if (isBlindbox) {
        const claimIdx = redemptionClaimIndex[r.id]
        const draws = claimsByItem[r.item_id] ?? []
        if (claimIdx !== undefined && draws[claimIdx]) {
          imageUrls = draws[claimIdx].urls
        } else if (draws.length > 0) {
          // Fallback: show all images if matching fails
          imageUrls = [...new Set(draws.flatMap(d => d.urls))]
        }
      }

      return {
        id: r.id,
        user_id: userId,
        item_id: r.item_id,
        points_spent: r.points_spent,
        redeemed_at: r.redeemed_at,
        refunded_at: r.refunded_at ?? null,
        item_title: item?.title ?? 'Deleted item',
        item_commodity_type: commodityType,
        blindbox_image_url: isBlindbox ? (imageUrls[0] ?? null) : null,
        blindbox_image_urls: isBlindbox ? imageUrls : [],
      }
    })

    return NextResponse.json({ redemptions: result }, { status: 200 })
  } catch (err) {
    console.error('[shop/redemptions] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
