import { describe, expect, it } from 'vitest'
import { ANNOUNCEMENT_SHINE_DAYS, isWithinShineWindow } from '../announcements/shineWindow'

/**
 * The shine window.
 *
 * An off-by-one here is either a button that never shines or one that never
 * stops, and neither is visible by reading the code — you would find out three
 * days later, from a student. The boundary is worth pinning exactly.
 */

const DAY = 24 * 60 * 60 * 1000
const SEEN = new Date('2026-08-01T12:00:00Z')

describe('isWithinShineWindow', () => {
  it('shines when the student has never seen it', () => {
    // No view row is the first render, and that render starts the clock.
    expect(isWithinShineWindow(null)).toBe(true)
  })

  it('shines immediately after first sight', () => {
    expect(isWithinShineWindow(SEEN.toISOString(), SEEN)).toBe(true)
  })

  it('still shines just under three days later', () => {
    const now = new Date(SEEN.getTime() + ANNOUNCEMENT_SHINE_DAYS * DAY - 1000)
    expect(isWithinShineWindow(SEEN.toISOString(), now)).toBe(true)
  })

  it('stops exactly at three days', () => {
    const now = new Date(SEEN.getTime() + ANNOUNCEMENT_SHINE_DAYS * DAY)
    // Exactly at the boundary is OUT, so "3 days" means three days and not a
    // moment more.
    expect(isWithinShineWindow(SEEN.toISOString(), now)).toBe(false)
  })

  it('stays off long afterwards', () => {
    const now = new Date(SEEN.getTime() + 90 * DAY)
    expect(isWithinShineWindow(SEEN.toISOString(), now)).toBe(false)
  })

  it('is three days, not some other number', () => {
    // Guards the constant itself: changing it is a product decision, and this
    // failing is the reminder to say so out loud.
    expect(ANNOUNCEMENT_SHINE_DAYS).toBe(3)
  })
})
