/**
 * TypeScript type definitions for the Badge system.
 */

export type BadgeEarnType = 'application' | 'rule_based' | 'admin_assigned'
export type BadgeApplicationStatus = 'pending' | 'approved' | 'denied'

export interface BadgeDefinition {
  id: string
  slug: string
  name: string
  description: string | null
  emoji: string
  color: string
  earn_type: BadgeEarnType
  earn_rules: Record<string, unknown> | null  // e.g. { metric: 'bubble_room_responses', threshold: 20 }
  require_application: boolean
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  granted_by: string | null
  granted_at: string
  revoked_at: string | null
  revoked_by: string | null
  badge: BadgeDefinition   // joined
}

export interface BadgeApplication {
  id: string
  user_id: string
  badge_id: string
  note: string | null
  status: BadgeApplicationStatus
  reviewed_by: string | null
  reviewed_at: string | null
  reviewer_comment: string | null
  created_at: string
  updated_at: string
  badge: BadgeDefinition       // joined
  applicant_name?: string      // joined from profiles
  applicant_email?: string     // joined from profiles
}
