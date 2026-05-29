// components/desktop-pet/DidiSvg.tsx
// Image-based Didi renderer.
// Each pose maps to a PNG file in /public/didi/.
// Falls back to a placeholder cat emoji if the image hasn't been added yet.
//
// HOW TO ADD REAL DIDI IMAGES:
//   1. Generate images using the AI prompt in /public/didi/GENERATE_IMAGES.md
//   2. Save them as PNG with transparent background to /public/didi/
//   3. The component will automatically use them.

'use client'

import React, { useState } from 'react'

export type DidiPose = 'idle' | 'sleeping' | 'yawning' | 'playing' | 'walking'

interface DidiSvgProps {
  pose: DidiPose
  size?: number
  className?: string
  facingLeft?: boolean
  style?: React.CSSProperties
}

// Map each pose to its image file
const POSE_IMAGES: Record<DidiPose, string> = {
  idle:     '/didi/didi-idle.png',
  sleeping: '/didi/didi-sleeping.png',
  yawning:  '/didi/didi-yawning.png',
  playing:  '/didi/didi-playing.png',
  walking:  '/didi/didi-walking.png',
}

// Accessible labels
const POSE_LABELS: Record<DidiPose, string> = {
  idle:     'Didi sitting and looking at you',
  sleeping: 'Didi sleeping in a loaf',
  yawning:  'Didi yawning with mouth wide open',
  playing:  'Didi batting at a toy',
  walking:  'Didi walking',
}

export default function DidiSvg({ pose, size = 120, className, facingLeft = false, style }: DidiSvgProps) {
  const [imgError, setImgError] = useState(false)
  const src = POSE_IMAGES[pose]

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    display: 'inline-flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    transform: facingLeft ? 'scaleX(-1)' : undefined,
    ...style,
  }

  if (imgError) {
    // Fallback: emoji placeholder until real images are added
    const FALLBACK_EMOJI: Record<DidiPose, string> = {
      idle:     '🐱',
      sleeping: '😴',
      yawning:  '🥱',
      playing:  '🐾',
      walking:  '🐈',
    }
    return (
      <div
        style={{ ...containerStyle, fontSize: size * 0.7, lineHeight: 1 }}
        className={className}
        role="img"
        aria-label={POSE_LABELS[pose]}
        title={POSE_LABELS[pose]}
      >
        {FALLBACK_EMOJI[pose]}
      </div>
    )
  }

  return (
    <div style={containerStyle} className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={POSE_LABELS[pose]}
        width={size}
        height={size}
        style={{ objectFit: 'contain', objectPosition: 'bottom', display: 'block' }}
        onError={() => setImgError(true)}
        draggable={false}
      />
    </div>
  )
}
