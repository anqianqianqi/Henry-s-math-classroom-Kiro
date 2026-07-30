'use client'

/**
 * Book3DReveal — the 3D challenge room, drop-in for MagicBookReveal.
 *
 * Same contract: `children` is the LEFT page (problem), `solutionSlot` is the
 * RIGHT page (solution form). Those are live React nodes — forms, inputs, the
 * comment thread — which is exactly why they cannot live inside a WebGL
 * texture. So the split is:
 *
 *   3D owns the theatre  — closed book on the desk, the page-flip animation
 *   HTML owns the work   — once zoomed, real DOM pages the student types into
 *
 * Phases:
 *   closed   room plate, book shut, "open the book" affordance
 *   opening  the baked flip plays 1 -> 203
 *   open     book at rest on the settled spread; invites a click
 *   zoomed   room blurs, the 3D canvas fades out, DOM pages fade in
 *
 * The handover happens while the book is motionless at frame 203, so the swap
 * from texture to DOM is invisible.
 *
 * Desktop only — the caller gates on useIsDesktop() so mobile never loads
 * three.js or the GLB.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamicImport from 'next/dynamic'
import {
  DEFAULT_PLACEMENT,
  type AnimationConfig,
  type Placement,
} from '@/lib/types/challengeRoom'

const RoomPlacementStage = dynamicImport(
  () => import('./RoomPlacementStage').then(m => m.RoomPlacementStage),
  { ssr: false },
)

export interface Book3DRevealProps {
  title: string
  date: string
  /** LEFT page — the problem */
  children: React.ReactNode
  /** RIGHT page — the solution form */
  solutionSlot?: React.ReactNode

  roomUrl: string
  modelUrl: string
  coverUrl?: string | null
  innerUrl?: string | null
  placement: Placement
  animation: AnimationConfig
}

type Phase = 'closed' | 'opening' | 'open' | 'zoomed'

/** How long the tilt-to-flat + blur transition runs. */
const ZOOM_MS = 700

const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

export function Book3DReveal({
  title,
  date,
  children,
  solutionSlot,
  roomUrl,
  modelUrl,
  coverUrl,
  innerUrl,
  placement,
  animation,
}: Book3DRevealProps) {
  const [phase, setPhase] = useState<Phase>('closed')
  const [frame, setFrame] = useState(animation.startFrame)
  const [playing, setPlaying] = useState(false)

  // Placement is animated during the zoom, so the stage reads this rather than
  // the prop. The saved room placement stays untouched.
  const [livePlacement, setLivePlacement] = useState<Placement>(placement)
  const zoomRafRef = useRef(0)

  useEffect(() => {
    if (phase === 'closed') setLivePlacement(placement)
  }, [placement, phase])

  useEffect(() => () => window.cancelAnimationFrame(zoomRafRef.current), [])

  const openBook = useCallback(() => {
    if (phase !== 'closed') return
    setPhase('opening')
    setFrame(animation.startFrame)
    setPlaying(true)
  }, [phase, animation.startFrame])

  // The stage stops itself at endFrame when loop is false and reports it here.
  const handleFrameChange = useCallback(
    (next: number) => {
      setFrame(next)
      if (next >= animation.endFrame) {
        setPhase(current => (current === 'opening' ? 'open' : current))
      }
    },
    [animation.endFrame],
  )

  /**
   * Rotate the book flat and scale it up while the DOM pages fade in. Tilting
   * to 0 is what makes the pages readable — text on a surface pitched ~58 deg
   * away from the viewer is not something anyone should have to work on.
   */
  const zoomIn = useCallback(() => {
    if (phase !== 'open') return
    setPhase('zoomed')

    const from = { ...livePlacement }
    const to: Placement = { ...from, tilt: 0, scale: from.scale * 1.35, y: from.y + 0.35 }
    const started = performance.now()

    const step = (now: number) => {
      const t = Math.min(1, (now - started) / ZOOM_MS)
      const k = easeInOut(t)
      setLivePlacement({
        ...from,
        tilt: from.tilt + (to.tilt - from.tilt) * k,
        scale: from.scale + (to.scale - from.scale) * k,
        y: from.y + (to.y - from.y) * k,
      })
      if (t < 1) zoomRafRef.current = window.requestAnimationFrame(step)
    }
    zoomRafRef.current = window.requestAnimationFrame(step)
  }, [phase, livePlacement])

  const zoomOut = useCallback(() => {
    if (phase !== 'zoomed') return
    window.cancelAnimationFrame(zoomRafRef.current)
    const from = { ...livePlacement }
    const started = performance.now()

    const step = (now: number) => {
      const t = Math.min(1, (now - started) / ZOOM_MS)
      const k = easeInOut(t)
      setLivePlacement({
        ...from,
        tilt: from.tilt + (placement.tilt - from.tilt) * k,
        scale: from.scale + (placement.scale - from.scale) * k,
        y: from.y + (placement.y - from.y) * k,
      })
      if (t < 1) zoomRafRef.current = window.requestAnimationFrame(step)
      else setPhase('open')
    }
    zoomRafRef.current = window.requestAnimationFrame(step)
  }, [phase, livePlacement, placement])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phase === 'zoomed') zoomOut()
      if ((event.key === 'Enter' || event.key === ' ') && phase === 'closed') {
        event.preventDefault()
        openBook()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, zoomOut, openBook])

  const zoomed = phase === 'zoomed'

  // Page art doubles as the DOM page background so the zoomed spread matches
  // the textures the student just watched settle.
  const pageStyle: React.CSSProperties = innerUrl
    ? {
        backgroundImage: `url(${innerUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: 'linear-gradient(160deg, #f6efdd 0%, #efe3c8 55%, #e6d6b4 100%)' }

  return (
    <div className="relative">
      {/*
        The challenge page wraps its content in max-w-4xl (896px), which is far
        too small to sit at a desk in. Break out of it to viewport width.

        Sizing: the plate is 3:2 but desktop viewports are nearer 16:9, and
        object-cover would crop ~16% of the height — eating the top of the arched
        window and the front edge of the desk, the two things that sell "sitting
        here". So we fit the largest 3:2 box the viewport allows
        (width = min(100vw, 132vh) caps height at 88vh) and letterbox it over a
        blurred copy of itself, rather than cropping the composition.
      */}
      <div
        className="relative"
        style={{
          // 96vw rather than 100vw: vw units include the vertical scrollbar, so
          // a full 100vw breakout pushes the page into horizontal scroll.
          width: '96vw',
          marginLeft: 'calc(50% - 48vw)',
        }}
      >
        <div
          className="relative mx-auto overflow-hidden bg-gray-950"
          style={{ width: 'min(100%, 132vh)' }}
        >
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-110 blur-2xl"
          style={{
            backgroundImage: `url(${roomUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.55,
          }}
        />

        {/* Room + book, letterboxed. Blurs when zoomed. */}
        <div
          className="relative mx-auto transition-[filter,transform,opacity] duration-700 ease-out"
          style={{
            filter: zoomed ? 'blur(14px) saturate(0.85) brightness(0.7)' : 'none',
            transform: zoomed ? 'scale(1.04)' : 'none',
          }}
        >
          <RoomPlacementStage
            roomUrl={roomUrl}
            modelUrl={modelUrl}
            coverUrl={coverUrl}
            innerUrl={innerUrl}
            placement={livePlacement}
            onPlacementChange={setLivePlacement}
            animation={animation}
            frame={frame}
            onFrameChange={handleFrameChange}
            playing={playing}
            onPlayingChange={setPlaying}
            interactive={false}
            onCanvasClick={phase === 'closed' ? openBook : phase === 'open' ? zoomIn : undefined}
          />
        </div>

        {/* ── Affordances ─────────────────────────────────────────────── */}
        {phase === 'closed' && (
          <button
            type="button"
            onClick={openBook}
            className="absolute inset-x-0 bottom-6 mx-auto flex w-fit flex-col items-center gap-1 rounded-full bg-black/45 px-5 py-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          >
            <span className="text-sm font-semibold">Open the book</span>
            <span className="text-[11px] opacity-70">{title}</span>
          </button>
        )}

        {phase === 'open' && (
          <button
            type="button"
            onClick={zoomIn}
            className="absolute inset-x-0 bottom-6 mx-auto w-fit rounded-full bg-black/45 px-5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          >
            Click the book to work on the problem
          </button>
        )}

        </div>
      </div>

      {/*
        Zoomed working surface.

        Deliberately a SIBLING of the stage, not a child: an ancestor carrying
        `filter` or `transform` becomes the containing block for position:fixed,
        so nesting this inside the blurred/scaled stage would trap it in that
        box — which is what made the pages cramped before.
      */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8"
          style={{ animation: 'content-fade-in 0.45s ease-out both' }}
        >
          {/* Full-viewport blurred room behind the spread */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${roomUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(18px) saturate(0.85) brightness(0.55)',
              transform: 'scale(1.08)',
            }}
          />

          <div
            className="relative flex w-full overflow-hidden rounded-lg"
            style={{
              maxWidth: 'min(1700px, 96vw)',
              height: '92vh',
              boxShadow: '0 24px 70px rgba(0,0,0,0.6)',
            }}
          >
            {/* LEFT page — problem */}
            <div className="relative h-full flex-1 overflow-y-auto" style={pageStyle}>
              <div
                className="relative z-10 px-8 py-7 lg:px-14"
                style={{
                  fontFamily: '"Georgia", "Times New Roman", serif',
                  color: '#2d1a00',
                  lineHeight: 1.8,
                }}
              >
                <div className="mb-5 text-center">
                  <span
                    className="text-sm italic"
                    style={{ color: 'rgba(100,60,10,0.6)', fontFamily: 'Georgia, serif' }}
                  >
                    — ✦ — {date} — ✦ —
                  </span>
                </div>
                {children}
              </div>
            </div>

            {/* Spine */}
            <div
              aria-hidden="true"
              className="pointer-events-none w-3 shrink-0"
              style={{
                background:
                  'linear-gradient(to right, rgba(0,0,0,0.22), rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.05) 60%, rgba(0,0,0,0.22))',
              }}
            />

            {/* RIGHT page — solution */}
            <div className="relative h-full flex-1 overflow-y-auto" style={pageStyle}>
              <div className="relative z-10 px-8 py-7 lg:px-14">
                {solutionSlot ?? (
                  <p className="text-sm italic" style={{ color: 'rgba(100,60,10,0.55)' }}>
                    Nothing to answer here yet.
                  </p>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={zoomOut}
            aria-label="Back to the room"
            className="absolute right-5 top-5 z-10 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/80"
          >
            ✕ Back to the room
          </button>
        </div>
      )}
    </div>
  )
}
