import { describe, expect, it } from 'vitest'
import {
  SCHOOL_TIMEZONE,
  convertSession,
  dateStringIn,
  isValidTimeZone,
  schoolDateOffset,
  schoolDateString,
  zoneLabel,
} from '../utils/timezone'

/**
 * The cases that matter are the ones nobody notices until a student says the
 * challenge is missing: day boundaries, and the two weekends a year when the
 * clocks move. Fixed instants throughout — a test that passes only in August
 * is not a test.
 */

describe('schoolDateString', () => {
  it('gives the school day, not the reader day', () => {
    // 2026-08-02 00:30 UTC. Already Sunday in Shanghai, still Saturday in NY.
    const instant = new Date('2026-08-02T00:30:00Z')
    expect(schoolDateString(instant)).toBe('2026-08-01')
    expect(dateStringIn('Asia/Shanghai', instant)).toBe('2026-08-02')
  })

  it('is the reason a Shanghai student still sees the right challenge', () => {
    // 8am Sunday in Shanghai. Under the old browser-local rule this student
    // asked for 2026-08-02 and Saturday's challenge disappeared for them.
    const instant = new Date('2026-08-02T00:00:00Z')
    expect(dateStringIn('Asia/Shanghai', instant)).toBe('2026-08-02')
    expect(schoolDateString(instant)).toBe('2026-08-01')
  })

  it('rolls over at the school midnight, not UTC midnight', () => {
    // 03:59 UTC is 23:59 the previous day in New York (EDT, UTC-4).
    expect(schoolDateString(new Date('2026-08-02T03:59:00Z'))).toBe('2026-08-01')
    expect(schoolDateString(new Date('2026-08-02T04:01:00Z'))).toBe('2026-08-02')
  })
})

describe('schoolDateOffset', () => {
  it('steps whole days', () => {
    const from = new Date('2026-08-10T16:00:00Z')
    expect(schoolDateOffset(0, from)).toBe('2026-08-10')
    expect(schoolDateOffset(-1, from)).toBe('2026-08-09')
    expect(schoolDateOffset(7, from)).toBe('2026-08-17')
  })

  it('does not skip or repeat a day across the spring clock change', () => {
    // US DST began 2026-03-08. Stepping back ten days must land ten days back,
    // which string arithmetic on a 23-hour day would get wrong.
    const after = new Date('2026-03-12T16:00:00Z')
    expect(schoolDateOffset(-10, after)).toBe('2026-03-02')
  })

  it('survives the autumn clock change too', () => {
    // US DST ended 2026-11-01; that local day is 25 hours long.
    const after = new Date('2026-11-05T16:00:00Z')
    expect(schoolDateOffset(-10, after)).toBe('2026-10-26')
  })
})

describe('isValidTimeZone', () => {
  it('accepts real zones and rejects junk', () => {
    expect(isValidTimeZone(SCHOOL_TIMEZONE)).toBe(true)
    expect(isValidTimeZone('Asia/Shanghai')).toBe(true)
    // Stored values can be stale or hand-edited; an unknown name makes Intl
    // throw, which would take down whatever page tried to show a date.
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone(null)).toBe(false)
    expect(isValidTimeZone(undefined)).toBe(false)
  })
})

describe('convertSession', () => {
  it('moves a New York afternoon into the next Shanghai morning', () => {
    // Monday 16:00 EDT is 04:00 Tuesday in Shanghai — a day later.
    const r = convertSession('monday', '16:00', 'America/New_York', 'Asia/Shanghai',
      new Date('2026-08-01T12:00:00Z'))
    expect(r).not.toBeNull()
    expect(r!.time).toBe('04:00')
    expect(r!.day).toBe('tuesday')
    expect(r!.dayShift).toBe(1)
  })

  it('gives a different hour in winter than in summer', () => {
    // The whole reason this resolves a real date instead of a fixed offset:
    // New York changes clocks and Shanghai never does, so the gap is 12 hours
    // in summer and 13 in winter.
    const summer = convertSession('monday', '16:00', 'America/New_York', 'Asia/Shanghai',
      new Date('2026-08-01T12:00:00Z'))
    const winter = convertSession('monday', '16:00', 'America/New_York', 'Asia/Shanghai',
      new Date('2026-12-01T12:00:00Z'))
    expect(summer!.time).toBe('04:00')
    expect(winter!.time).toBe('05:00')
  })

  it('leaves a time alone when both sides share a zone', () => {
    const r = convertSession('wednesday', '09:30', SCHOOL_TIMEZONE, SCHOOL_TIMEZONE,
      new Date('2026-08-01T12:00:00Z'))
    expect(r!.time).toBe('09:30')
    expect(r!.day).toBe('wednesday')
    expect(r!.dayShift).toBe(0)
  })

  it('can shift a session backwards a day', () => {
    // 08:00 Monday in Shanghai is Sunday evening in New York.
    const r = convertSession('monday', '08:00', 'Asia/Shanghai', 'America/New_York',
      new Date('2026-08-01T12:00:00Z'))
    expect(r!.day).toBe('sunday')
    expect(r!.dayShift).toBe(-1)
  })

  it('returns null rather than a wrong time for unusable input', () => {
    const now = new Date('2026-08-01T12:00:00Z')
    expect(convertSession('someday', '16:00', SCHOOL_TIMEZONE, 'Asia/Shanghai', now)).toBeNull()
    expect(convertSession('monday', 'lunchtime', SCHOOL_TIMEZONE, 'Asia/Shanghai', now)).toBeNull()
    expect(convertSession('monday', '99:00', SCHOOL_TIMEZONE, 'Asia/Shanghai', now)).toBeNull()
    expect(convertSession('monday', '16:00', 'Mars/Olympus', 'Asia/Shanghai', now)).toBeNull()
  })
})

describe('zoneLabel', () => {
  it('names the offset in force at that moment, not a fixed one', () => {
    // Same zone, different sides of the clock change.
    const summer = zoneLabel(SCHOOL_TIMEZONE, new Date('2026-08-01T16:00:00Z'))
    const winter = zoneLabel(SCHOOL_TIMEZONE, new Date('2026-12-01T16:00:00Z'))
    expect(summer).not.toBe(winter)
  })

  it('falls back to the zone name rather than throwing', () => {
    expect(zoneLabel('Mars/Olympus')).toBe('Mars/Olympus')
  })
})
