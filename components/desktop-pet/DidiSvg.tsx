// components/desktop-pet/DidiSvg.tsx
//
// Stage-aware image renderer for the desktop pet widget.
//
// For students: shows their own pet (Didi) at the correct evolution stage.
// Image naming convention: /public/didi/{stage}-{pose}.png
//   e.g. didi-baby-idle.png, didi-teen-sleeping.png, didi-legendary-playing.png
//   Adult stage uses the original names: didi-idle.png, didi-sleeping.png, etc.
//
// Falls back gracefully:
//   1. Try stage-specific image (e.g. didi-teen-idle.png)
//   2. Fall back to adult image (e.g. didi-idle.png)
//   3. Fall back to emoji if neither loads

'use client'

import React, { useState, useEffect } from 'react'

export type DidiPose = 'idle' | 'sleeping' | 'yawning' | 'playing' | 'walking'
export type DidiStage = 'egg' | 'baby' | 'teen' | 'adult'

interface DidiSvgProps {
  pose: DidiPose
  stage?: DidiStage   // defaults to 'adult' for backward compat
  size?: number
  className?: string
  facingLeft?: boolean
  style?: React.CSSProperties
}

// Accessible labels
const POSE_LABELS: Record<DidiPose, string> = {
  idle:     'Didi sitting and looking at you',
  sleeping: 'Didi sleeping',
  yawning:  'Didi yawning',
  playing:  'Didi playing',
  walking:  'Didi walking',
}

const STAGE_LABELS: Record<DidiStage, string> = {
  egg:       'Didi egg',
  baby:      'Baby Didi',
  teen:      'Teen Didi',
  adult:     'Didi',
}

// Fallback emoji per pose
const FALLBACK_EMOJI: Record<DidiPose, string> = {
  idle:     '🐱',
  sleeping: '😴',
  yawning:  '🥱',
  playing:  '🐾',
  walking:  '🐈',
}

function getImageSrc(stage: DidiStage, pose: DidiPose): string {
  if (stage === 'egg') return '/didi/ai/didi-egg.png'
  if (stage === 'adult') return `/didi/ai/didi-${pose}.png`
  return `/didi/ai/didi-${stage}-${pose}.png`
}

function getAdultFallbackSrc(pose: DidiPose): string {
  return `/didi/ai/didi-${pose}.png`
}

export default function DidiSvg({
  pose,
  stage = 'adult',
  size = 120,
  className,
  facingLeft = false,
  style,
}: DidiSvgProps) {
  const [triedStage, setTriedStage] = useState(false)
  const [triedAdult, setTriedAdult] = useState(false)

  // Reset fallback state whenever stage or pose changes so new images are tried fresh
  useEffect(() => {
    setTriedStage(false)
    setTriedAdult(false)
  }, [stage, pose])

  const primarySrc = getImageSrc(stage, pose)
  const adultFallback = getAdultFallbackSrc(pose)

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    display: 'inline-flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    transform: facingLeft ? 'scaleX(-1)' : undefined,
    ...style,
  }

  // Both fallbacks exhausted — show emoji
  if (triedAdult) {
    return (
      <div
        style={{ ...containerStyle, fontSize: size * 0.7, lineHeight: 1 }}
        className={className}
        role="img"
        aria-label={`${STAGE_LABELS[stage]} — ${POSE_LABELS[pose]}`}
      >
        {FALLBACK_EMOJI[pose]}
      </div>
    )
  }

  const currentSrc = triedStage ? adultFallback : primarySrc

  return (
    <div style={containerStyle} className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentSrc}
        alt={`${STAGE_LABELS[stage]} — ${POSE_LABELS[pose]}`}
        width={size}
        height={size}
        style={{ objectFit: 'contain', objectPosition: 'bottom', display: 'block' }}
        onError={() => {
          if (!triedStage) {
            setTriedStage(true)   // try adult fallback next
          } else {
            setTriedAdult(true)   // give up, show emoji
          }
        }}
        draggable={false}
      />
    </div>
  )
}
