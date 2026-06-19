'use client'

// AnimatedRoomLayer — renders animated zones on top of a pet room background.
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
    // alternate = plays forward then backward → perfectly smooth loop with no stutter
    // sway and float both benefit from alternate direction
    // bling uses normal (full 360° hue cycle is already seamless at endpoints)
    animationDirection: zone.animation === 'bling' ? 'normal' : (zone.animation === 'shimmer' || zone.animation === 'float' || zone.animation === 'sway' || zone.animation === 'glow') ? 'alternate' : 'normal',
    transformOrigin: `${pxv}% ${pyv}%`,
    willChange: (zone.animation === 'bling' || zone.animation === 'glow') ? 'filter' : 'transform, opacity',
  }
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

          // Use CSS clip-path polygon() directly — avoids SVG clipPath + compositing
          // layer issues where will-change/transform on a child can escape a parent's
          // SVG clipPath in GPU-composited rendering.
          const polygonCss = `polygon(${zone.polygon.map(p => `${p.x.toFixed(2)}% ${p.y.toFixed(2)}%`).join(', ')})`

          // Outset polygon for the fill layer — expands each vertex outward from centroid
          // by ~1%. Covers any background pixels right at the polygon edge so they never
          // peek through, regardless of sub-pixel rounding at the clip boundary.
          const cx = zone.polygon.reduce((s, p) => s + p.x, 0) / zone.polygon.length
          const cy = zone.polygon.reduce((s, p) => s + p.y, 0) / zone.polygon.length
          const OUTSET = 1.0   // % outward — enough to cover edge pixels
          const INSET  = 0.3   // % inward  — animated layer stays just inside fill
          const outsetPolygonCss = `polygon(${zone.polygon.map(p => {
            const dx = p.x - cx; const dy = p.y - cy
            const len = Math.hypot(dx, dy) || 1
            return `${(p.x + (dx / len) * OUTSET).toFixed(3)}% ${(p.y + (dy / len) * OUTSET).toFixed(3)}%`
          }).join(', ')})`
          const insetPolygonCss = `polygon(${zone.polygon.map(p => {
            const dx = p.x - cx; const dy = p.y - cy
            const len = Math.hypot(dx, dy) || 1
            return `${(p.x - (dx / len) * INSET).toFixed(3)}% ${(p.y - (dy / len) * INSET).toFixed(3)}%`
          }).join(', ')})`

          // Fill layer uses OUTSET polygon — bleeds slightly outside the exact boundary
          // so it covers any background edge pixels that would otherwise show through.
          // Animated layer uses INSET polygon — stays slightly inside the fill zone.
          const staticFill = zone.fillColor ? (
            <div
              key={`${clipId}_fill`}
              className="absolute inset-0"
              style={{ clipPath: outsetPolygonCss, backgroundColor: zone.fillColor }}
            />
          ) : zone.containOverflow ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${clipId}_static`}
              src={imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ clipPath: outsetPolygonCss }}
            />
          ) : null

          return (
            <React.Fragment key={clipId}>
              {staticFill}
              {/* Clip wrapper — full polygon, never transforms */}
              <div
                className="absolute inset-0"
                style={{ clipPath: insetPolygonCss }}
              >
                {/* Animated image — transforms freely, hard-clipped by inset polygon */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={getAnimStyle(animId, zone)}
                />
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </>
  )
}
