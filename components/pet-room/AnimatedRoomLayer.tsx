'use client'

import React, { useEffect, useRef, useId } from 'react'
import type { AnimZone } from './AnimationZoneEditor'

interface Props {
  imageUrl: string
  zones: AnimZone[]
  className?: string
}

// ── Canvas-based zone renderer (sway / float) ─────────────────────────────
// Uses requestAnimationFrame to draw per-frame:
//   1. Fill the ORIGINAL polygon with fillColor (or static image if containOverflow)
//   2. Apply animation transform (rotate/translateY), clip to polygon in that
//      transformed space, draw background image → this is the "new polygon"
// The gap between original and new polygon correctly shows the fill color.

interface ZoneCanvasProps {
  imageUrl: string
  zone: AnimZone
  containerWidth: number
  containerHeight: number
}

function ZoneCanvas({ imageUrl, zone, containerWidth, containerHeight }: ZoneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img }
    img.src = imageUrl
    return () => { imgRef.current = null }
  }, [imageUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = containerWidth
    canvas.height = containerHeight

    const duration = 3000 / zone.speed
    const startTime = performance.now()
    const s = zone.intensity
    const pivotX = (zone.pivot.x / 100) * containerWidth
    const pivotY = (zone.pivot.y / 100) * containerHeight

    const polyPx = zone.polygon.map(p => ({
      x: (p.x / 100) * containerWidth,
      y: (p.y / 100) * containerHeight,
    }))

    function getAnimValue(t: number): number {
      const cycle = (t % 1 + 1) % 1
      const ease = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2
      const eased = ease < 0.5 ? 2 * ease * ease : -1 + (4 - 2 * ease) * ease
      switch (zone.animation) {
        case 'sway':  return (eased - 0.5) * 2 * s * 3
        case 'float': return (eased - 0.5) * 2 * (-s * 6)
        default:      return 0
      }
    }

    function drawPoly(ctx: CanvasRenderingContext2D) {
      polyPx.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
    }

    function draw(now: number) {
      const ctx = canvas!.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, containerWidth, containerHeight)

      const val = getAnimValue((now - startTime) / duration)

      if (zone.containOverflow) {
        // CONTAINED mode: everything is strictly within the original polygon.
        // Outside the original polygon → always shows the real background (unaffected).
        // Inside the original polygon → fill color base + animated image on top.
        ctx.save()
        // Hard outer boundary: nothing ever paints outside the original polygon
        ctx.beginPath()
        drawPoly(ctx)
        ctx.closePath()
        ctx.clip()

        // Base: fill color (or static image) covers the whole clipped area
        if (zone.fillColor) {
          ctx.fillStyle = zone.fillColor
          ctx.fillRect(0, 0, containerWidth, containerHeight)
        } else if (imgRef.current) {
          ctx.drawImage(imgRef.current, 0, 0, containerWidth, containerHeight)
        }

        // Animated image on top, also constrained by the outer clip
        if (imgRef.current) {
          ctx.save()
          ctx.translate(pivotX, pivotY)
          if (zone.animation === 'sway')  ctx.rotate((val * Math.PI) / 180)
          if (zone.animation === 'float') ctx.translate(0, val)
          ctx.translate(-pivotX, -pivotY)
          ctx.beginPath()
          drawPoly(ctx)
          ctx.closePath()
          ctx.clip()
          ctx.drawImage(imgRef.current, 0, 0, containerWidth, containerHeight)
          ctx.restore()
        }

        ctx.restore()

      } else {
        // NOT CONTAINED mode: animated polygon can move outside the original boundary.
        // Fill shows in original polygon area not covered by animated polygon.
        // Animated image can bleed outside original polygon.

        // 1. Draw fill on the original fixed polygon
        if (zone.fillColor) {
          ctx.save()
          ctx.beginPath()
          drawPoly(ctx)
          ctx.closePath()
          ctx.clip()
          ctx.fillStyle = zone.fillColor
          ctx.fillRect(0, 0, containerWidth, containerHeight)
          ctx.restore()
        }

        // 2. Draw animated image clipped to the transformed (new) polygon
        if (imgRef.current) {
          ctx.save()
          ctx.translate(pivotX, pivotY)
          if (zone.animation === 'sway')  ctx.rotate((val * Math.PI) / 180)
          if (zone.animation === 'float') ctx.translate(0, val)
          ctx.translate(-pivotX, -pivotY)
          ctx.beginPath()
          drawPoly(ctx)
          ctx.closePath()
          ctx.clip()
          ctx.drawImage(imgRef.current, 0, 0, containerWidth, containerHeight)
          ctx.restore()
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [zone, containerWidth, containerHeight])

  return (
    <canvas
      ref={canvasRef}
      width={containerWidth}
      height={containerHeight}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none' }}
    />
  )
}

// ── CSS animation layer (shimmer / flicker / bling / glow) ────────────────

function getCssKeyframes(id: string, zone: AnimZone): string {
  const s = zone.intensity
  switch (zone.animation) {
    case 'shimmer':
      return `@keyframes anim_${id}{0%{opacity:1}50%{opacity:${1-s*0.3}}100%{opacity:1}}`
    case 'flicker':
      return `@keyframes anim_${id}{0%{opacity:1}10%{opacity:${1-s*0.4}}20%{opacity:1}50%{opacity:${1-s*0.2}}60%{opacity:1}90%{opacity:${1-s*0.5}}100%{opacity:1}}`
    case 'bling':
      return `@keyframes anim_${id}{0%{filter:hue-rotate(0deg) brightness(1)}20%{filter:hue-rotate(${s*72}deg) brightness(${1+s*0.4})}40%{filter:hue-rotate(${s*144}deg) brightness(1)}60%{filter:hue-rotate(${s*216}deg) brightness(${1+s*0.5})}80%{filter:hue-rotate(${s*288}deg) brightness(1)}100%{filter:hue-rotate(${s*360}deg) brightness(1)}}`
    case 'glow':
      return `@keyframes anim_${id}{0%{filter:brightness(1)}100%{filter:brightness(${1+s*0.8})}}`
    default:
      return ''
  }
}

function getCssAnimStyle(id: string, zone: AnimZone): React.CSSProperties {
  return {
    animationName: `anim_${id}`,
    animationDuration: `${(3 / zone.speed).toFixed(2)}s`,
    animationTimingFunction: zone.animation === 'flicker' ? 'steps(1)' : 'ease-in-out',
    animationIterationCount: 'infinite',
    animationDirection: zone.animation === 'bling' ? 'normal' : 'alternate',
    willChange: (zone.animation === 'bling' || zone.animation === 'glow') ? 'filter' : 'opacity',
  }
}

// ── Main component ─────────────────────────────────────────────────────────

const CANVAS_ANIMS: AnimZone['animation'][] = ['sway', 'float']

export default function AnimatedRoomLayer({ imageUrl, zones, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState({ w: 0, h: 0 })
  const baseId = useId().replace(/:/g, '_')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!zones || zones.length === 0) return null

  const cssZones = zones.filter(z => !CANVAS_ANIMS.includes(z.animation))
  const styleContent = cssZones.map((z, i) => getCssKeyframes(`${baseId}_${i}`, z)).join('\n')

  return (
    <>
      {styleContent && <style dangerouslySetInnerHTML={{ __html: styleContent }} />}
      <div
        ref={containerRef}
        className={`absolute inset-0 pointer-events-none ${className}`}
        aria-hidden="true"
      >
        {/* Canvas zones: sway / float — true gap filling via per-frame canvas draw */}
        {size.w > 0 && zones
          .filter(z => CANVAS_ANIMS.includes(z.animation))
          .map(zone => (
            <ZoneCanvas
              key={zone.id}
              imageUrl={imageUrl}
              zone={zone}
              containerWidth={size.w}
              containerHeight={size.h}
            />
          ))
        }

        {/* CSS zones: shimmer / flicker / bling / glow */}
        {cssZones.map((zone, i) => {
          const id = `${baseId}_${i}`
          const poly = `polygon(${zone.polygon.map(p => `${p.x.toFixed(3)}% ${p.y.toFixed(3)}%`).join(', ')})`
          return (
            <div
              key={zone.id}
              className="absolute inset-0"
              style={{ clipPath: poly, ...getCssAnimStyle(id, zone) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            </div>
          )
        })}
      </div>
    </>
  )
}
