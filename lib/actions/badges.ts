'use server'

/**
 * Server Actions — Badge System
 *
 * Student actions:
 *   applyForBadge       — submit an application for an 'application' type badge
 *   getMyBadgeStatus    — get the current user's active badges + pending applications
 *
 * Teacher/admin actions (bubble room review panel):
 *   getPendingApplications  — list all pending badge applications
 *   reviewBadgeApplication  — approve or deny a pending application
 *
 * Admin actions:
 *   grantBadgeDirect    — admin_assigned: grant without application
 *   revokeBadge         — soft-revoke any active badge
 *   getAllBadgeHolders   — list current holders of a badge (for admin panel)
 *
 * System:
 *   getUserBadges       — fetch active badges for a user (for display)
 */

import { createClient } from '@/lib/supabase/server'
import type { BadgeApplication, BadgeDefinition, UserBadge } from '@/lib/types/badges'

type ActionResult<T> = { data: T; error?: never } | { data?: never; error: string }

// ── helpers ────────────────────────────────────────────────────────────────

async function isTeacherOrAdmin(supabase: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles')
    .select('roles!inner(name)')
    .eq('user_id', userId)
    .is('class_id', null)
  return (data ?? []).some((r: any) =>
    r.roles?.name === 'teacher' || r.roles?.name === 'administrator',
  )
}

async function sendBadgeNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  type: string,  // free-text — notifications table has no type constraint
  badge: { name: string; emoji: string },
  approved: boolean,
  reviewerComment?: string | null,
) {
  const title = type === 'badge_revoked'
    ? `${badge.emoji} Badge Removed`
    : approved
      ? `${badge.emoji} Badge Approved!`
      : `Badge Application Update`

  const message = type === 'badge_revoked'
    ? `Your "${badge.name}" badge has been removed.${reviewerComment ? ` Reason: ${reviewerComment}` : ''}`
    : approved
      ? `Congratulations! Your application for "${badge.name}" was approved.${reviewerComment ? ` Note: ${reviewerComment}` : ''}`
      : `Your application for "${badge.name}" was not approved.${reviewerComment ? ` Feedback: ${reviewerComment}` : ''}`

  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    link: '/bubble-room',
  })
}

// ── Student: apply ─────────────────────────────────────────────────────────

export async function applyForBadge(
  badgeSlug: string,
  note?: string,
): Promise<ActionResult<{ applicationId: string }>> {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'You must be logged in.' }

    // Look up the badge
    const { data: badge, error: badgeError } = await supabase
      .from('badge_definitions')
      .select('id, slug, earn_type, require_application, is_active')
      .eq('slug', badgeSlug)
      .single()

    if (badgeError || !badge) return { error: 'Badge not found.' }
    if (!badge.is_active) return { error: 'This badge is not currently available.' }
    if (!badge.require_application) return { error: 'This badge cannot be applied for.' }

    // Check for existing active badge
    const { data: existing } = await supabase
      .from('user_badges')
      .select('id')
      .eq('user_id', user.id)
      .eq('badge_id', badge.id)
      .is('revoked_at', null)
      .maybeSingle()
    if (existing) return { error: 'You already have this badge.' }

    // Check for existing pending application (unique constraint handles it, but give a nice error)
    const { data: pendingApp } = await supabase
      .from('badge_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('badge_id', badge.id)
      .eq('status', 'pending')
      .maybeSingle()
    if (pendingApp) return { error: 'You already have a pending application for this badge.' }

    const { data: app, error: insertError } = await supabase
      .from('badge_applications')
      .insert({
        user_id: user.id,
        badge_id: badge.id,
        note: note?.trim() || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError) {
      // Unique constraint violation = existing pending application
      if (insertError.code === '23505') return { error: 'You already have a pending application for this badge.' }
      throw insertError
    }

    return { data: { applicationId: app.id } }
  } catch (err) {
    console.error('[Badges] applyForBadge:', err)
    return { error: 'Failed to submit application. Please try again.' }
  }
}

// ── Student: get own badge + application status ────────────────────────────

export async function getMyBadgeStatus(badgeSlug?: string): Promise<ActionResult<{
  activeBadges: UserBadge[]
  pendingApplications: BadgeApplication[]
}>> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: { activeBadges: [], pendingApplications: [] } }

    // Fetch active badges
    const { data: badges } = await supabase
      .from('user_badges')
      .select('*, badge:badge_definitions(*)')
      .eq('user_id', user.id)
      .is('revoked_at', null)

    // Fetch pending applications
    const { data: apps } = await supabase
      .from('badge_applications')
      .select('*, badge:badge_definitions(*)')
      .eq('user_id', user.id)
      .eq('status', 'pending')

    // Filter by slug client-side if requested
    const activeBadges = (badges ?? []).filter((b: any) =>
      !badgeSlug || b.badge?.slug === badgeSlug
    ) as UserBadge[]

    const pendingApplications = (apps ?? []).filter((a: any) =>
      !badgeSlug || a.badge?.slug === badgeSlug
    ) as BadgeApplication[]

    return { data: { activeBadges, pendingApplications } }
  } catch (err) {
    console.error('[Badges] getMyBadgeStatus:', err)
    return { error: 'Failed to load badge status.' }
  }
}

// ── Teacher/Admin: pending applications ───────────────────────────────────

export async function getPendingApplications(badgeSlug?: string): Promise<ActionResult<BadgeApplication[]>> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }
    if (!(await isTeacherOrAdmin(supabase, user.id))) return { error: 'Unauthorized' }

    let q = supabase
      .from('badge_applications')
      .select(`
        *,
        badge:badge_definitions(*),
        applicant:profiles!badge_applications_user_id_fkey(full_name, nickname, email)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (badgeSlug) {
      // Filter by badge slug via join — use a subquery approach
      const { data: badgeDef } = await supabase
        .from('badge_definitions')
        .select('id')
        .eq('slug', badgeSlug)
        .single()
      if (badgeDef) q = q.eq('badge_id', badgeDef.id) as any
    }

    const { data, error } = await q
    if (error) throw error

    const apps = (data ?? []).map((row: any): BadgeApplication => ({
      ...row,
      applicant_name: row.applicant?.nickname ?? row.applicant?.full_name ?? 'Unknown',
      applicant_email: row.applicant?.email ?? '',
    }))

    return { data: apps }
  } catch (err) {
    console.error('[Badges] getPendingApplications:', err)
    return { error: 'Failed to load applications.' }
  }
}

// ── Teacher/Admin: review (approve or deny) ────────────────────────────────

export async function reviewBadgeApplication(
  applicationId: string,
  decision: 'approved' | 'denied',
  reviewerComment?: string,
): Promise<ActionResult<{ success: true }>> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }
    if (!(await isTeacherOrAdmin(supabase, user.id))) return { error: 'Unauthorized' }

    // Fetch the application + badge info
    const { data: app, error: appError } = await supabase
      .from('badge_applications')
      .select('*, badge:badge_definitions(id, name, emoji)')
      .eq('id', applicationId)
      .eq('status', 'pending')
      .single()

    if (appError || !app) return { error: 'Application not found or already reviewed.' }

    // Update application status
    const { error: updateError } = await supabase
      .from('badge_applications')
      .update({
        status: decision,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        reviewer_comment: reviewerComment?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)

    if (updateError) throw updateError

    // If approved: grant the badge
    if (decision === 'approved') {
      const { error: grantError } = await supabase
        .from('user_badges')
        .insert({
          user_id: app.user_id,
          badge_id: (app.badge as any).id,
          granted_by: user.id,
        })
      if (grantError) {
        // Already has badge — not fatal
        console.warn('[Badges] grant insert conflict (user already has badge):', grantError.message)
      }
    }

    // Notify the applicant
    await sendBadgeNotification(
      supabase,
      app.user_id,
      'badge_application_result',
      app.badge as any,
      decision === 'approved',
      reviewerComment,
    )

    return { data: { success: true } }
  } catch (err) {
    console.error('[Badges] reviewBadgeApplication:', err)
    return { error: 'Failed to process the application.' }
  }
}

// ── Admin: grant directly (admin_assigned) ────────────────────────────────

export async function grantBadgeDirect(
  targetUserId: string,
  badgeSlug: string,
): Promise<ActionResult<{ success: true }>> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }
    if (!(await isTeacherOrAdmin(supabase, user.id))) return { error: 'Unauthorized' }

    const { data: badge } = await supabase
      .from('badge_definitions')
      .select('id, name, emoji')
      .eq('slug', badgeSlug)
      .single()
    if (!badge) return { error: 'Badge not found.' }

    const { error } = await supabase
      .from('user_badges')
      .insert({ user_id: targetUserId, badge_id: badge.id, granted_by: user.id })

    if (error) {
      if (error.code === '23505') return { error: 'User already has this badge.' }
      throw error
    }

    await sendBadgeNotification(supabase, targetUserId, 'badge_application_result', badge, true)
    return { data: { success: true } }
  } catch (err) {
    console.error('[Badges] grantBadgeDirect:', err)
    return { error: 'Failed to grant badge.' }
  }
}

// ── Admin: revoke ──────────────────────────────────────────────────────────

export async function revokeBadge(
  userBadgeId: string,
  reason?: string,
): Promise<ActionResult<{ success: true }>> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }
    if (!(await isTeacherOrAdmin(supabase, user.id))) return { error: 'Unauthorized' }

    // Fetch to get user_id + badge info for notification
    const { data: ub } = await supabase
      .from('user_badges')
      .select('user_id, badge:badge_definitions(name, emoji)')
      .eq('id', userBadgeId)
      .is('revoked_at', null)
      .single()

    if (!ub) return { error: 'Active badge not found.' }

    const { error } = await supabase
      .from('user_badges')
      .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
      .eq('id', userBadgeId)

    if (error) throw error

    await sendBadgeNotification(supabase, ub.user_id, 'badge_revoked', ub.badge as any, false, reason)
    return { data: { success: true } }
  } catch (err) {
    console.error('[Badges] revokeBadge:', err)
    return { error: 'Failed to revoke badge.' }
  }
}

// ── Public: get active badges for any user ────────────────────────────────

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('user_badges')
      .select('*, badge:badge_definitions(*)')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('granted_at', { ascending: true })
    return (data ?? []) as UserBadge[]
  } catch {
    return []
  }
}

// ── Admin: get all active badge holders for a badge ───────────────────────

export async function getAllBadgeHolders(badgeSlug: string): Promise<ActionResult<Array<{
  userBadgeId: string
  userId: string
  name: string
  email: string
  grantedAt: string
}>>> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }
    if (!(await isTeacherOrAdmin(supabase, user.id))) return { error: 'Unauthorized' }

    const { data: badge } = await supabase
      .from('badge_definitions')
      .select('id')
      .eq('slug', badgeSlug)
      .single()
    if (!badge) return { error: 'Badge not found.' }

    const { data, error } = await supabase
      .from('user_badges')
      .select('id, user_id, granted_at, holder:profiles!user_badges_user_id_fkey(full_name, nickname, email)')
      .eq('badge_id', badge.id)
      .is('revoked_at', null)
      .order('granted_at', { ascending: false })

    if (error) throw error

    return {
      data: (data ?? []).map((row: any) => ({
        userBadgeId: row.id,
        userId: row.user_id,
        name: row.holder?.nickname ?? row.holder?.full_name ?? 'Unknown',
        email: row.holder?.email ?? '',
        grantedAt: row.granted_at,
      })),
    }
  } catch (err) {
    console.error('[Badges] getAllBadgeHolders:', err)
    return { error: 'Failed to load badge holders.' }
  }
}

// ── Rule evaluator stub ───────────────────────────────────────────────────
// Called after relevant events (response posted, challenge graded, etc.)
// Only evaluates 'rule_based' badges. Currently stubbed — add new metric
// cases here as you add more rule-based badges.

export async function evaluateRuleBadges(userId: string): Promise<void> {
  try {
    const supabase = createClient()

    // Fetch all active rule_based badge definitions
    const { data: ruleBadges } = await supabase
      .from('badge_definitions')
      .select('*')
      .eq('earn_type', 'rule_based')
      .eq('is_active', true)

    if (!ruleBadges?.length) return

    for (const badge of ruleBadges) {
      const rules = badge.earn_rules as { metric: string; threshold: number } | null
      if (!rules?.metric || !rules?.threshold) continue

      // Check if user already has this badge
      const { data: existing } = await supabase
        .from('user_badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_id', badge.id)
        .is('revoked_at', null)
        .maybeSingle()
      if (existing) continue  // already awarded

      let metricValue = 0

      // ── Add new metric cases here ──────────────────────────────────────
      switch (rules.metric) {
        case 'bubble_room_responses': {
          const { count } = await supabase
            .from('bubble_room_responses')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
          metricValue = count ?? 0
          break
        }
        // case 'challenges_solved': { ... break }
        // case 'challenge_score_avg': { ... break }
        default:
          continue  // unknown metric — skip
      }

      if (metricValue >= rules.threshold) {
        // Auto-grant
        await supabase.from('user_badges').insert({
          user_id: userId,
          badge_id: badge.id,
          granted_by: null,  // system
        }).throwOnError()

        await sendBadgeNotification(
          supabase, userId, 'badge_application_result',
          { name: badge.name, emoji: badge.emoji },
          true,
          `Automatically awarded for reaching ${metricValue} ${rules.metric.replace(/_/g, ' ')}.`,
        )
      }
    }
  } catch (err) {
    // Rule evaluation is non-critical — swallow errors
    console.error('[Badges] evaluateRuleBadges:', err)
  }
}
