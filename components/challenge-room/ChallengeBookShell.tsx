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

import { useEffect } from 'react'
import { MagicBookReveal } from '@/components/MagicBookReveal'
import { Book3DReveal } from './Book3DReveal'
import { useIsDesktop } from '@/lib/hooks/useIsDesktop'
import { bookModelUrl } from '@/lib/challengeRoom/model'
import { RADIO_MODEL_URL } from '@/lib/challengeRoom/radio'
import type { AnimationConfig, Placement } from '@/lib/types/challengeRoom'
import type { OverlayObject } from '@/components/BookCoverWithOverlays'

export interface ChallengeScene {
  roomUrl: string
  placement: Placement
  animation: AnimationConfig
  coverUrl: string | null
  innerUrl: string | null
  /**
   * Where the radio stands on this room's sill, tuned by an admin against this
   * room's plate. Null means this room has no radio — which is every room until
   * someone places one, so the feature ships dark.
   */
  radioPlacement?: Placement | null
  /** The student's chosen colourway, already resolved to a file. */
  radioTextureUrl?: string | null
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
  /**
   * Fired when this shell has nothing left to load.
   *
   * On the 3D path that means the book is dressed — the stage decides, because
   * only it knows when the textures reached the GPU. On the 2D path there is no
   * such moment to wait for: MagicBookReveal is plain DOM and its images are
   * already in the preload set, so it reports immediately on mount.
   */
  onReady?: () => void
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
  onReady,
}: ChallengeBookShellProps) {
  const isDesktop = useIsDesktop()
  const modelUrl = bookModelUrl()

  const uses3D = isDesktop && !!scene?.roomUrl && !!modelUrl

  /*
    The 2D book has no load to wait on beyond its images, which the page has
    already preloaded, so it announces on mount. Effect rather than a call
    during render — reporting readiness is a side effect, and a setState in the
    parent during a child's render is a React warning.
  */
  useEffect(() => {
    if (!uses3D) onReady?.()
  }, [uses3D, onReady])

  if (uses3D && scene) {
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
        onReady={onReady}
        // Only pass the model when there is somewhere to put it, so a room
        // without a placement never downloads it.
        radioUrl={scene.radioPlacement ? RADIO_MODEL_URL : null}
        radioTextureUrl={scene.radioTextureUrl}
        radioPlacement={scene.radioPlacement}
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
