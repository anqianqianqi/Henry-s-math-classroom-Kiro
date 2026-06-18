'use client'

// InlinePet — a non-floating, in-page version of the pet for the dashboard pet area.
// Renders the pet cat image anchored to the bottom of its container.
// No drag, no fixed positioning — it scrolls with the page naturally.

import { useEffect, useState } from 'react'
import DidiSvg, { type DidiStage } from './DidiSvg'

interface PetStatus {
  hasPet: boolean
  isEgg?: boolean
  stage?: string
  petName?: string | null
  xp?: number | null
}

export default function InlinePet() {
  const [status, setStatus] = useState<PetStatus | null>(null)

  useEffect(() => {
    fetch('/api/pet/status')
      .then(r => r.json())
      .then((d: PetStatus) => setStatus(d))
      .catch(() => setStatus({ hasPet: false }))

    function handleRefresh() {
      fetch('/api/pet/status')
        .then(r => r.json())
        .then((d: PetStatus) => setStatus(d))
        .catch(() => {})
    }
    window.addEventListener('didi-pet-refresh', handleRefresh)
    return () => window.removeEventListener('didi-pet-refresh', handleRefresh)
  }, [])

  if (!status?.hasPet) return null

  const stage = (status.stage ?? 'adult') as DidiStage
  const size = 120

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {/* Name tag */}
      {status.petName && (
        <div style={{
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: '#a07060',
          letterSpacing: '0.05em',
          marginBottom: 2,
          fontFamily: 'system-ui, sans-serif',
          opacity: 0.85,
        }}>
          {status.petName} 🐾
        </div>
      )}
      <DidiSvg
        pose={status.isEgg ? 'idle' : 'sleeping'}
        stage={status.isEgg ? 'egg' : stage}
        size={size}
        facingLeft={false}
      />
    </div>
  )
}
