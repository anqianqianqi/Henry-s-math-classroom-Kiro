'use client'
/**
 * BookCoverLivePreview — renders a cover with animated overlays, title, and prompt.
 * Used in zoom modals. Overlays fetched lazily by skinId.
 */

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildKeyframesCSS, buildAnimCSS, getTransformOrigin, type OverlayAnim, overlayWidthPct } from '@/lib/overlayAnimations'
import { OverlayBurstRenderer } from './OverlayBurstRenderer'

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
    speed?: number
  } | null
}

interface CoverLayout {
  title?: { x: number; y: number; fontSize: number; color: string; shadow: boolean }
  prompt?: { x: number; y: number; fontSize: number; color: string; shadow: boolean }
}

// Extra keyframes for the prompt button pulse/wiggle (not in the main set)
const EXTRA_KF = `
@keyframes bcl-pulse-glow { 0%,100%{opacity:1} 50%{opacity:0.7} }
@keyframes bcl-wiggle      { 0%,100%{transform:rotate(-8deg)} 50%{transform:rotate(8deg)} }
`
const ALL_KEYFRAMES = buildKeyframesCSS('bcl') + '\n' + EXTRA_KF

interface BookCoverLivePreviewProps {
  skinId?: string
  coverImageUrl: string
  overlays?: OverlayObject[]
  coverLayout?: CoverLayout | null
  title?: string
  showPromptButton?: boolean
  className?: string
  style?: React.CSSProperties
  overlayBaseSize?: number
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

  useEffect(() => {
    if (stylesInjected.current || typeof document === 'undefined') return
    if (document.getElementById('bcl-keyframes')) { stylesInjected.current = true; return }
    const el = document.createElement('style')
    el.id = 'bcl-keyframes'
    el.textContent = ALL_KEYFRAMES
    document.head.appendChild(el)
    stylesInjected.current = true
  }, [])

  useEffect(() => {
    if (overlaysProp !== undefined) { setOverlays(overlaysProp); return }
    if (!skinId || skinId === fetchedForId) return
    const supabase = createClient()
    supabase.from('book_skin_overlays').select('*').eq('skin_id', skinId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => { setOverlays(data ?? []); setFetchedForId(skinId) })
  }, [skinId, overlaysProp, fetchedForId])

  const titleLayout = coverLayout?.title
  const promptLayout = coverLayout?.prompt

  return (
    <div className={className} style={{ overflow: 'hidden', ...style }} onClick={onClick}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={coverImageUrl} alt="Book cover"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        draggable={false} />

      {overlays.map((obj) => {
        const cfg = obj.overlay_config
        if (!cfg) return null
        const sz = overlayWidthPct(cfg.scale ?? 1.0)

        if ((cfg as any).animation === 'burst' && (cfg as any).burst?.polygon?.length >= 3) {
          return (
            <OverlayBurstRenderer key={obj.id} imageUrl={obj.image_url}
              containerWidthPx={480} scale={cfg.scale ?? 1.0}
              speed={(cfg as any).speed ?? 1.0} burst={(cfg as any).burst}
              style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, transform: 'translate(-50%,-50%)' }} />
          )
        }

        const anim = cfg.animation && cfg.animation !== 'none' ? buildAnimCSS(cfg.animation, 'bcl', (cfg as any).speed ?? 1.0) : undefined
        const transformOrigin = getTransformOrigin(cfg.animation ?? 'none')
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={obj.id} src={obj.image_url} alt={obj.label} draggable={false}
            style={{ position: 'absolute', left: `${cfg.x}%`, top: `${cfg.y}%`, width: sz, height: sz,
              objectFit: 'contain', transform: 'translate(-50%, -50%)', animation: anim, transformOrigin, pointerEvents: 'none' }} />
        )
      })}

      {title && (
        <div className="absolute text-center px-4 w-full"
          style={{ left: `${titleLayout?.x ?? 50}%`, top: `${titleLayout?.y ?? 22}%`, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
          <h2 className="font-bold leading-snug"
            style={{ fontSize: titleLayout?.fontSize ?? 20, color: titleLayout?.color ?? '#2d1a00',
              fontFamily: '"Georgia","Times New Roman",serif',
              textShadow: (titleLayout?.shadow ?? true) ? '0 1px 8px rgba(255,255,255,0.6),0 0 16px rgba(0,0,0,0.4)' : undefined,
              letterSpacing: '0.04em' }}>
            {title}
          </h2>
        </div>
      )}

      {showPromptButton && (
        <div className="absolute flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap"
          style={{ left: `${promptLayout?.x ?? 50}%`, top: `${promptLayout?.y ?? 82}%`, transform: 'translate(-50%, -50%)',
            fontSize: promptLayout?.fontSize ?? 14, color: promptLayout?.color ?? 'rgba(240,215,140,0.97)',
            textShadow: '0 1px 4px rgba(0,0,0,0.8)', background: 'rgba(40,25,5,0.72)', border: '1px solid rgba(200,160,60,0.55)',
            backdropFilter: 'blur(6px)', animation: 'bcl-pulse-glow 2.5s ease-in-out infinite', pointerEvents: 'none' }}>
          <span style={{ animation: 'bcl-wiggle 2s ease-in-out infinite', display: 'inline-block' }}>📜</span>
          <span style={{ letterSpacing: '0.06em' }}>Open the Book</span>
        </div>
      )}
    </div>
  )
}
