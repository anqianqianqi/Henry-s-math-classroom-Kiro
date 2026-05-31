// components/desktop-pet/DesktopPetWrapper.tsx
//
// Fetches pet status on mount — no sessionStorage caching so it always
// reflects the real DB state regardless of browser or session.

'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
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
  const xpGranted = useRef(false) // in-memory flag, resets on page reload (intentional)

  useEffect(() => {
    // Grant daily XP first (creates pet row if needed), then fetch status.
    // Both are fire-and-forget safe — status fetch always runs via finally.
    grantDailyLoginXp().finally(() => {
      fetch('/api/pet/status')
        .then(r => r.json())
        .then((data: PetStatus) => setStatus(data))
        .catch(() => setStatus({ hasPet: false }))
    })

    // Listen for auth changes — hide pet immediately on sign-out
    let supabaseClient: any = null
    import('@/lib/supabase/client').then(({ createClient }) => {
      supabaseClient = createClient()
      supabaseClient.auth.onAuthStateChange((event: string) => {
        if (event === 'SIGNED_OUT') {
          setStatus({ hasPet: false })
        }
      })
    })

    return () => {
      // cleanup handled by Supabase subscription automatically
    }
  }, [])

  async function grantDailyLoginXp(): Promise<void> {
    if (xpGranted.current) return
    xpGranted.current = true
    try {
      await fetch('/api/pet/login-xp', { method: 'POST' })
    } catch { /* silent */ }
  }

  async function pickSpecies(species: 'dragon' | 'fox' | 'cat') {
    setCracking(true)
    setCrackError(null)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const { error } = await supabase
        .from('student_pets')
        .update({ species, evolution_stage: 'baby', xp: 0, equipped_accessories: [] })
        .eq('user_id', user.id)

      if (error) throw error

      // Re-fetch status to update widget
      const res = await fetch('/api/pet/status')
      const data: PetStatus = await res.json()
      setStatus(data)
    } catch {
      setCrackError('Something went wrong. Try again.')
    } finally {
      setCracking(false)
    }
  }

  // Still loading
  if (status === null) return null

  // Not logged in or no pet row
  if (!status.hasPet) return null

  if (status.isEgg) {
    return (
      <DesktopPet
        petStage="egg"
        petName={status.petName ?? undefined}
        isEgg
        onPickSpecies={pickSpecies}
        cracking={cracking}
        crackError={crackError ?? undefined}
      />
    )
  }

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
