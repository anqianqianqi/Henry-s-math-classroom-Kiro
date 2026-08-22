// Tests for expressing one dated session in another zone.
//
// The case that matters most is the date moving. A calendar that converted the
// time but kept the stored date would show a student a class on a day they do
// not have one, and it would look right to anyone testing from New York.
import { describe, it, expect } from 'vitest'
import { convertOccurrence } from '../timezone'

const NY = 'America/New_York'
const SH = 'Asia/Shanghai'
const LON = 'Europe/London'

describe('convertOccurrence', () => {
  it('leaves a session alone when both zones are the same', () => {
    expect(convertOccurrence('2026-08-10', '16:00', NY, NY))
      .toMatchObject({ date: '2026-08-10', time: '16:00' })
  })

  it('moves an evening class to the next morning in Shanghai', () => {
    // 21:00 EDT is UTC-4, so 01:00 UTC, which is 09:00 the next day in Shanghai.
    expect(convertOccurrence('2026-08-10', '21:00', NY, SH))
      .toMatchObject({ date: '2026-08-11', time: '09:00' })
  })

  it('moves an early class back a day the other way', () => {
    // 08:00 in Shanghai is 00:00 UTC, which is 20:00 the PREVIOUS day in New York.
    expect(convertOccurrence('2026-08-11', '08:00', SH, NY))
      .toMatchObject({ date: '2026-08-10', time: '20:00' })
  })

  it('converts within the same day when the shift is small', () => {
    expect(convertOccurrence('2026-08-10', '16:00', NY, LON))
      .toMatchObject({ date: '2026-08-10', time: '21:00' })
  })

  /*
    New York and Shanghai are 12 hours apart in summer and 13 in winter, because
    only one of them changes clocks. A fixed offset would be right for half the
    year, which is the kind of wrong that surfaces in November.
  */
  it('uses the offset in force on the session date, not today', () => {
    const summer = convertOccurrence('2026-07-15', '20:00', NY, SH)
    const winter = convertOccurrence('2026-12-15', '20:00', NY, SH)
    expect(summer).toMatchObject({ date: '2026-07-16', time: '08:00' })
    expect(winter).toMatchObject({ date: '2026-12-16', time: '09:00' })
  })

  it('handles the day the clocks go back', () => {
    // US DST ends 2026-11-01. A class that morning is EST, not EDT.
    expect(convertOccurrence('2026-11-01', '14:00', NY, LON))
      .toMatchObject({ date: '2026-11-01', time: '19:00' })
  })

  it('handles the day the clocks go forward', () => {
    // US DST starts 2026-03-08.
    expect(convertOccurrence('2026-03-08', '14:00', NY, LON))
      .toMatchObject({ date: '2026-03-08', time: '18:00' })
  })

  it('accepts a stored HH:MM:SS as readily as HH:MM', () => {
    expect(convertOccurrence('2026-08-10', '16:00:00', NY, NY))
      .toMatchObject({ time: '16:00' })
  })

  it('reports midnight as 00:00 on the right day', () => {
    // 12:00 in Shanghai is 00:00 the same day UTC.
    expect(convertOccurrence('2026-08-10', '12:00', SH, 'UTC'))
      .toMatchObject({ date: '2026-08-10', time: '04:00' })
    // 08:00 Shanghai is exactly midnight UTC — the hour must not read as 24.
    expect(convertOccurrence('2026-08-10', '08:00', SH, 'UTC'))
      .toMatchObject({ date: '2026-08-10', time: '00:00' })
  })

  it('returns the instant so a zone label can be taken at the session', () => {
    const c = convertOccurrence('2026-08-10', '21:00', NY, SH)
    expect(c!.at.toISOString()).toBe('2026-08-11T01:00:00.000Z')
  })

  it('refuses a malformed date or time rather than guessing', () => {
    expect(convertOccurrence('10/08/2026', '16:00', NY, SH)).toBeNull()
    expect(convertOccurrence('2026-08-10', 'teatime', NY, SH)).toBeNull()
    expect(convertOccurrence('2026-08-10', '25:00', NY, SH)).toBeNull()
  })

  it('refuses an unknown zone rather than silently using the browser', () => {
    expect(convertOccurrence('2026-08-10', '16:00', 'Mars/Olympus', SH)).toBeNull()
    expect(convertOccurrence('2026-08-10', '16:00', NY, 'Nowhere/Here')).toBeNull()
  })
})
