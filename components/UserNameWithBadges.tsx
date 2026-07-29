'use client'

/**
 * UserNameWithBadges — renders a user's name followed by their badge pills.
 *
 * Usage:
 *   <UserNameWithBadges name="Alice" badges={badgeMap.get(userId)} />
 *
 * Gracefully renders just the name when no badges are present.
 */

import { BadgePill } from '@/components/bubble-room/BadgePill'
import type { BadgeInfo } from '@/lib/hooks/useUserBadges'

export interface UserNameWithBadgesProps {
  name: string
  badges?: BadgeInfo[]
  nameClassName?: string
}

export function UserNameWithBadges({ name, badges, nameClassName }: UserNameWithBadgesProps) {
  const activeBadges = badges ?? []
  if (activeBadges.length === 0) {
    return <span className={nameClassName}>{name}</span>
  }
  return (
    <span className="inline-flex items-center flex-wrap gap-1.5">
      <span className={nameClassName}>{name}</span>
      {activeBadges.map((b) => (
        <BadgePill key={b.slug} emoji={b.emoji} name={b.name} color={b.color} />
      ))}
    </span>
  )
}
