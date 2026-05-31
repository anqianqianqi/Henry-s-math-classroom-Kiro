// components/desktop-pet/DesktopPetWrapper.tsx
//
// Fetches pet status on mount — no sessionStorage caching so it always
// reflects the real DB state regardless of browser or session.

'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
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
  const xpGranted = useRef(false)
  const initialFetchDone = useRef(false)
  const pathname = usePathname()

  // Don't show pet on auth pages — checked in render, not before hooks
  const isAuthPage = pathname === '/' || pathname === '/login' || pathname === '/signup' ||
    pathname === '/forgot-password' || pathname === '/reset-password'

  useEffect(() => {
    // Initial fetch on mount
    initialFetchDone.current = false
    grantDailyLoginXp().finally(() => {
      fetch('/api/pet/status')
        .then(r => r.json())
        .then((data: PetStatus) => {
          setStatus(data)
          initialFetchDone.current = true
        })
        .catch(() => {
          setStatus({ hasPet: false })
          initialFetchDone.current = true
        })
    })

    // Listen for auth changes — hide pet on sign-out, reload pet on sign-in
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabaseClient = createClient()
      supabaseClient.auth.onAuthStateChange((event: string) => {
        if (event === 'SIGNED_OUT') {
          setStatus({ hasPet: false })
          xpGranted.current = false
        } else if (event === 'SIGNED_IN') {
          // Skip if this is the initial page load (useEffect handles that)
          if (!initialFetchDone.current) return
          // Clear immediately so previous user's pet doesn't flash
          setStatus(null)
          xpGranted.current = false
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

  // Don't show on auth pages
  if (isAuthPage) return null

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
