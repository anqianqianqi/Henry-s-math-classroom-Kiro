'use client'

/**
 * BookCoverWithOverlays — renders a book cover image with animated overlay objects
 * composited on top at their saved positions.
 */

import { useEffect, useRef } from 'react'
import { buildKeyframesCSS, buildAnimCSS, getTransformOrigin, type OverlayAnim, overlayWidthPct, overlayBlendStyle } from '@/lib/overlayAnimations'
import { OverlayBurstRenderer } from './OverlayBurstRenderer'

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
    speed?: number
  } | null
}

const OV_KEYFRAMES = buildKeyframesCSS('bov')

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
        const sz = overlayWidthPct(cfg.scale ?? 1.0)

        // Burst animation — canvas-based
        if ((cfg as any).animation === 'burst' && (cfg as any).burst?.polygon?.length >= 3) {
          // We need container width; use a data attribute approach or pass it as prop.
          // For BookCoverWithOverlays we approximate from overlayBaseSize / (OVERLAY_BASE_PX/COVER_NATIVE_WIDTH)
          const containerPx = Math.round(overlayBaseSize / (80 / 1024))
          return (
            <OverlayBurstRenderer
              key={obj.id}
              imageUrl={obj.image_url}
              containerWidthPx={containerPx}
              scale={cfg.scale ?? 1.0}
              speed={(cfg as any).speed ?? 1.0}
              burst={(cfg as any).burst}
              paused={overlayAnimationPaused}
              style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, transform: 'translate(-50%,-50%)' }}
            />
          )
        }

        const anim = cfg.animation && cfg.animation !== 'none' ? buildAnimCSS(cfg.animation, 'bov', (cfg as any).speed ?? 1.0) : undefined
        const transformOrigin = getTransformOrigin(cfg.animation ?? 'none')

        return (
          // Outer div handles centering; inner img handles animation (no translate in keyframes)
          <div key={obj.id} style={{
            position: 'absolute', left: `${cfg.x}%`, top: `${cfg.y}%`,
            width: sz, height: sz, transform: 'translate(-50%,-50%)',
            pointerEvents: 'none',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={obj.image_url} alt={obj.label} draggable={false}
              style={{
                width: '100%', height: '100%', objectFit: 'contain',
                animation: anim, transformOrigin,
                animationPlayState: overlayAnimationPaused ? 'paused' : 'running',
                ...overlayBlendStyle((cfg as any).blendMode, (cfg as any).blendStrength, (cfg as any).warmTint),
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
