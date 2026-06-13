// app/api/shop/admin-redemptions/route.ts
// Teacher-only: returns ALL redemptions with student names and item details.
// Uses service role to bypass RLS.
//
// Image resolution for blindbox redemptions:
//   1. Direct: redemption.set_id → fetch all images in that set  (new draws)
//   2. Timestamp proximity: match to closest claim by time  (legacy draws without set_id)

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const authClient = createRouteHandlerClient({ cookies })
    const { data: { session } } = await authClient.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify teacher role
    const { data: roles } = await authClient
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', session.user.id)
      .is('class_id', null)

    const isTeacher = (roles as any[])?.some((r: any) =>
      r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
    )
    if (!isTeacher) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch all redemptions including set_id and refund info
    const { data: redemptions, error: rErr } = await admin
      .from('redemptions')
      .select('id, user_id, item_id, points_spent, redeemed_at, refunded_at, refunded_by, set_id')
      .order('redeemed_at', { ascending: false })

    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })
    if (!redemptions || redemptions.length === 0) {
      return NextResponse.json({ redemptions: [] })
    }

    const userIds = [...new Set(redemptions.map((r: any) => r.user_id))]
    const itemIds = [...new Set(redemptions.map((r: any) => r.item_id))]

    const [profilesRes, itemsRes] = await Promise.all([
      admin.from('profiles').select('id, first_name, last_name').in('id', userIds),
      admin.from('shop_items').select('id, title, commodity_type').in('id', itemIds),
    ])

    const profileMap: Record<string, string> = {}
    for (const p of profilesRes.data ?? []) {
      profileMap[p.id] = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'
    }

    const itemMap: Record<string, { title: string; commodity_type: string }> = {}
    for (const i of itemsRes.data ?? []) {
      itemMap[i.id] = { title: i.title, commodity_type: i.commodity_type }
    }

    const blindboxItemIds = itemIds.filter(id => {
      const t = itemMap[id]?.commodity_type
      return t === 'blindbox' || t === 'physical_blindbox'
    })

    // ── Strategy 1: direct set_id lookup ─────────────────────────────────────
    const directSetIds = [...new Set(
      redemptions.map((r: any) => r.set_id).filter(Boolean)
    )]

    const directSetImageMap: Record<string, string> = {} // set_id → first image URL
    if (directSetIds.length > 0) {
      const { data: setImages } = await admin
        .from('blindbox_images')
        .select('set_id, image_url')
        .in('set_id', directSetIds)
        .order('sort_order', { ascending: true })

      for (const img of setImages ?? []) {
        // Keep only first image per set for the thumbnail
        if (!directSetImageMap[img.set_id] && img.image_url) {
          directSetImageMap[img.set_id] = img.image_url
        }
      }
    }

    // ── Strategy 2: timestamp-proximity fallback ──────────────────────────────
    // For active blindbox redemptions with no set_id, match to claims by time.
    const legacyRedemptions = redemptions.filter((r: any) => {
      const ct = itemMap[r.item_id]?.commodity_type ?? 'standard'
      return !r.refunded_at && !r.set_id && blindboxItemIds.includes(r.item_id)
    })

    const legacyImageUrl: Record<string, string> = {} // redemption_id → first image URL

    if (legacyRedemptions.length > 0) {
      // Fetch all claims for users who have legacy redemptions
      const legacyUserIds = [...new Set(legacyRedemptions.map((r: any) => r.user_id))]

      const { data: claims } = await admin
        .from('blindbox_claims')
        .select('item_id, student_id, image_id, set_id, claimed_at')
        .in('student_id', legacyUserIds)
        .in('item_id', blindboxItemIds)
        .order('claimed_at', { ascending: true })

      const claimSetIds = [...new Set((claims ?? []).map((c: any) => c.set_id).filter(Boolean))]
      const claimImageIds = [...new Set((claims ?? []).filter((c: any) => !c.set_id && c.image_id).map((c: any) => c.image_id))]

      const [claimSetImgsRes, claimImgRes] = await Promise.all([
        claimSetIds.length > 0
          ? admin.from('blindbox_images').select('set_id, image_url')
              .in('set_id', claimSetIds).order('sort_order', { ascending: true })
          : Promise.resolve({ data: [] }),
        claimImageIds.length > 0
          ? admin.from('blindbox_images').select('id, image_url').in('id', claimImageIds)
          : Promise.resolve({ data: [] }),
      ])

      const claimSetFirstImg: Record<string, string> = {}
      for (const img of claimSetImgsRes.data ?? []) {
        if (!claimSetFirstImg[img.set_id] && img.image_url) claimSetFirstImg[img.set_id] = img.image_url
      }
      const claimImgUrl: Record<string, string> = {}
      for (const img of claimImgRes.data ?? []) {
        if (img.image_url) claimImgUrl[img.id] = img.image_url
      }

      // Build draw entries per (user_id, item_id)
      type DrawEntry = { url: string; claimed_at: string; used: boolean }
      const drawsByUserItem: Record<string, DrawEntry[]> = {}

      for (const c of claims ?? []) {
        const key = `${c.student_id}:${c.item_id}`
        if (!drawsByUserItem[key]) drawsByUserItem[key] = []
        let url = ''
        if (c.set_id) url = claimSetFirstImg[c.set_id] ?? ''
        else if (c.image_id) url = claimImgUrl[c.image_id] ?? ''
        if (url) drawsByUserItem[key].push({ url, claimed_at: c.claimed_at, used: false })
      }

      // Sort legacy redemptions oldest-first per user-item pair, then match
      const legacySorted = [...legacyRedemptions].sort(
        (a: any, b: any) => new Date(a.redeemed_at).getTime() - new Date(b.redeemed_at).getTime()
      )

      for (const r of legacySorted) {
        const key = `${r.user_id}:${r.item_id}`
        const draws = drawsByUserItem[key] ?? []
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
          legacyImageUrl[r.id] = draws[bestIdx].url
        }
      }
    }

    const result = redemptions.map((r: any) => {
      const item = itemMap[r.item_id]
      const commodityType = item?.commodity_type ?? 'standard'
      const isBlindbox = commodityType === 'blindbox' || commodityType === 'physical_blindbox'

      let blindboxImageUrl: string | null = null
      if (isBlindbox) {
        // Show prize image for both active AND refunded draws — set_id gives a direct link
        // to the images even after the blindbox_claim row has been deleted on refund.
        if (r.set_id && directSetImageMap[r.set_id]) {
          blindboxImageUrl = directSetImageMap[r.set_id]
        } else if (!r.refunded_at && legacyImageUrl[r.id]) {
          // Legacy fallback only works for active draws (needs a live claim row)
          blindboxImageUrl = legacyImageUrl[r.id]
        }
      }

      return {
        id: r.id,
        user_id: r.user_id,
        item_id: r.item_id,
        points_spent: r.points_spent,
        redeemed_at: r.redeemed_at,
        refunded_at: r.refunded_at ?? null,
        student_name: profileMap[r.user_id] ?? 'Unknown',
        item_title: item?.title ?? 'Deleted item',
        item_commodity_type: commodityType,
        blindbox_image_url: blindboxImageUrl,
      }
    })

    return NextResponse.json({ redemptions: result })
  } catch (err) {
    console.error('[admin-redemptions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
