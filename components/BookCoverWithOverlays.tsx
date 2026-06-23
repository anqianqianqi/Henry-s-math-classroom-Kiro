'use client'

/**
 * BookCoverWithOverlays — renders a book cover image with animated overlay objects
 * composited on top at their saved positions.
 *
 * Used in:
 * - MagicBookReveal (challenge page cover)
 * - SkinOption card (collection preview)
 * - Shop zoom preview
 *
 * The overlay_config shape: { x: number (0-100%), y: number (0-100%), scale: number, animation: OverlayAnim }
 */

import { useEffect, useRef } from 'react'

type OverlayAnim = 'none' | 'float' | 'pulse' | 'rotate' | 'shimmer' | 'bounce'

export interface OverlayObject {
  id: string
  label: string
  image_url: string
  sort_order: number
  overlay_config: {
    x: number
    y: number
    scale: number
    animation: OverlayAnim
  } | null
}

const OV_KEYFRAMES = `
@keyframes bov-float   { 0%,100%{transform:translateY(0) translate(-50%,-50%)}    50%{transform:translateY(-8px) translate(-50%,-50%)} }
@keyframes bov-pulse   { 0%,100%{transform:scale(1) translate(-50%,-50%)}          50%{transform:scale(1.12) translate(-50%,-50%)} }
@keyframes bov-rotate  { from{transform:rotate(0deg) translate(-50%,-50%)}         to{transform:rotate(360deg) translate(-50%,-50%)} }
@keyframes bov-shimmer { 0%,100%{opacity:1}                                         50%{opacity:0.45} }
@keyframes bov-bounce  { 0%,100%{transform:translateY(0) translate(-50%,-50%)}     40%{transform:translateY(-14px) translate(-50%,-50%)} 60%{transform:translateY(-6px) translate(-50%,-50%)} }
`

const OV_CSS: Record<OverlayAnim, string> = {
  none:    '',
  float:   'bov-float 3s ease-in-out infinite',
  pulse:   'bov-pulse 2.5s ease-in-out infinite',
  rotate:  'bov-rotate 8s linear infinite',
  shimmer: 'bov-shimmer 2s ease-in-out infinite',
  bounce:  'bov-bounce 1.8s ease-in-out infinite',
}

interface BookCoverWithOverlaysProps {
  /** The static cover image URL */
  coverImageUrl: string
  /** Overlay objects from book_skin_overlays table, ordered by sort_order */
  overlayObjects?: OverlayObject[]
  /** When true, pauses all overlay animations (e.g. during book flip). Resumes from same position when false. */
  overlayAnimationPaused?: boolean
  /** Cover container class name */
  className?: string
  /** Cover container style */
  style?: React.CSSProperties
  /** Size of overlay objects in pixels — scales with cover size. Default: 80 */
  overlayBaseSize?: number
  /** Called when the cover is clicked */
  onClick?: () => void
}

export function BookCoverWithOverlays({
  coverImageUrl,
  overlayObjects,
  overlayAnimationPaused = false,
  className,
  style,
  overlayBaseSize = 80,
  onClick,
}: BookCoverWithOverlaysProps) {
  const stylesInjected = useRef(false)

  // Inject keyframes once globally
  useEffect(() => {
    if (stylesInjected.current || typeof document === 'undefined') return
    if (document.getElementById('bov-keyframes')) { stylesInjected.current = true; return }
    const el = document.createElement('style')
    el.id = 'bov-keyframes'
    el.textContent = OV_KEYFRAMES
    document.head.appendChild(el)
    stylesInjected.current = true
  }, [])

  const hasOverlays = overlayObjects && overlayObjects.length > 0

  return (
    <div
      className={className}
      style={{ position: 'relative', display: 'inline-block', ...style }}
      onClick={onClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverImageUrl}
        alt="Book cover"
        className="w-full h-full object-contain"
        style={{ display: 'block' }}
        draggable={false}
      />

      {/* Animated overlay objects */}
      {hasOverlays && overlayObjects.map((obj) => {
        const cfg = obj.overlay_config
        if (!cfg) return null
        const sz = Math.round(overlayBaseSize * (cfg.scale ?? 1.0))
        const anim = cfg.animation && cfg.animation !== 'none' ? OV_CSS[cfg.animation] : undefined

        return (
          <img
            key={obj.id}
            src={obj.image_url}
            alt={obj.label}
            draggable={false}
            style={{
              position: 'absolute',
              left: `${cfg.x}%`,
              top: `${cfg.y}%`,
              width: sz,
              height: sz,
              objectFit: 'contain',
              transform: 'translate(-50%, -50%)',
              animation: anim,
              // Pause during book flip, resume afterward from the same position
              animationPlayState: overlayAnimationPaused ? 'paused' : 'running',
              pointerEvents: 'none',
            }}
          />
        )
      })}
    </div>
  )
}
