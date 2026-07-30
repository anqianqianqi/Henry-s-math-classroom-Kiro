'use client'

import { useEffect, useState } from 'react'

/**
 * True on viewports at or above the md breakpoint.
 *
 * The 3D challenge room is desktop-only on purpose: it pulls three.js plus a
 * 2.6 MiB GLB, which is the wrong trade on a school tablet. Gating on this hook
 * (rather than CSS) means mobile never downloads either.
 *
 * Starts false so the first client render matches the server's markup, then
 * corrects after mount — avoids a hydration mismatch.
 */
export function useIsDesktop(minWidth = 768): boolean {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${minWidth}px)`)
    setIsDesktop(query.matches)
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [minWidth])

  return isDesktop
}
