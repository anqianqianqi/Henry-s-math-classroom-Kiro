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

    // Fetch claimed blindbox images for this student
    const [claimedImagesResult, blindboxClaimsResult] = await Promise.all([
      serviceClient
        .from('blindbox_images')
        .select('item_id, image_url')
        .eq('claimed_by', userId)
        .eq('is_claimed', true),
      serviceClient
        .from('blindbox_claims')
        .select('item_id, blindbox_images(image_url)')
        .eq('student_id', userId)
        .order('claimed_at', { ascending: false }),
    ])

    // Build a map: item_id → array of all claimed image URLs for this student
    const claimedImageMap: Record<string, string[]> = {}
    for (const img of claimedImagesResult.data ?? []) {
      if (img.image_url) {
        if (!claimedImageMap[img.item_id]) claimedImageMap[img.item_id] = []
        claimedImageMap[img.item_id].push(img.image_url)
      }
    }
    for (const claim of blindboxClaimsResult.data ?? []) {
      const url = (claim as any).blindbox_images?.image_url
      if (url) {
        if (!claimedImageMap[claim.item_id]) claimedImageMap[claim.item_id] = []
        // Avoid duplicates
        if (!claimedImageMap[claim.item_id].includes(url)) {
          claimedImageMap[claim.item_id].push(url)
        }
      }
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
