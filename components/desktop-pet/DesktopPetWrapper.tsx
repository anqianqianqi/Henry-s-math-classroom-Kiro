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

    // Listen for auth changes — hide pet on sign-out, reload pet on sign-in
    let supabaseClient: any = null
    import('@/lib/supabase/client').then(({ createClient }) => {
      supabaseClient = createClient()
      supabaseClient.auth.onAuthStateChange((event: string) => {
        if (event === 'SIGNED_OUT') {
          setStatus({ hasPet: false })
          xpGranted.current = false
        } else if (event === 'SIGNED_IN') {
          // New user logged in — fetch their pet (not the previous user's)
          setStatus(null) // show loading briefly
          grantDailyLoginXp().finally(() => {
            fetch('/api/pet/status')
              .then(r => r.json())
              .then((data: PetStatus) => setStatus(data))
              .catch(() => setStatus({ hasPet: false }))
          })
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

  async function hatchEgg() {
    setCracking(true)
    setCrackError(null)
    try {
      const res = await fetch('/api/pet/hatch', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        console.error('[hatchEgg] API error:', data)
        throw new Error(data.error ?? 'Hatch failed')
      }

      // API returns the updated pet status directly
      setStatus(data as PetStatus)
    } catch (err) {
      console.error('[hatchEgg] error:', err)
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
        onHatch={hatchEgg}
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
