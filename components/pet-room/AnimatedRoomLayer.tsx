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
