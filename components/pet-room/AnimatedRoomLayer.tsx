'use client'

import React, { useEffect, useRef, useId } from 'react'
import type { AnimZone } from './AnimationZoneEditor'

interface Props {
  imageUrl: string
  zones: AnimZone[]
  className?: string
}

// ── Canvas-based zone renderer ─────────────────────────────────────────────
// Each zone is rendered on a <canvas> that matches the container size.
// Per frame we:
//   1. Clear the canvas
//   2. Fill the original polygon with fillColor (or skip if none)
//   3. Draw the background image clipped to the ANIMATED polygon on top
// This gives a true "original polygon minus animated polygon = fill color" effect.

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

    const duration = (3000 / zone.speed)
    const startTime = performance.now()
    const s = zone.intensity
    const pivotX = (zone.pivot.x / 100) * containerWidth
    const pivotY = (zone.pivot.y / 100) * containerHeight

    // Convert polygon % coords to canvas px
    const polyPx = zone.polygon.map(p => ({
      x: (p.x / 100) * containerWidth,
      y: (p.y / 100) * containerHeight,
    }))

    function getAnimValue(t: number): number {
      // t in [0,1], alternate easing → ping-pong
      const cycle = (t % 1 + 1) % 1
      const ease = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2
      // ease-in-out
      const eased = ease < 0.5 ? 2 * ease * ease : -1 + (4 - 2 * ease) * ease
      switch (zone.animation) {
        case 'sway':   return (eased - 0.5) * 2 * s * 3   // degrees
        case 'float':  return (eased - 0.5) * 2 * (-s * 6) // px
        default:       return 0
      }
    }

    function draw(now: number) {
      const ctx = canvas!.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, containerWidth, containerHeight)

      const elapsed = now - startTime
      const t = elapsed / duration
      const val = getAnimValue(t)

      // 1. Draw fill color for the original polygon (always fixed)
      if (zone.fillColor || zone.containOverflow) {
        ctx.save()
        ctx.beginPath()
        polyPx.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
        ctx.closePath()
        ctx.clip()
        if (zone.fillColor) {
          ctx.fillStyle = zone.fillColor
          ctx.fillRect(0, 0, containerWidth, containerHeight)
        } else if (zone.containOverflow && imgRef.current) {
          ctx.drawImage(imgRef.current, 0, 0, containerWidth, containerHeight)
        }
        ctx.restore()
      }

      // 2. Draw animated image clipped to the TRANSFORMED polygon
      if (imgRef.current) {
        ctx.save()
        // Apply animation transform centered on pivot
        ctx.translate(pivotX, pivotY)
        if (zone.animation === 'sway') {
          ctx.rotate((val * Math.PI) / 180)
        } else if (zone.animation === 'float') {
          ctx.translate(0, val)
        }
        ctx.translate(-pivotX, -pivotY)

        // Clip to the polygon (in transformed space = the animated polygon)
        ctx.beginPath()
        polyPx.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
        ctx.closePath()
        ctx.clip()

        // Draw background image (untransformed coordinates — image moves with transform)
        ctx.drawImage(imgRef.current, 0, 0, containerWidth, containerHeight)
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [zone, containerWidth, containerHeight])

  // For non-transform animations (shimmer, flicker, bling, glow) fall back to CSS
  if (!['sway', 'float'].includes(zone.animation)) {
    return null  // handled by CSS layer below
  }

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

// ── CSS animation layer (shimmer, flicker, bling, glow) ───────────────────

function getKeyframes(id: string, zone: AnimZone): string {
  const s = zone.intensity
  switch (zone.animation) {
    case 'shimmer':
      return `@keyframes anim_${id} { 0%{opacity:1} 50%{opacity:${1-s*0.3}} 100%{opacity:1} }`
    case 'flicker':
      return `@keyframes anim_${id} { 0%{opacity:1} 10%{opacity:${1-s*0.4}} 20%{opacity:1} 50%{opacity:${1-s*0.2}} 60%{opacity:1} 90%{opacity:${1-s*0.5}} 100%{opacity:1} }`
    case 'bling':
      return `@keyframes anim_${id} { 0%{filter:hue-rotate(0deg) brightness(1)} 20%{filter:hue-rotate(${s*72}deg) brightness(${1+s*0.4})} 40%{filter:hue-rotate(${s*144}deg) brightness(1)} 60%{filter:hue-rotate(${s*216}deg) brightness(${1+s*0.5})} 80%{filter:hue-rotate(${s*288}deg) brightness(1)} 100%{filter:hue-rotate(${s*360}deg) brightness(1)} }`
    case 'glow':
      return `@keyframes anim_${id} { 0%{filter:brightness(1)} 100%{filter:brightness(${1+s*0.8})} }`
    default:
      return ''
  }
}

function getCssAnimStyle(id: string, zone: AnimZone): React.CSSProperties {
  const duration = (3 / zone.speed).toFixed(2)
  return {
    animationName: `anim_${id}`,
    animationDuration: `${duration}s`,
    animationTimingFunction: zone.animation === 'flicker' ? 'steps(1)' : 'ease-in-out',
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    willChange: (zone.animation === 'bling' || zone.animation === 'glow') ? 'filter' : 'opacity',
  }
}

// ── Main component ─────────────────────────────────────────────────────────

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

  // CSS keyframes for opacity/filter animations
  const cssAnimZones = zones.filter(z => !['sway', 'float'].includes(z.animation))
  const styleContent = cssAnimZones.map((zone, i) => {
    const id = `${baseId}_css_${i}`
    return getKeyframes(id, zone)
  }).join('\n')

  return (
    <>
      {styleContent && <style dangerouslySetInnerHTML={{ __html: styleContent }} />}
      <div
        ref={containerRef}
        className={`absolute inset-0 pointer-events-none ${className}`}
        aria-hidden="true"
      >
        {/* Canvas-based zones for sway/float (need true gap filling) */}
        {size.w > 0 && zones
          .filter(z => z.animation === 'sway' || z.animation === 'float')
          .map((zone, i) => (
            <ZoneCanvas
              key={zone.id}
              imageUrl={imageUrl}
              zone={zone}
              containerWidth={size.w}
              containerHeight={size.h}
            />
          ))
        }

        {/* CSS-based zones for opacity/filter animations */}
        {cssAnimZones.map((zone, i) => {
          const id = `${baseId}_css_${i}`
          const polygonCss = `polygon(${zone.polygon.map(p => `${p.x.toFixed(3)}% ${p.y.toFixed(3)}%`).join(', ')})`
          return (
            <div
              key={zone.id}
              className="absolute inset-0"
              style={{ clipPath: polygonCss, ...getCssAnimStyle(id, zone) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          )
        })}
      </div>
    </>
  )
}
//
// How it works:
//   - The room background sits below as a normal <img> (or CSS background)
//   - For each animation zone, we place an absolutely-positioned <img> element
//     showing the SAME background image at FULL size, clipped via SVG clipPath
//     to the polygon, and CSS-animated so only that polygon region moves.
//   - The result: everything outside the polygon is static; inside it sways/floats.
//
// Usage:
//   <AnimatedRoomLayer imageUrl="..." zones={zones} />

import React, { useId } from 'react'
import type { AnimZone } from './AnimationZoneEditor'

interface Props {
  imageUrl: string
  zones: AnimZone[]
  className?: string
}

// Generate CSS keyframes per animation type
function getKeyframes(id: string, zone: AnimZone): string {
  const s = zone.intensity
  const pxv = zone.pivot.x  // pivot x as %
  const pyv = zone.pivot.y  // pivot y as %
  const pivotCss = `${pxv}% ${pyv}%`

  switch (zone.animation) {
    case 'sway':
      // Wrapper rotates carrying the clip polygon with it — creates a real gap
      // between original and new polygon position, filled by the fill layer.
      return `
        @keyframes anim_${id} {
          0%   { transform: rotate(${-s * 3}deg); }
          100% { transform: rotate(${s * 3}deg); }
        }
      `
    case 'float':
      return `
        @keyframes anim_${id} {
          0%   { transform: translateY(0px); }
          50%  { transform: translateY(${-s * 6}px); }
          100% { transform: translateY(0px); }
        }
      `
    case 'shimmer':
      return `
        @keyframes anim_${id} {
          0%   { opacity: 1; }
          50%  { opacity: ${1 - s * 0.3}; }
          100% { opacity: 1; }
        }
      `
    case 'flicker':
      return `
        @keyframes anim_${id} {
          0%   { opacity: 1; }
          10%  { opacity: ${1 - s * 0.4}; }
          20%  { opacity: 1; }
          50%  { opacity: ${1 - s * 0.2}; }
          60%  { opacity: 1; }
          90%  { opacity: ${1 - s * 0.5}; }
          100% { opacity: 1; }
        }
      `
    case 'bling':
      // Rainbow hue-shift — cycles through the full color wheel
      // Combined with brightness pulse for a sparkling jewel effect
      return `
        @keyframes anim_${id} {
          0%   { filter: hue-rotate(0deg) brightness(1); }
          20%  { filter: hue-rotate(${s * 72}deg) brightness(${1 + s * 0.4}); }
          40%  { filter: hue-rotate(${s * 144}deg) brightness(1); }
          60%  { filter: hue-rotate(${s * 216}deg) brightness(${1 + s * 0.5}); }
          80%  { filter: hue-rotate(${s * 288}deg) brightness(1); }
          100% { filter: hue-rotate(${s * 360}deg) brightness(1); }
        }
      `
    case 'glow':
      // Brightness pulse — same colour, just gets brighter then dimmer
      return `
        @keyframes anim_${id} {
          0%   { filter: brightness(1); }
          100% { filter: brightness(${1 + s * 0.8}); }
        }
      `
  }
}

function getAnimStyle(id: string, zone: AnimZone): React.CSSProperties {
  const duration = (3 / zone.speed).toFixed(2)
  const pxv = zone.pivot.x
  const pyv = zone.pivot.y
  return {
    animationName: `anim_${id}`,
    animationDuration: `${duration}s`,
    animationTimingFunction: zone.animation === 'flicker' ? 'steps(1)' : 'ease-in-out',
    animationIterationCount: 'infinite',
    animationDirection: zone.animation === 'bling' ? 'normal' : (zone.animation === 'shimmer' || zone.animation === 'float' || zone.animation === 'sway' || zone.animation === 'glow') ? 'alternate' : 'normal',
    transformOrigin: `${pxv}% ${pyv}%`,
    willChange: (zone.animation === 'bling' || zone.animation === 'glow') ? 'filter' : 'transform, opacity',
  }
}

// For animations that transform the whole polygon region (sway, float),
// we apply the SAME animation to BOTH the wrapper div (which carries the
// clip-path) AND the image inside it.
// - The wrapper's clip polygon co-moves with the content, creating the gap
//   between original polygon and new polygon position.
// - The image also animates, showing the actual swaying/floating visual.
// - Fill layer underneath shows through the gap with the user's chosen color.
function getWrapperAnimStyle(id: string, zone: AnimZone): React.CSSProperties | null {
  if (zone.animation === 'sway' || zone.animation === 'float') {
    return getAnimStyle(id, zone)
  }
  return null
}

function getImageAnimStyle(id: string, zone: AnimZone): React.CSSProperties {
  // For all animations: apply directly to the image.
  // For sway/float: same animation also on the wrapper — both move together.
  return getAnimStyle(id, zone)
}

export default function AnimatedRoomLayer({ imageUrl, zones, className = '' }: Props) {
  const baseId = useId().replace(/:/g, '_')

  if (!zones || zones.length === 0) return null

  const styleContent = zones.map((zone, i) => {
    const id = `${baseId}_${i}`
    return getKeyframes(id, zone)
  }).join('\n')

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styleContent }} />
      <div className={`absolute inset-0 pointer-events-none ${className}`} aria-hidden="true">

        {zones.map((zone, i) => {
          const clipId = `clip_${baseId}_${i}`
          const animId = `${baseId}_${i}`

          // Exact polygon for both fill and animated layers.
          // Fill layer: exact polygon, solid color, never moves → always visible where
          //             the animated image has shifted away.
          // Animated layer: exact polygon clip, transforms freely on top.
          // Where animated image covers fill → you see the animation.
          // Where animated image moves away  → fill color shows through.
          const polygonCss = `polygon(${zone.polygon.map(p => `${p.x.toFixed(3)}% ${p.y.toFixed(3)}%`).join(', ')})`

          const staticFill = zone.fillColor ? (
            <div
              key={`${clipId}_fill`}
              className="absolute inset-0"
              style={{ clipPath: polygonCss, backgroundColor: zone.fillColor }}
            />
          ) : zone.containOverflow ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${clipId}_static`}
              src={imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ clipPath: polygonCss }}
            />
          ) : null

          return (
            <React.Fragment key={clipId}>
              {staticFill}
              {/* Animated wrapper — clip polygon rotates/moves WITH the content.
                  This creates the correct gap: original polygon minus rotated polygon
                  = region where fill color shows through. */}
              <div
                className="absolute inset-0"
                style={{
                  clipPath: polygonCss,
                  ...(getWrapperAnimStyle(animId, zone) ?? {}),
                }}
              >
                {/* Image counter-animates to stay aligned with the background.
                    For opacity/filter animations, the normal animation applies here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={getImageAnimStyle(animId, zone)}
                />
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </>
  )
}
