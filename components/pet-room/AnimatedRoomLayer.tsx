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
            // "Contain overflow" mode:
            // The problem with putting clipPath on a parent div is that CSS transforms
            // on children happen AFTER layout — the clip stays fixed while the image
            // moves, so gaps appear that show the underlying background instead of
            // the static fill.
            //
            // Correct approach: both images get the polygon clipPath directly.
            // - Layer A (static): always fills the full polygon, never moves.
            //   If fillColor is set, use a lightweight SVG polygon instead of a full image copy.
            // - Layer B (animated): same polygon clip, animates on top.
            // Any gap the animated image leaves behind is covered by Layer A.
            const staticLayer = zone.fillColor ? (
              // Solid color fill — lightweight, no extra image load
              <svg
                key={`${clipId}_fill`}
                className="absolute inset-0 w-full h-full"
                style={{ overflow: 'visible' }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <polygon
                  points={zone.polygon.map(p => `${p.x},${p.y}`).join(' ')}
                  fill={zone.fillColor}
                />
              </svg>
            ) : (
              // Full static image copy as fallback
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${clipId}_static`}
                src={imageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ clipPath: `url(#${clipId})` }}
              />
            )

            return (
              <React.Fragment key={clipId}>
                {staticLayer}
                {/* Animated layer — same clip, moves freely; static shows through any gap */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ clipPath: `url(#${clipId})`, ...getAnimStyle(animId, zone) }}
                />
              </React.Fragment>
            )
          }

          // Default mode: animated img clipped to polygon (overflow shows as shifted background).
          // If fillColor is set, also render a solid fill polygon underneath so gaps show the
          // chosen color rather than whatever the underlying layer happens to be.
          return (
            <React.Fragment key={clipId}>
              {zone.fillColor && (
                <svg
                  className="absolute inset-0 w-full h-full"
                  style={{ overflow: 'visible' }}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <polygon
                    points={zone.polygon.map(p => `${p.x},${p.y}`).join(' ')}
                    fill={zone.fillColor}
                  />
                </svg>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  clipPath: `url(#${clipId})`,
                  ...getAnimStyle(animId, zone),
                }}
              />
            </React.Fragment>
          )
        })}
      </div>
    </>
  )
}
