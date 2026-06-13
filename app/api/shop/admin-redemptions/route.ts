// app/api/shop/admin-redemptions/route.ts
// Teacher-only: returns ALL redemptions with student names and item details.
// Uses service role to bypass RLS.

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

    // Fetch all redemptions
    const { data: redemptions, error: rErr } = await admin
      .from('redemptions')
      .select('id, user_id, item_id, points_spent, redeemed_at')
      .order('redeemed_at', { ascending: false })

    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })
    if (!redemptions || redemptions.length === 0) {
      return NextResponse.json({ redemptions: [] })
    }

    // Fetch profiles and shop items in parallel
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

    // Fetch blindbox claims for image URLs
    const blindboxItemIds = itemIds.filter(id => {
      const t = itemMap[id]?.commodity_type
      return t === 'blindbox' || t === 'physical_blindbox'
    })

    const claimedImageMap: Record<string, string> = {}
    if (blindboxItemIds.length > 0) {
      const { data: claims } = await admin
        .from('blindbox_claims')
        .select('item_id, student_id, image_id')
        .in('item_id', blindboxItemIds)

      const imageIds = [...new Set((claims ?? []).map((c: any) => c.image_id).filter(Boolean))]
      if (imageIds.length > 0) {
        const { data: images } = await admin
          .from('blindbox_images')
          .select('id, image_url')
          .in('id', imageIds)
        const imageUrlMap: Record<string, string> = {}
        for (const img of images ?? []) {
          if (img.image_url) imageUrlMap[img.id] = img.image_url
        }
        for (const claim of claims ?? []) {
          const url = imageUrlMap[claim.image_id]
          if (url) {
            const key = `${claim.item_id}:${claim.student_id}`
            if (!claimedImageMap[key]) claimedImageMap[key] = url
          }
        }
      }
    }

    const result = redemptions.map((r: any) => {
      const item = itemMap[r.item_id]
      const commodityType = item?.commodity_type ?? 'standard'
      const isBlindbox = commodityType === 'blindbox' || commodityType === 'physical_blindbox'
      return {
        id: r.id,
        user_id: r.user_id,
        item_id: r.item_id,
        points_spent: r.points_spent,
        redeemed_at: r.redeemed_at,
        student_name: profileMap[r.user_id] ?? 'Unknown',
        item_title: item?.title ?? 'Deleted item',
        item_commodity_type: commodityType,
        blindbox_image_url: isBlindbox ? (claimedImageMap[`${r.item_id}:${r.user_id}`] ?? null) : null,
      }
    })

    return NextResponse.json({ redemptions: result })
  } catch (err) {
    console.error('[admin-redemptions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
