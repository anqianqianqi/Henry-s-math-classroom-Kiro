'use client'

/**
 * The loading screen for a challenge: a book that draws itself.
 *
 * ── WHY A DRAWING AND NOT A SPINNER ─────────────────────────
 * Opening a challenge has real work to do — 2.63 MiB of book model before
 * anything else — so the wait is not a glitch to be hidden, it is a moment. A
 * spinner says "something is stuck"; a book being sketched says "your book is
 * being got ready", which is also what is literally happening. The pencil is
 * INK_DARK, the same graphite DreamSketchBoundary draws the room's edge with,
 * so the loader and the thing it opens onto are the same hand.
 *
 * ── WHY A FLOOR ON THE DURATION ─────────────────────────────
 * On a warm cache every asset resolves in tens of milliseconds and an unfloored
 * loader is a single flashed frame, which reads as a fault rather than a
 * transition. MIN_VISIBLE_MS keeps it a deliberate beat.
 */

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { INK_DARK } from '@/lib/ui/adaptiveInk'

/** The shortest a load is allowed to appear to take. */
export const MIN_VISIBLE_MS = 800

/** Total stroke length of the book outline, for the dash trick below. */
const OUTLINE_LEN = 640

export interface ChallengeLoaderProps {
  /** 0 → 1. Drives how much of the book has been inked in. */
  progress: number
}

export function ChallengeLoader({ progress }: ChallengeLoaderProps) {
  const { t } = useLanguage()
  const clamped = Math.max(0, Math.min(1, progress))

  /*
    Progress is smoothed on the way in, not thrown straight at the DOM. The GLB
    reports in chunky steps and the other assets land all at once, so the raw
    signal jumps; eased, the pencil moves like a pencil.
  */
  const [shown, setShown] = useState(0)
  const shownRef = useRef(0)
  const targetRef = useRef(0)
  targetRef.current = clamped

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const gap = targetRef.current - shownRef.current
      // Snap the last sliver, or it asymptotes and the book never quite closes.
      shownRef.current = Math.abs(gap) < 0.002 ? targetRef.current : shownRef.current + gap * 0.12
      setShown(shownRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const pct = Math.round(shown * 100)

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
      <div className="text-center px-6">
        <svg
          viewBox="0 0 200 150"
          className="w-56 h-42 mx-auto"
          style={{ width: 224, height: 168 }}
          role="img"
          aria-label={t('challenge.preparingRoom')}
        >
          {/*
            Cover wash, revealed by a clip that grows with progress. Underneath
            the outline, so the ink always reads on top of the colour.
          */}
          <defs>
            <clipPath id="cl-fill">
              <rect x="0" y={150 - 150 * shown} width="200" height={150 * shown} />
            </clipPath>
            <linearGradient id="cl-cover" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fdf7e9" />
              <stop offset="100%" stopColor="#e8d9b8" />
            </linearGradient>
          </defs>

          <g clipPath="url(#cl-fill)">
            <path d="M100 40 C 78 28, 46 28, 26 36 L 26 116 C 46 108, 78 108, 100 120 Z" fill="url(#cl-cover)" />
            <path d="M100 40 C 122 28, 154 28, 174 36 L 174 116 C 154 108, 122 108, 100 120 Z" fill="url(#cl-cover)" />
          </g>

          {/*
            The inking itself. One dash the length of the whole path, offset by
            the remaining fraction — so the stroke appears to be drawn rather
            than faded in. Rounded caps because a pencil has no square ends.
          */}
          <g
            fill="none"
            stroke={INK_DARK}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={OUTLINE_LEN}
            strokeDashoffset={OUTLINE_LEN * (1 - shown)}
            opacity="0.9"
          >
            <path d="M100 40 C 78 28, 46 28, 26 36 L 26 116 C 46 108, 78 108, 100 120" />
            <path d="M100 40 C 122 28, 154 28, 174 36 L 174 116 C 154 108, 122 108, 100 120" />
            <path d="M100 40 L 100 120" />
            <path d="M44 52 L 82 46 M44 66 L 76 61 M118 46 L 156 52 M124 61 L 156 66" strokeWidth="1.4" opacity="0.55" />
          </g>
        </svg>

        <p className="text-gray-600 mt-4 font-medium">{t('challenge.preparingRoom')}</p>

        <div className="mt-3 mx-auto w-56 h-1.5 rounded-full bg-gray-200/70 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-400 transition-[width] duration-150 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-gray-400 text-xs mt-2 tabular-nums">{t('challenge.preparingPct', { pct })}</p>
      </div>
    </div>
  )
}

/**
 * Longest the loader may ever stay up, whatever anyone reports.
 *
 * The preloader has its own ceiling on the files, but readiness also depends on
 * the 3D stage saying its textures are on the book — and a stage that mounts
 * and then silently never calls back would strand a student on this screen
 * forever. Generous enough not to cut a real slow load short, finite because a
 * page that eventually appears beats one that never does.
 */
export const MAX_VISIBLE_MS = 20_000

/**
 * The whole decision, as a function of three booleans.
 *
 * Pure and exported so it can be tested without a DOM: the repo runs vitest in
 * `node` with no jsdom, and this rule — not the three setTimeouts around it —
 * is the part that would be quietly wrong.
 */
export function loaderVisible(ready: boolean, floorElapsed: boolean, expired: boolean): boolean {
  return !((ready || expired) && floorElapsed)
}

/**
 * Holds `visible` true until BOTH the work is done and the floor has elapsed —
 * with a hard ceiling so it can never be the reason a page fails to open.
 *
 * Split out so the page can keep the real tree mounted underneath the whole
 * time: the 3D stage cannot report that its textures are on the book if it was
 * never allowed to mount.
 */
export function useLoaderVisible(
  ready: boolean,
  minMs: number = MIN_VISIBLE_MS,
  maxMs: number = MAX_VISIBLE_MS,
): boolean {
  const [floorElapsed, setFloorElapsed] = useState(false)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const floor = setTimeout(() => setFloorElapsed(true), minMs)
    const ceiling = setTimeout(() => setExpired(true), maxMs)
    return () => { clearTimeout(floor); clearTimeout(ceiling) }
  }, [minMs, maxMs])

  return loaderVisible(ready, floorElapsed, expired)
}
