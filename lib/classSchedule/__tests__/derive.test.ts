// Tests for reading a meeting pattern back out of booked sessions.
import { describe, it, expect } from 'vitest'
import { slotsFromOccurrences, groupByClass } from '../derive'

describe('slotsFromOccurrences', () => {
  it('collapses repeated weeks into one slot', () => {
    // Three Mondays at the same time is "Mondays 16:00", not three entries.
    expect(slotsFromOccurrences([
      { occurrence_date: '2026-08-03', start_time: '16:00:00', end_time: '17:00:00' },
      { occurrence_date: '2026-08-10', start_time: '16:00:00', end_time: '17:00:00' },
      { occurrence_date: '2026-08-17', start_time: '16:00:00', end_time: '17:00:00' },
    ])).toEqual([{ day: 'Monday', startTime: '16:00', endTime: '17:00' }])
  })

  it('keeps a class that meets on more than one day', () => {
    expect(slotsFromOccurrences([
      { occurrence_date: '2026-08-05', start_time: '16:00:00', end_time: '17:00:00' },
      { occurrence_date: '2026-08-03', start_time: '16:00:00', end_time: '17:00:00' },
    ])).toEqual([
      { day: 'Monday', startTime: '16:00', endTime: '17:00' },
      { day: 'Wednesday', startTime: '16:00', endTime: '17:00' },
    ])
  })

  it('treats a different time on the same weekday as its own slot', () => {
    expect(slotsFromOccurrences([
      { occurrence_date: '2026-08-03', start_time: '16:00:00', end_time: '17:00:00' },
      { occurrence_date: '2026-08-10', start_time: '09:00:00', end_time: '10:00:00' },
    ])).toEqual([
      { day: 'Monday', startTime: '09:00', endTime: '10:00' },
      { day: 'Monday', startTime: '16:00', endTime: '17:00' },
    ])
  })

  it('sorts by weekday then time regardless of row order', () => {
    expect(slotsFromOccurrences([
      { occurrence_date: '2026-08-07', start_time: '11:00:00', end_time: '12:00:00' }, // Fri
      { occurrence_date: '2026-08-02', start_time: '10:00:00', end_time: '11:00:00' }, // Sun
      { occurrence_date: '2026-08-05', start_time: '14:00:00', end_time: '15:00:00' }, // Wed
    ]).map(s => s.day)).toEqual(['Sunday', 'Wednesday', 'Friday'])
  })

  it('ignores a cancelled session rather than dropping the slot', () => {
    // The 10th is off, but the class still meets on Mondays.
    expect(slotsFromOccurrences([
      { occurrence_date: '2026-08-03', start_time: '16:00:00', end_time: '17:00:00' },
      { occurrence_date: '2026-08-10', start_time: '16:00:00', end_time: '17:00:00', status: 'cancelled' },
    ])).toEqual([{ day: 'Monday', startTime: '16:00', endTime: '17:00' }])
  })

  it('drops a slot entirely when every session in it is cancelled', () => {
    expect(slotsFromOccurrences([
      { occurrence_date: '2026-08-03', start_time: '16:00:00', end_time: '17:00:00', status: 'cancelled' },
    ])).toEqual([])
  })

  it('says nothing for a class with nothing booked', () => {
    expect(slotsFromOccurrences([])).toEqual([])
  })

  it('reads the weekday from a local date, not a UTC one', () => {
    // Parsed as UTC and rendered west of Greenwich, 2026-08-03 becomes the 2nd
    // and this would claim Sunday.
    expect(slotsFromOccurrences([
      { occurrence_date: '2026-08-03', start_time: '00:30:00', end_time: '01:30:00' },
    ])[0].day).toBe('Monday')
  })

  it('copes with a missing end time', () => {
    expect(slotsFromOccurrences([
      { occurrence_date: '2026-08-03', start_time: '16:00:00', end_time: null },
    ])).toEqual([{ day: 'Monday', startTime: '16:00', endTime: '' }])
  })
})

describe('groupByClass', () => {
  it('buckets rows by class, preserving order within each', () => {
    expect(groupByClass([
      { class_id: 'a', n: 1 },
      { class_id: 'b', n: 2 },
      { class_id: 'a', n: 3 },
    ])).toEqual({
      a: [{ class_id: 'a', n: 1 }, { class_id: 'a', n: 3 }],
      b: [{ class_id: 'b', n: 2 }],
    })
  })

  it('returns an empty map for no rows', () => {
    expect(groupByClass([])).toEqual({})
  })
})
