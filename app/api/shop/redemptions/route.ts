// app/api/shop/redemptions/route.ts
// Returns the authenticated student's redemption history with item titles and
// blindbox prize images.
//
// Image resolution strategy (in priority order):
//   1. Direct: redemption.set_id → fetch all images in that set  (new draws)
//   2. Timestamp proximity: match redemption to closest unmatched claim by time  (legacy draws)
//
// Uses service role so item titles resolve even for deactivated/deleted items.

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const authClient = createRouteHandlerClient({ cookies })
    const { data: { session } } = await authClient.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch redemptions — include set_id (may be null for older rows)
    const { data: redemptions, error: redemptionsError } = await serviceClient
      .from('redemptions')
      .select('id, item_id, points_spent, redeemed_at, refunded_at, set_id')
      .eq('user_id', userId)
      .order('redeemed_at', { ascending: false })

    if (redemptionsError) {
      console.error('[shop/redemptions] error:', redemptionsError)
      return NextResponse.json({ error: 'Failed to fetch redemptions' }, { status: 500 })
    }

    if (!redemptions || redemptions.length === 0) {
      return NextResponse.json({ redemptions: [] }, { status: 200 })
    }

    // Shop items (including inactive/deleted)
    const itemIds = [...new Set(redemptions.map((r: any) => r.item_id))]
    const { data: shopItems } = await serviceClient
      .from('shop_items')
      .select('id, title, commodity_type')
      .in('id', itemIds)

    const itemMap: Record<string, { title: string; commodity_type: string }> = {}
    for (const item of shopItems ?? []) {
      itemMap[item.id] = { title: item.title, commodity_type: item.commodity_type }
    }

    // ── Strategy 1: direct set_id lookup ─────────────────────────────────────
    // For redemptions that have a set_id stored, fetch all images in that set.
    const directSetIds = [...new Set(
      redemptions
        .map((r: any) => r.set_id)
        .filter(Boolean)
    )]

    const directSetImageMap: Record<string, string[]> = {}
    if (directSetIds.length > 0) {
      const { data: directImages } = await serviceClient
        .from('blindbox_images')
        .select('set_id, image_url')
        .in('set_id', directSetIds)
        .order('sort_order', { ascending: true })

      for (const img of directImages ?? []) {
        if (!directSetImageMap[img.set_id]) directSetImageMap[img.set_id] = []
        if (img.image_url) directSetImageMap[img.set_id].push(img.image_url)
      }
    }

    // ── Strategy 2: timestamp-proximity fallback for legacy rows ──────────────
    // For blindbox redemptions without a set_id, match to blindbox_claims by
    // timestamp (claim and redemption happen in the same transaction).

    const legacyRedemptions = redemptions.filter((r: any) => {
      const ct = itemMap[r.item_id]?.commodity_type ?? 'standard'
      return !r.refunded_at && !r.set_id &&
        (ct === 'blindbox' || ct === 'physical_blindbox')
    })

    // Only fetch claims if we actually have legacy redemptions to resolve
    const legacyImageUrls: Record<string, string[]> = {}

    if (legacyRedemptions.length > 0) {
      const { data: blindboxClaims } = await serviceClient
        .from('blindbox_claims')
        .select('item_id, image_id, set_id, claimed_at')
        .eq('student_id', userId)
        .order('claimed_at', { ascending: true })

      // Collect set_ids and image_ids needed
      const claimSetIds = [...new Set(
        (blindboxClaims ?? []).map((c: any) => c.set_id).filter(Boolean)
      )]
      const legacyImageIds = [...new Set(
        (blindboxClaims ?? [])
          .filter((c: any) => !c.set_id && c.image_id)
          .map((c: any) => c.image_id)
      )]

      const [setImagesRes, legacyImgsRes, oldLegacyRes] = await Promise.all([
        claimSetIds.length > 0
          ? serviceClient.from('blindbox_images').select('set_id, image_url')
              .in('set_id', claimSetIds).order('sort_order', { ascending: true })
          : Promise.resolve({ data: [] }),
        legacyImageIds.length > 0
          ? serviceClient.from('blindbox_images').select('id, image_url').in('id', legacyImageIds)
          : Promise.resolve({ data: [] }),
        serviceClient.from('blindbox_images').select('item_id, image_url, claimed_at')
          .eq('claimed_by', userId).eq('is_claimed', true).order('claimed_at', { ascending: true }),
      ])

      const setImageMap: Record<string, string[]> = {}
      for (const img of setImagesRes.data ?? []) {
        if (!setImageMap[img.set_id]) setImageMap[img.set_id] = []
        if (img.image_url) setImageMap[img.set_id].push(img.image_url)
      }

      const legacyImageUrlMap: Record<string, string> = {}
      for (const img of legacyImgsRes.data ?? []) {
        if (img.image_url) legacyImageUrlMap[img.id] = img.image_url
      }

      // Build draw entries: { urls, claimed_at, used }
      type DrawEntry = { urls: string[]; claimed_at: string; used: boolean }
      const drawsByItem: Record<string, DrawEntry[]> = {}

      for (const claim of blindboxClaims ?? []) {
        if (!drawsByItem[claim.item_id]) drawsByItem[claim.item_id] = []
        if (claim.set_id) {
          const urls = setImageMap[claim.set_id] ?? []
          if (urls.length > 0) {
            drawsByItem[claim.item_id].push({ urls, claimed_at: claim.claimed_at, used: false })
          }
        } else if (claim.image_id) {
          const url = legacyImageUrlMap[claim.image_id]
          if (url) {
            drawsByItem[claim.item_id].push({ urls: [url], claimed_at: claim.claimed_at, used: false })
          }
        }
      }
      for (const img of oldLegacyRes.data ?? []) {
        if (!drawsByItem[img.item_id]) drawsByItem[img.item_id] = []
        if (img.image_url) {
          drawsByItem[img.item_id].push({ urls: [img.image_url], claimed_at: img.claimed_at, used: false })
        }
      }

      // Match legacy redemptions to closest unmatched draw by timestamp
      const legacySortedAsc = [...legacyRedemptions].sort(
        (a: any, b: any) => new Date(a.redeemed_at).getTime() - new Date(b.redeemed_at).getTime()
      )

      for (const r of legacySortedAsc) {
        const draws = drawsByItem[r.item_id] ?? []
        const redeemTime = new Date(r.redeemed_at).getTime()
        let bestIdx = -1
        let bestDiff = Infinity
        for (let i = 0; i < draws.length; i++) {
          if (draws[i].used) continue
          const diff = Math.abs(new Date(draws[i].claimed_at).getTime() - redeemTime)
          if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
        }
        if (bestIdx >= 0) {
          draws[bestIdx].used = true
          legacyImageUrls[r.id] = draws[bestIdx].urls
        }
      }
    }

    // ── Build result ──────────────────────────────────────────────────────────
    const result = redemptions.map((r: any) => {
      const item = itemMap[r.item_id]
      const commodityType = item?.commodity_type ?? 'standard'
      const isBlindbox = commodityType === 'blindbox' || commodityType === 'physical_blindbox'

      let imageUrls: string[] = []
      if (isBlindbox && !r.refunded_at) {
        if (r.set_id && directSetImageMap[r.set_id]) {
          // Strategy 1: direct
          imageUrls = directSetImageMap[r.set_id]
        } else if (legacyImageUrls[r.id]) {
          // Strategy 2: timestamp fallback
          imageUrls = legacyImageUrls[r.id]
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
