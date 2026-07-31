'use client'

/**
 * ChallengeBookShell — picks which book renderer the challenge page gets.
 *
 * Exists so the challenge page's very large children/solutionSlot JSX does not
 * have to be duplicated or restructured: the call site only changes tag name and
 * gains a `scene` prop.
 *
 * 3D path requires ALL of:
 *   - a desktop viewport (mobile keeps the proven 2D book and never fetches
 *     three.js or the 2.6 MiB GLB)
 *   - the student having selected a challenge room
 *   - NEXT_PUBLIC_CHALLENGE_ROOM_MODEL_URL configured
 *
 * Anything missing falls through to MagicBookReveal, so a misconfiguration
 * degrades to today's behaviour rather than an empty page.
 */

import { MagicBookReveal } from '@/components/MagicBookReveal'
import { Book3DReveal } from './Book3DReveal'
import { useIsDesktop } from '@/lib/hooks/useIsDesktop'
import { bookModelUrl } from '@/lib/challengeRoom/model'
import type { AnimationConfig, Placement } from '@/lib/types/challengeRoom'
import type { OverlayObject } from '@/components/BookCoverWithOverlays'

export interface ChallengeScene {
  roomUrl: string
  placement: Placement
  animation: AnimationConfig
  coverUrl: string | null
  innerUrl: string | null
}

export interface ChallengeBookShellProps {
  title: string
  date: string
  children: React.ReactNode
  solutionSlot?: React.ReactNode
  /** 2D path props — passed straight through to MagicBookReveal */
  coverImageUrl?: string
  pageImageUrl?: string
  coverLayout?: any
  coverFrameUrls?: string[]
  coverOverlays?: OverlayObject[]
  /** Present only when the student has a challenge room selected. */
  scene?: ChallengeScene | null
  /** Plain text printed onto the book page in the 3D path. Ignored in 2D. */
  problemPreview?: { title: string; body: string }
}

export function ChallengeBookShell({
  title,
  date,
  children,
  solutionSlot,
  coverImageUrl,
  pageImageUrl,
  coverLayout,
  coverFrameUrls,
  coverOverlays,
  scene,
  problemPreview,
}: ChallengeBookShellProps) {
  const isDesktop = useIsDesktop()
  const modelUrl = bookModelUrl()

  if (isDesktop && scene?.roomUrl && modelUrl) {
    return (
      <Book3DReveal
        title={title}
        date={date}
        solutionSlot={solutionSlot}
        roomUrl={scene.roomUrl}
        modelUrl={modelUrl}
        coverUrl={scene.coverUrl}
        innerUrl={scene.innerUrl}
        placement={scene.placement}
        animation={scene.animation}
        problemPreview={problemPreview}
      >
        {children}
      </Book3DReveal>
    )
  }

  return (
    <MagicBookReveal
      title={title}
      date={date}
      solutionSlot={solutionSlot}
      coverImageUrl={coverImageUrl}
      pageImageUrl={pageImageUrl}
      coverLayout={coverLayout}
      coverFrameUrls={coverFrameUrls}
      coverOverlays={coverOverlays}
    >
      {children}
    </MagicBookReveal>
  )
}
