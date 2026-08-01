'use client'

/**
 * The zone and region to read the site in, and a one-time capture of them.
 *
 * ── WHY IT WRITES ON FIRST SIGHT ────────────────────────────
 * Nobody will visit Settings to tell us where they are. Detection on first
 * sight means class times are right for almost everyone without anyone doing
 * anything, and Settings exists for the cases detection cannot get right —
 * travel, a VPN, a shared family machine. So it fills a BLANK and never
 * overwrites: a stored value is a person's stated answer, and a detected one
 * is a guess.
 *
 * Region is deliberately NOT inferred from the zone. Asia/Shanghai does not
 * mean "ships to China" — a student visiting family for the summer still has
 * their parcels going to the same address — and quietly coupling the two would
 * make a shipping decision out of a clock setting.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SCHOOL_TIMEZONE, detectTimeZone, isValidTimeZone } from '@/lib/utils/timezone'
import type { Region } from '@/lib/utils/timezone'

export interface ViewerZone {
  /** Zone to render times in. Falls back to the school's until known. */
  timezone: string
  region: Region | null
  loading: boolean
}

export function useViewerZone(): ViewerZone {
  const [timezone, setTimezone] = useState(SCHOOL_TIMEZONE)
  const [region, setRegion] = useState<Region | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (!cancelled) setLoading(false); return }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('timezone, region')
          .eq('id', user.id)
          .maybeSingle()

        // Same reasoning as the welcome card: a missing column here degrades to
        // the school's zone silently, which looks like the feature doing
        // nothing rather than a migration not having run.
        if (error) {
          console.error('[viewerZone] could not read profile:', error.message,
            '— has supabase/add-timezones-and-regions.sql been run?')
          if (!cancelled) setLoading(false)
          return
        }

        const stored = (profile as any)?.timezone as string | null | undefined
        if (isValidTimeZone(stored)) {
          if (!cancelled) {
            setTimezone(stored as string)
            setRegion(((profile as any)?.region ?? null) as Region | null)
          }
          return
        }

        // Blank, or a name this browser no longer recognises. Detect and keep.
        const detected = detectTimeZone()
        if (!cancelled) {
          setTimezone(detected)
          setRegion(((profile as any)?.region ?? null) as Region | null)
        }
        await supabase.from('profiles').update({ timezone: detected }).eq('id', user.id)
      } catch {
        // A missing zone is not worth breaking a page over — the school's is a
        // reasonable default and Settings can correct it.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [])

  return { timezone, region, loading }
}
