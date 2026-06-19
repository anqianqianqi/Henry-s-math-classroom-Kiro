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

import { useId } from 'react'
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
    animationDirection: (zone.animation === 'shimmer' || zone.animation === 'float' || zone.animation === 'sway') ? 'alternate' : 'normal',
    transformOrigin: `${pxv}% ${pyv}%`,
    willChange: 'transform, opacity',
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
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            {zones.map((zone, i) => {
              const id = `clip_${baseId}_${i}`
              const pts = zone.polygon.map(p => `${p.x}% ${p.y}%`).join(', ')
              return (
                <clipPath key={id} id={id} clipPathUnits="objectBoundingBox">
                  <polygon points={
                    zone.polygon.map(p => `${(p.x / 100).toFixed(4)},${(p.y / 100).toFixed(4)}`).join(' ')
                  } />
                </clipPath>
              )
            })}
          </defs>
        </svg>

        {zones.map((zone, i) => {
          const clipId = `clip_${baseId}_${i}`
          const animId = `${baseId}_${i}`

          if (zone.containOverflow) {
            // "Contain overflow" mode — three layers:
            // 1. Static base img inside the clipped div (fills gaps when animated layer moves away)
            // 2. Animated img on top (moves freely within the clipped window)
            // The parent div is clipped to the polygon, so nothing shows outside it.
            // When the animated img shifts left, the right edge shows the static base img.
            return (
              <div
                key={clipId}
                className="absolute inset-0"
                style={{ clipPath: `url(#${clipId})`, overflow: 'hidden', zIndex: 1 }}
              >
                {/* Static base — fills any gaps left by animation */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ zIndex: 1 }}
                />
                {/* Animated layer on top — moves freely, shows static when it shifts away */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ zIndex: 2, ...getAnimStyle(animId, zone) }}
                />
              </div>
            )
          }

          // Default mode: animated img clipped to polygon (overflow shows as shifted background)
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={clipId}
              src={imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                clipPath: `url(#${clipId})`,
                ...getAnimStyle(animId, zone),
              }}
            />
          )
        })}
      </div>
    </>
  )
}
