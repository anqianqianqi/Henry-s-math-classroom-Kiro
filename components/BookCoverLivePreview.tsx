'use client'
/**
 * BookCoverLivePreview
 *
 * Renders a full "challenge page" preview of a book cover skin:
 *   - Cover image (object-contain, matching MagicBookReveal)
 *   - Animated overlay objects composited on top (fetched once per skinId)
 *   - Optional challenge title text overlay
 *   - Optional "Open the Book" prompt button
 *
 * Used in:
 *   - SkinOption card thumbnail (small, no title/button)
 *   - Collection zoom modal (full size, with title + button)
 *   - Shop zoom modal (full size, with title + button)
 *
 * Overlays are fetched once when `skinId` changes and cached in component state.
 * Pass `overlays` directly to skip the fetch (e.g. when already loaded by parent).
 */

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type OverlayAnim = 'none' | 'float' | 'pulse' | 'rotate' | 'shimmer' | 'bounce' | 'sway' | 'flicker' | 'bling'

interface OverlayObject {
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

interface CoverLayout {
  title?: { x: number; y: number; fontSize: number; color: string; shadow: boolean }
  prompt?: { x: number; y: number; fontSize: number; color: string; shadow: boolean }
}

const OV_KEYFRAMES = `
@keyframes bcl-float   { 0%,100%{transform:translateY(0) translate(-50%,-50%)}    50%{transform:translateY(-8px) translate(-50%,-50%)} }
@keyframes bcl-pulse   { 0%,100%{transform:scale(1) translate(-50%,-50%)}          50%{transform:scale(1.12) translate(-50%,-50%)} }
@keyframes bcl-rotate  { from{transform:rotate(0deg) translate(-50%,-50%)}         to{transform:rotate(360deg) translate(-50%,-50%)} }
@keyframes bcl-shimmer { 0%,100%{opacity:1}                                         50%{opacity:0.45} }
@keyframes bcl-bounce  { 0%,100%{transform:translateY(0) translate(-50%,-50%)}     40%{transform:translateY(-14px) translate(-50%,-50%)} 60%{transform:translateY(-6px) translate(-50%,-50%)} }
@keyframes bcl-sway    { 0%,100%{transform:rotate(-8deg) translateY(0) translate(-50%,-50%)} 50%{transform:rotate(8deg) translateY(-4px) translate(-50%,-50%)} }
@keyframes bcl-flicker { 0%,100%{opacity:1} 25%{opacity:0.3} 50%{opacity:0.9} 75%{opacity:0.15} }
@keyframes bcl-bling   { 0%,100%{filter:brightness(1) drop-shadow(0 0 0px gold)} 50%{filter:brightness(1.6) drop-shadow(0 0 8px gold)} }
@keyframes bcl-pulse-glow { 0%,100%{opacity:1} 50%{opacity:0.7} }
@keyframes bcl-wiggle   { 0%,100%{transform:rotate(-8deg)} 50%{transform:rotate(8deg)} }
`

const OV_CSS: Record<OverlayAnim, string> = {
  none:    '',
  float:   'bcl-float 3s ease-in-out infinite',
  pulse:   'bcl-pulse 2.5s ease-in-out infinite',
  rotate:  'bcl-rotate 8s linear infinite',
  shimmer: 'bcl-shimmer 2s ease-in-out infinite',
  bounce:  'bcl-bounce 1.8s ease-in-out infinite',
  sway:    'bcl-sway 2.5s ease-in-out infinite',
  flicker: 'bcl-flicker 1.4s ease-in-out infinite',
  bling:   'bcl-bling 2s ease-in-out infinite',
}

interface BookCoverLivePreviewProps {
  /** Skin ID — used to fetch overlays if not provided directly */
  skinId?: string
  /** Cover image URL */
  coverImageUrl: string
  /** Pre-fetched overlays — skips the DB fetch if provided */
  overlays?: OverlayObject[]
  /** Cover layout for title/prompt text positions */
  coverLayout?: CoverLayout | null
  /** Challenge title shown on the cover — omit to hide */
  title?: string
  /** Show the "Open the Book" prompt button */
  showPromptButton?: boolean
  /** Container class */
  className?: string
  /** Container style */
  style?: React.CSSProperties
  /** Base size for overlay objects in px (default 80) */
  overlayBaseSize?: number
  /** Called when the preview is clicked */
  onClick?: () => void
}

export function BookCoverLivePreview({
  skinId,
  coverImageUrl,
  overlays: overlaysProp,
  coverLayout,
  title,
  showPromptButton = false,
  className,
  style,
  overlayBaseSize = 80,
  onClick,
}: BookCoverLivePreviewProps) {
  const [overlays, setOverlays] = useState<OverlayObject[]>(overlaysProp ?? [])
  const [fetchedForId, setFetchedForId] = useState<string | null>(null)
  const stylesInjected = useRef(false)

  // Inject keyframes once globally
  useEffect(() => {
    if (stylesInjected.current || typeof document === 'undefined') return
    if (document.getElementById('bcl-keyframes')) { stylesInjected.current = true; return }
    const el = document.createElement('style')
    el.id = 'bcl-keyframes'
    el.textContent = OV_KEYFRAMES
    document.head.appendChild(el)
    stylesInjected.current = true
  }, [])

  // Use prop overlays if provided; otherwise fetch from DB when skinId changes
  useEffect(() => {
    if (overlaysProp !== undefined) {
      setOverlays(overlaysProp)
      return
    }
    if (!skinId || skinId === fetchedForId) return
    const supabase = createClient()
    supabase
      .from('book_skin_overlays')
      .select('*')
      .eq('skin_id', skinId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setOverlays(data ?? [])
        setFetchedForId(skinId)
      })
  }, [skinId, overlaysProp, fetchedForId])

  const titleLayout = coverLayout?.title
  const promptLayout = coverLayout?.prompt

  return (
    <div
      className={className}
      style={{ position: 'relative', display: 'block', overflow: 'hidden', ...style }}
      onClick={onClick}
    >
      {/* Cover image — object-contain matches MagicBookReveal exactly */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverImageUrl}
        alt="Book cover"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        draggable={false}
      />

      {/* Animated overlay objects */}
      {overlays.map((obj) => {
        const cfg = obj.overlay_config
        if (!cfg) return null
        const sz = Math.round(overlayBaseSize * (cfg.scale ?? 1.0))
        const anim = cfg.animation && cfg.animation !== 'none' ? OV_CSS[cfg.animation] : undefined
        return (
          // eslint-disable-next-line @next/next/no-img-element
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
              pointerEvents: 'none',
            }}
          />
        )
      })}

      {/* Challenge title overlay */}
      {title && (
        <div
          className="absolute text-center px-4 w-full"
          style={{
            left: `${titleLayout?.x ?? 50}%`,
            top: `${titleLayout?.y ?? 22}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <h2
            className="font-bold leading-snug"
            style={{
              fontSize: titleLayout?.fontSize ?? 20,
              color: titleLayout?.color ?? '#2d1a00',
              fontFamily: '"Georgia", "Times New Roman", serif',
              textShadow: (titleLayout?.shadow ?? true)
                ? '0 1px 8px rgba(255,255,255,0.6), 0 0 16px rgba(0,0,0,0.4)'
                : undefined,
              letterSpacing: '0.04em',
            }}
          >
            {title}
          </h2>
        </div>
      )}

      {/* "Open the Book" prompt button */}
      {showPromptButton && (
        <div
          className="absolute flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap"
          style={{
            left: `${promptLayout?.x ?? 50}%`,
            top: `${promptLayout?.y ?? 82}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: promptLayout?.fontSize ?? 14,
            color: promptLayout?.color ?? 'rgba(240,215,140,0.97)',
            textShadow: (promptLayout?.shadow ?? true) ? '0 1px 4px rgba(0,0,0,0.8)' : undefined,
            background: 'rgba(40,25,5,0.72)',
            border: '1px solid rgba(200,160,60,0.55)',
            backdropFilter: 'blur(6px)',
            animation: 'bcl-pulse-glow 2.5s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        >
          <span style={{ animation: 'bcl-wiggle 2s ease-in-out infinite', display: 'inline-block' }}>📜</span>
          <span style={{ letterSpacing: '0.06em' }}>Open the Book</span>
        </div>
      )}
    </div>
  )
}
