// Tests for turning a recurring schedule into dated sessions.
//
// The two properties worth defending here are the ones a calendar can get
// quietly wrong: generation must never reach backwards over sessions that
// already happened, and numbering must stay in date order when a session is
// inserted between two others.
//
// vitest globals are not enabled in vitest.config.ts, so describe/it/expect are
// imported. lib/utils/__tests__/occurrences.test.ts is currently red for
// exactly this reason.
import { describe, it, expect } from 'vitest'
import {
  weekdayDatesBetween,
  generationStart,
  planSessions,
  renumberByDate,
  toSqlTime,
  fromSqlTime,
  type ScheduleSeries,
} from '../series'

describe('weekdayDatesBetween', () => {
  it('returns every matching weekday in the window', () => {
    // Mondays in August 2026: 3, 10, 17, 24, 31
    expect(weekdayDatesBetween(1, '2026-08-01', '2026-08-31')).toEqual([
      '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31',
    ])
  })

  it('includes the boundaries when they fall on the weekday', () => {
    expect(weekdayDatesBetween(1, '2026-08-03', '2026-08-10')).toEqual(['2026-08-03', '2026-08-10'])
  })

  it('crosses a month boundary', () => {
    expect(weekdayDatesBetween(5, '2026-08-28', '2026-09-04')).toEqual(['2026-08-28', '2026-09-04'])
  })

  it('handles Sunday, which is 0 and would be falsy if anyone tested truthiness', () => {
    expect(weekdayDatesBetween(0, '2026-08-01', '2026-08-16')).toEqual([
      '2026-08-02', '2026-08-09', '2026-08-16',
    ])
  })

  it('returns nothing when the window contains no such day', () => {
    // 2026-08-04 is a Tuesday; asking for Thursdays in a two-day window.
    expect(weekdayDatesBetween(4, '2026-08-04', '2026-08-05')).toEqual([])
  })

  it('returns nothing rather than throwing when the range is inverted', () => {
    expect(weekdayDatesBetween(1, '2026-08-31', '2026-08-01')).toEqual([])
  })

  it('rejects a weekday outside 0-6', () => {
    expect(() => weekdayDatesBetween(7, '2026-08-01', '2026-08-31')).toThrow(/weekday/)
    expect(() => weekdayDatesBetween(-1, '2026-08-01', '2026-08-31')).toThrow(/weekday/)
  })

  it('does not drift across a daylight-saving boundary', () => {
    // US DST ends 2026-11-01. Stepping by 7 days on a Date can land an hour
    // out; the dates must stay Sundays either side of it.
    expect(weekdayDatesBetween(0, '2026-10-25', '2026-11-15')).toEqual([
      '2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15',
    ])
  })
})

describe('generationStart', () => {
  it('starts at today when the series began in the past', () => {
    expect(generationStart('2026-01-05', '2026-08-09')).toBe('2026-08-09')
  })

  it('starts at the series when it has not begun yet', () => {
    expect(generationStart('2026-09-01', '2026-08-09')).toBe('2026-09-01')
  })
})

const series: ScheduleSeries = {
  id: 's1',
  class_id: 'c1',
  weekday: 1,
  start_time: '16:00:00',
  end_time: '17:00:00',
  effective_from: '2026-01-05',
  effective_until: null,
}

describe('planSessions', () => {
  it('never plans a session before today, however old the series is', () => {
    const planned = planSessions(series, '2026-08-09', '2026-08-31')
    expect(planned.map(p => p.occurrence_date)).toEqual([
      '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31',
    ])
    expect(planned.every(p => p.occurrence_date >= '2026-08-09')).toBe(true)
  })

  it('stops at effective_until when that is sooner than the horizon', () => {
    const bounded = { ...series, effective_until: '2026-08-18' }
    expect(planSessions(bounded, '2026-08-09', '2026-12-31').map(p => p.occurrence_date))
      .toEqual(['2026-08-10', '2026-08-17'])
  })

  it('plans nothing once effective_until has passed', () => {
    const expired = { ...series, effective_until: '2026-07-01' }
    expect(planSessions(expired, '2026-08-09', '2026-12-31')).toEqual([])
  })

  it('skips days the class already has, so re-running does not double-book', () => {
    const planned = planSessions(series, '2026-08-09', '2026-08-31', ['2026-08-17'])
    expect(planned.map(p => p.occurrence_date)).toEqual([
      '2026-08-10', '2026-08-24', '2026-08-31',
    ])
  })

  it('carries the series time and marks the rows upcoming', () => {
    const [first] = planSessions(series, '2026-08-09', '2026-08-12')
    expect(first).toEqual({
      class_id: 'c1',
      series_id: 's1',
      occurrence_date: '2026-08-10',
      start_time: '16:00:00',
      end_time: '17:00:00',
      status: 'upcoming',
    })
  })
})

describe('renumberByDate', () => {
  it('numbers a class in the order its sessions happen', () => {
    expect(renumberByDate([
      { id: 'b', occurrence_date: '2026-08-10', start_time: '16:00:00' },
      { id: 'a', occurrence_date: '2026-08-03', start_time: '16:00:00' },
      { id: 'c', occurrence_date: '2026-08-17', start_time: '16:00:00' },
    ])).toEqual([
      { id: 'a', session_number: 1 },
      { id: 'b', session_number: 2 },
      { id: 'c', session_number: 3 },
    ])
  })

  it('breaks a same-day tie on start time', () => {
    expect(renumberByDate([
      { id: 'late', occurrence_date: '2026-08-03', start_time: '16:00:00' },
      { id: 'early', occurrence_date: '2026-08-03', start_time: '09:00:00' },
    ])).toEqual([
      { id: 'early', session_number: 1 },
      { id: 'late', session_number: 2 },
    ])
  })

  it('renumbers everything after a session inserted in the middle', () => {
    // This is the case that made continuing from the maximum wrong: 'mid' is
    // new, and 'c' has to move from 2 to 3 rather than the class having two
    // Session 2s.
    const changed = renumberByDate([
      { id: 'a', occurrence_date: '2026-08-03', start_time: '16:00:00', session_number: 1 },
      { id: 'c', occurrence_date: '2026-08-17', start_time: '16:00:00', session_number: 2 },
      { id: 'mid', occurrence_date: '2026-08-10', start_time: '16:00:00' },
    ])
    expect(changed).toEqual([
      { id: 'mid', session_number: 2 },
      { id: 'c', session_number: 3 },
    ])
  })

  it('writes nothing when the numbering is already right', () => {
    expect(renumberByDate([
      { id: 'a', occurrence_date: '2026-08-03', start_time: '16:00:00', session_number: 1 },
      { id: 'b', occurrence_date: '2026-08-10', start_time: '16:00:00', session_number: 2 },
    ])).toEqual([])
  })

  it('returns only the tail when appending, not the whole class', () => {
    const existing = Array.from({ length: 20 }, (_, i) => ({
      id: `s${i}`,
      occurrence_date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      start_time: '16:00:00',
      session_number: i + 1,
    }))
    const changed = renumberByDate([
      ...existing,
      { id: 'new', occurrence_date: '2026-04-01', start_time: '16:00:00' },
    ])
    expect(changed).toEqual([{ id: 'new', session_number: 21 }])
  })

  it('handles an empty class', () => {
    expect(renumberByDate([])).toEqual([])
  })
})

describe('time formats', () => {
  it('pads a form value out to what a TIME column wants', () => {
    expect(toSqlTime('16:00')).toBe('16:00:00')
  })

  it('leaves an already-padded value alone', () => {
    expect(toSqlTime('16:00:00')).toBe('16:00:00')
  })

  it('trims a stored value back for a form field', () => {
    expect(fromSqlTime('16:00:00')).toBe('16:00')
  })
})
