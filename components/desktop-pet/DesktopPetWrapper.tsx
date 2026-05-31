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
  const [cracking, setCracking] = useState(false)
  const [crackError, setCrackError] = useState<string | null>(null)

  async function pickSpecies(species: 'dragon' | 'fox' | 'cat') {
    setCracking(true)
    setCrackError(null)
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { error } = await supabase
        .from('student_pets')
        .update({ species, evolution_stage: 'baby', xp: 0, equipped_accessories: [] })
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')

      if (error) throw error

      // Invalidate cache and re-fetch
      sessionStorage.removeItem('pet_status_cache')
      const res = await fetch('/api/pet/status')
      const data: PetStatus = await res.json()
      setStatus(data)
      sessionStorage.setItem('pet_status_cache', JSON.stringify({ data, ts: Date.now() }))
    } catch {
      setCrackError('Something went wrong. Try again.')
    } finally {
      setCracking(false)
    }
  }

  useEffect(() => {
    // Check sessionStorage cache first (60s TTL)
    const cached = sessionStorage.getItem('pet_status_cache')
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < 60_000) {
          setStatus(data)
          // Still fire login XP in background even if we have cached status
          // (idempotent — safe to call multiple times per day)
          grantDailyLoginXp()
          return
        }
      } catch { /* ignore */ }
    }

    // Grant daily login XP first (creates the student_pets row if needed),
    // then fetch status so we always see the egg on first login.
    // Use Promise.allSettled-style: always fetch status even if XP grant fails
    grantDailyLoginXp().catch(() => {}).finally(() => {
      fetch('/api/pet/status')
        .then(r => r.json())
        .then((data: PetStatus) => {
          setStatus(data)
          sessionStorage.setItem('pet_status_cache', JSON.stringify({ data, ts: Date.now() }))
        })
        .catch(() => {
          setStatus({ hasPet: false })
        })
    })
  }, [])

  async function grantDailyLoginXp(): Promise<void> {
    // Only fire once per session to avoid hammering the DB
    if (sessionStorage.getItem('login_xp_granted_today')) return

    try {
      const res = await fetch('/api/pet/login-xp', { method: 'POST' })
      if (res.ok) {
        sessionStorage.setItem('login_xp_granted_today', '1')
        // Invalidate cache so the subsequent status fetch picks up the new row
        sessionStorage.removeItem('pet_status_cache')
      }
    } catch { /* silent — non-critical */ }
  }

  // Still loading — render nothing (avoids flash)
  if (status === null) return null

  // Not logged in or no pet yet → show nothing
  if (!status.hasPet) {
    return null
  }

  // Student with egg → show egg
  if (status.isEgg) {
    return <DesktopPet petStage="egg" petName={status.petName ?? undefined} isEgg onPickSpecies={pickSpecies} cracking={cracking} crackError={crackError ?? undefined} />
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
