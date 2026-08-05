import { describe, expect, it } from 'vitest'
import {
  loaderVisible,
  MAX_VISIBLE_MS,
  MIN_VISIBLE_MS,
} from '@/components/challenge-room/ChallengeLoader'

/**
 * Two ways this rule can be wrong, and both are worse than the pop it replaces:
 * flashing for one frame on a warm cache, or never lifting at all.
 */

describe('loaderVisible', () => {
  it('stays up while the work is unfinished', () => {
    expect(loaderVisible(false, false, false)).toBe(true)
    expect(loaderVisible(false, true, false)).toBe(true)
  })

  it('stays up when the work finished but the floor has not', () => {
    // The flash case. Everything resolves in ~50ms from cache, and lifting
    // immediately reads as a fault rather than a transition.
    expect(loaderVisible(true, false, false)).toBe(true)
  })

  it('lifts once the work is done and the floor has passed', () => {
    expect(loaderVisible(true, true, false)).toBe(false)
  })

  it('lifts on the ceiling even if nothing ever reported ready', () => {
    // A 3D stage that mounts and silently never calls back must not be able to
    // strand a student on a loading screen.
    expect(loaderVisible(false, true, true)).toBe(false)
  })
})

describe('the two timings', () => {
  it('floors well under a second, so the beat is felt not waited out', () => {
    expect(MIN_VISIBLE_MS).toBeGreaterThanOrEqual(400)
    expect(MIN_VISIBLE_MS).toBeLessThanOrEqual(1200)
  })

  it('gives a real slow load room before the ceiling cuts it off', () => {
    // The book model alone is 2.63 MiB — roughly 10s on a 2 Mbps connection —
    // so a ceiling near the floor would routinely abort loads that were about
    // to succeed.
    expect(MAX_VISIBLE_MS).toBeGreaterThan(MIN_VISIBLE_MS * 10)
  })
})
