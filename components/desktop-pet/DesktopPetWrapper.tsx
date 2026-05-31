// components/desktop-pet/DesktopPetWrapper.tsx
//
// Fetches the student's pet status on mount, then renders:
//   - Student's own evolving pet (Didi at the correct stage) if logged in as student
//   - Didi the adult mascot if teacher/admin or not logged in
//
// SSR-safe: uses dynamic import with ssr:false.

'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import type { DidiStage } from './DidiSvg'

const DesktopPet = dynamic(() => import('./DesktopPet'), { ssr: false })

interface PetStatus {
  hasPet: boolean
  isEgg?: boolean
  stage?: string
  petName?: string | null
  happiness?: number | null
  hunger?: number | null
  streak?: number | null
}

export default function DesktopPetWrapper() {
  const [status, setStatus] = useState<PetStatus | null>(null)

  useEffect(() => {
    // Check sessionStorage cache first (60s TTL)
    const cached = sessionStorage.getItem('pet_status_cache')
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < 60_000) {
          setStatus(data)
          return
        }
      } catch { /* ignore */ }
    }

    fetch('/api/pet/status')
      .then(r => r.json())
      .then((data: PetStatus) => {
        setStatus(data)
        sessionStorage.setItem('pet_status_cache', JSON.stringify({ data, ts: Date.now() }))
      })
      .catch(() => {
        // On error, fall back to Didi mascot
        setStatus({ hasPet: false })
      })
  }, [])

  // Still loading — render nothing (avoids flash)
  if (status === null) return null

  // Not logged in or no pet yet → show nothing
  if (!status.hasPet) {
    return null
  }

  // Student with egg → show egg
  if (status.isEgg) {
    return <DesktopPet petStage="egg" petName={status.petName ?? undefined} />
  }

  // Student with hatched pet → show at correct stage
  const stage = (status.stage ?? 'adult') as DidiStage
  return (
    <DesktopPet
      petStage={stage}
      petName={status.petName ?? undefined}
      happiness={status.happiness ?? undefined}
      hunger={status.hunger ?? undefined}
      streak={status.streak ?? undefined}
    />
  )
}
