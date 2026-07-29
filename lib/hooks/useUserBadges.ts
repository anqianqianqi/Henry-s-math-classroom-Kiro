'use client'

/**
 * useUserBadges — fetches active badges for a set of user IDs.
 *
 * Returns a Map<userId, badge[]> so any component can look up
 * a user's badges in O(1) and render them inline with their name.
 *
 * Deduplicates IDs before fetching, re-fetches when the ID set changes.
 * Safe to call with an empty array — returns an empty map immediately.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface BadgeInfo {
  slug: string
  name: string
  emoji: string
  color: string
}

export type UserBadgeMap = Map<string, BadgeInfo[]>

export function useUserBadges(userIds: string[]): UserBadgeMap {
  const [badgeMap, setBadgeMap] = useState<UserBadgeMap>(new Map())

  useEffect(() => {
    const unique = [...new Set(userIds.filter(Boolean))]
    if (unique.length === 0) {
      setBadgeMap(new Map())
      return
    }

    let cancelled = false

    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('user_badges')
        .select('user_id, badge:badge_definitions(slug, name, emoji, color)')
        .in('user_id', unique)
        .is('revoked_at', null)

      if (cancelled || error || !data) return

      const map = new Map<string, BadgeInfo[]>()
      for (const row of data) {
        const b = row.badge as any
        if (!b?.slug) continue
        const existing = map.get(row.user_id) ?? []
        existing.push({ slug: b.slug, name: b.name, emoji: b.emoji, color: b.color })
        map.set(row.user_id, existing)
      }
      setBadgeMap(map)
    })()

    return () => { cancelled = true }
    // Stringify to avoid re-running on every render with a new array reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIds.sort().join(',')])

  return badgeMap
}
