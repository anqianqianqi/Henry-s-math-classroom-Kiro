// app/api/shop/refund/route.ts
// Teacher-only: refund a redemption.
// Soft-deletes the redemption (marks refunded_at/refunded_by) and restores points.
// For blindbox items, also deletes the blindbox_claims row so the student can redraw.
// Requires teacher or administrator role.

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { redemption_id } = await request.json()
    if (!redemption_id) {
      return NextResponse.json({ error: 'redemption_id is required' }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify teacher/admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', session.user.id)
      .is('class_id', null)

    const isTeacher = (roles as any[])?.some((r: any) =>
      r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
    )
    if (!isTeacher) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Use service role client to bypass RLS
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Read redemption — include set_id so we can delete only the specific blindbox claim
    const { data: redemption, error: readErr } = await admin
      .from('redemptions')
      .select('user_id, item_id, points_spent, set_id')
      .eq('id', redemption_id)
      .single()

    if (readErr || !redemption) {
      return NextResponse.json({ error: 'Redemption not found' }, { status: 404 })
    }

    // Look up the item's commodity_type so we know whether to clean up blindbox_claims
    const { data: item } = await admin
      .from('shop_items')
      .select('commodity_type')
      .eq('id', redemption.item_id)
      .single()

    const commodityType = item?.commodity_type ?? 'standard'
    const isBlindbox = commodityType === 'blindbox' || commodityType === 'physical_blindbox'

    // Soft-delete: mark as refunded (keeps audit trail)
    // Requires refunded_at and refunded_by columns (run add-set-id-to-redemptions.sql in Supabase)
    const { error: updateErr } = await admin
      .from('redemptions')
      .update({
        refunded_at: new Date().toISOString(),
        refunded_by: session.user.id,
      })
      .eq('id', redemption_id)

    if (updateErr) {
      // Columns don't exist yet — fall back to hard delete until migration is run
      console.warn('[shop/refund] soft-delete failed (columns missing?), falling back to hard delete:', updateErr.message)
      const { error: deleteErr } = await admin
        .from('redemptions')
        .delete()
        .eq('id', redemption_id)
      if (deleteErr) {
        return NextResponse.json({ error: 'Failed to refund: ' + deleteErr.message }, { status: 500 })
      }
    }

    // Delete the SPECIFIC blindbox claim for this draw so the student can redraw that set.
    // We MUST target only this draw — deleting by item_id alone would wipe all of the
    // student's draws for this item, including other active ones.
    if (isBlindbox) {
      if (redemption.set_id) {
        // Best case: set_id is stored on the redemption — delete by exact set match
        const { error: claimDeleteErr } = await admin
          .from('blindbox_claims')
          .delete()
          .eq('student_id', redemption.user_id)
          .eq('item_id', redemption.item_id)
          .eq('set_id', redemption.set_id)

        if (claimDeleteErr) {
          console.warn('[shop/refund] Failed to delete blindbox_claims by set_id:', claimDeleteErr.message)
        }
      } else {
        // Fallback: set_id not stored yet (migration not run).
        // Find the claim whose claimed_at is closest to this redemption's redeemed_at,
        // then delete only that one row.
        const { data: claims } = await admin
          .from('blindbox_claims')
          .select('student_id, item_id, set_id, claimed_at')
          .eq('student_id', redemption.user_id)
          .eq('item_id', redemption.item_id)
          .not('set_id', 'is', null)
          .order('claimed_at', { ascending: true })

        if (claims && claims.length > 0) {
          const redeemTime = new Date(redemption.redeemed_at).getTime()
          let bestClaim = claims[0]
          let bestDiff = Math.abs(new Date(bestClaim.claimed_at).getTime() - redeemTime)
          for (const c of claims.slice(1)) {
            const diff = Math.abs(new Date(c.claimed_at).getTime() - redeemTime)
            if (diff < bestDiff) { bestDiff = diff; bestClaim = c }
          }
          await admin
            .from('blindbox_claims')
            .delete()
            .eq('student_id', redemption.user_id)
            .eq('item_id', redemption.item_id)
            .eq('set_id', bestClaim.set_id)
        }
      }
    }

    // Restore wallet — read current values then update
    const { data: wallet } = await admin
      .from('student_wallets')
      .select('total_spent, spendable_balance')
      .eq('user_id', redemption.user_id)
      .single()

    if (wallet) {
      await admin
        .from('student_wallets')
        .update({
          total_spent: Math.max(0, wallet.total_spent - redemption.points_spent),
          spendable_balance: wallet.spendable_balance + redemption.points_spent,
        })
        .eq('user_id', redemption.user_id)
    }

    return NextResponse.json({
      success: true,
      points_refunded: redemption.points_spent,
      blindbox_claim_cleared: isBlindbox,
    })
  } catch (err) {
    console.error('[shop/refund] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
