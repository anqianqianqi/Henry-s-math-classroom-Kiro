import { describe, it, expect } from 'vitest'
import {
  applyFilters,
  attachTa,
  confidenceBand,
  feedbackActionFor,
  flatten,
  groupByProblem,
  problemKey,
  rowFromRecord,
  stepIndex,
  taFromResponse,
  taFromRow,
  timeAgoParts,
  type QueueRow,
} from '@/lib/studio/queue'

/**
 * How the desk reads the database and orders the queue. The cases here are
 * the ones that would otherwise send a teacher to the wrong student or hide a
 * hand-in whose problem was deleted.
 */

function record(overrides: Record<string, any> = {}) {
  return {
    id: 'sub-1',
    user_id: 'student-1',
    challenge_id: 'ch-1',
    bank_item_id: null,
    content: '36',
    image_url: null,
    points: null,
    is_locked: false,
    submitted_at: '2026-09-08T10:00:00Z',
    profiles: { full_name: 'Ada Lovelace', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
    daily_challenges: { title: 'Exponent 11', challenge_date: '2026-09-08', max_points: 10 },
    challenge_bank: null,
    ...overrides,
  }
}

function row(overrides: Partial<QueueRow> = {}): QueueRow {
  return { ...rowFromRecord(record()), ...overrides }
}

describe('rowFromRecord', () => {
  it('reads the joined student and problem into one flat row', () => {
    expect(rowFromRecord(record())).toMatchObject({
      id: 'sub-1', userId: 'student-1', challengeId: 'ch-1', bankItemId: null, content: '36',
      studentName: 'Ada Lovelace', studentEmail: 'ada@example.com',
      problemTitle: 'Exponent 11', challengeDate: '2026-09-08', maxPoints: 10, points: null, ta: null,
    })
  })

  it('builds a name from the parts when there is no full name, and leaves it empty otherwise', () => {
    expect(rowFromRecord(record({ profiles: { full_name: '', first_name: 'Ada', last_name: 'L', email: '' } })).studentName).toBe('Ada L')
    expect(rowFromRecord(record({ profiles: null })).studentName).toBe('')
  })

  it('falls back to the bank item for a hand-in keyed by the bank, then to the site default', () => {
    const banked = rowFromRecord(record({ challenge_id: null, bank_item_id: 'bank-1', daily_challenges: null, challenge_bank: { title: 'Angle 3', max_points: 5 } }))
    expect(banked).toMatchObject({ challengeId: null, bankItemId: 'bank-1', problemTitle: 'Angle 3', maxPoints: 5, challengeDate: null })
    expect(rowFromRecord(record({ daily_challenges: { title: 'x', max_points: null } })).maxPoints).toBe(100)
  })

  it('keeps a graded score as a number and an unmarked one as null', () => {
    expect(rowFromRecord(record({ points: 0 })).points).toBe(0)
    expect(rowFromRecord(record({ points: '7' })).points).toBe(7)
    expect(rowFromRecord(record({ points: null })).points).toBeNull()
  })
})

describe('problemKey and grouping', () => {
  it('keys by challenge, then by bank item, then as orphaned', () => {
    expect(problemKey({ challengeId: 'ch-1', bankItemId: 'bank-1' })).toBe('challenge:ch-1')
    expect(problemKey({ challengeId: null, bankItemId: 'bank-1' })).toBe('bank:bank-1')
    expect(problemKey({ challengeId: null, bankItemId: null })).toBe('none')
  })

  it('groups by problem, newest problem first, students by name inside', () => {
    const rows = [
      row({ id: 'a', studentName: 'Zed', challengeId: 'old', problemTitle: 'Old', challengeDate: '2026-09-01' }),
      row({ id: 'b', studentName: 'Bea', challengeId: 'new', problemTitle: 'New', challengeDate: '2026-09-08' }),
      row({ id: 'c', studentName: 'Al', challengeId: 'new', problemTitle: 'New', challengeDate: '2026-09-08' }),
      row({ id: 'd', studentName: 'Cy', challengeId: null, bankItemId: 'bank-1', problemTitle: 'Bank', challengeDate: null, submittedAt: '2026-09-09T00:00:00Z' }),
    ]
    const groups = groupByProblem(rows)
    expect(groups.map(g => g.key)).toEqual(['challenge:new', 'challenge:old', 'bank:bank-1'])
    expect(groups[0].rows.map(r => r.studentName)).toEqual(['Al', 'Bea'])
    expect(flatten(groups).map(r => r.id)).toEqual(['c', 'b', 'a', 'd'])
  })

  it('does not reorder a group when one of its rows is graded', () => {
    const before = flatten(groupByProblem([row({ id: 'x', studentName: 'Al' }), row({ id: 'y', studentName: 'Bea' })]))
    const after = flatten(groupByProblem([row({ id: 'x', studentName: 'Al', points: 9 }), row({ id: 'y', studentName: 'Bea' })]))
    expect(after.map(r => r.id)).toEqual(before.map(r => r.id))
  })
})

describe('applyFilters', () => {
  const rows = [
    row({ id: 'a', userId: 'u1', studentName: 'Ada', submittedAt: '2026-09-01T09:00:00Z', problemTitle: 'Exponent 11' }),
    row({ id: 'b', userId: 'u2', studentName: 'Bo', studentEmail: 'bo@x.io', submittedAt: '2026-09-05T09:00:00Z', problemTitle: 'Angle 3' }),
    row({ id: 'c', userId: 'u3', studentName: 'Cy', submittedAt: '2026-09-09T09:00:00Z', problemTitle: 'Exponent 12' }),
  ]
  const none = { members: null, from: '', to: '', search: '' }

  it('passes everything through with no filters', () => {
    expect(applyFilters(rows, none)).toHaveLength(3)
  })

  it('keeps only a class', () => {
    expect(applyFilters(rows, { ...none, members: new Set(['u2']) }).map(r => r.id)).toEqual(['b'])
  })

  it('cuts by hand-in date on both ends, inclusive', () => {
    expect(applyFilters(rows, { ...none, from: '2026-09-05', to: '2026-09-09' }).map(r => r.id)).toEqual(['b', 'c'])
    expect(applyFilters(rows, { ...none, to: '2026-09-04' }).map(r => r.id)).toEqual(['a'])
  })

  it('searches names, emails, and problem titles without caring about case', () => {
    expect(applyFilters(rows, { ...none, search: 'expo' }).map(r => r.id)).toEqual(['a', 'c'])
    expect(applyFilters(rows, { ...none, search: 'BO@X' }).map(r => r.id)).toEqual(['b'])
  })
})

describe('the assistant\'s rows', () => {
  it('reads a saved ta_grades row, including a reviewer change', () => {
    const ta = taFromRow({
      id: 'ta-1', submission_id: 'sub-1', suggested_score: 7, max_score: 10, confidence: '0.72',
      suggested_comment: 'Check the sign.', status: 'pending', henry_score: null,
      reasoning: { step3_deviation: 'Sign error.', step4_henry_perspective: 'Method fine.', grade_changed_by_critic: true, draft_score: 9, critic_reasoning: 'Missed a case.' },
    })
    expect(ta).toMatchObject({
      id: 'ta-1', suggestedScore: 7, maxScore: 10, confidence: 0.72, comment: 'Check the sign.', gap: 'Sign error.', view: 'Method fine.',
      criticChanged: true, criticFrom: 9, criticTo: 7, criticReason: 'Missed a case.', status: 'pending', henryScore: null,
    })
  })

  it('clamps a confidence outside 0..1 and treats an unknown status as pending', () => {
    expect(taFromRow({ suggested_score: 3, max_score: 5, confidence: 1.4, status: 'weird' })).toMatchObject({ confidence: 1, status: 'pending' })
    expect(taFromRow({ suggested_score: 3, max_score: 5, confidence: 'nope' }).confidence).toBe(0)
  })

  it('reads the live response the same way, with the solution the row does not keep', () => {
    const ta = taFromResponse({ id: 'ta-2', suggested_score: 5, max_score: 5, confidence: 0.9, comment: 'Good.', suggested_solution: 'Use symmetry.', reasoning: {}, critic: null })
    expect(ta).toMatchObject({ id: 'ta-2', solution: 'Use symmetry.', criticChanged: false, criticFrom: null, status: 'pending' })
  })

  it('pairs rows with their suggestions by submission id', () => {
    const rows = attachTa([row({ id: 'a' }), row({ id: 'b' })], [{ id: 'ta-b', submission_id: 'b', suggested_score: 4, max_score: 10, confidence: 0.5 }])
    expect(rows[0].ta).toBeNull()
    expect(rows[1].ta?.id).toBe('ta-b')
  })

  it('bands confidence the way the site colours it', () => {
    expect(confidenceBand(0.85)).toBe('high')
    expect(confidenceBand(0.6)).toBe('mid')
    expect(confidenceBand(0.59)).toBe('low')
  })

  it('calls the same score an acceptance and any other an override, only while pending', () => {
    const ta = taFromRow({ id: 'ta-1', suggested_score: 7, max_score: 10, confidence: 0.9, status: 'pending' })
    expect(feedbackActionFor(ta, 7)).toBe('accepted')
    expect(feedbackActionFor(ta, 6)).toBe('overridden')
    expect(feedbackActionFor({ ...ta, status: 'accepted' }, 7)).toBeNull()
    expect(feedbackActionFor({ ...ta, id: null }, 7)).toBeNull()
    expect(feedbackActionFor(null, 7)).toBeNull()
  })
})

describe('walking the queue', () => {
  it('steps within the ends and starts from the top or bottom when nothing is chosen', () => {
    expect(stepIndex(0, 1, 3)).toBe(1)
    expect(stepIndex(2, 1, 3)).toBe(2)
    expect(stepIndex(0, -1, 3)).toBe(0)
    expect(stepIndex(-1, 1, 3)).toBe(0)
    expect(stepIndex(-1, -1, 3)).toBe(2)
    expect(stepIndex(0, 1, 0)).toBe(-1)
  })

  it('describes how long ago in the coarsest unit that fits', () => {
    const now = Date.parse('2026-09-09T12:00:00Z')
    expect(timeAgoParts('2026-09-09T11:59:30Z', now)).toEqual({ unit: 'now', count: 0 })
    expect(timeAgoParts('2026-09-09T11:15:00Z', now)).toEqual({ unit: 'm', count: 45 })
    expect(timeAgoParts('2026-09-09T05:00:00Z', now)).toEqual({ unit: 'h', count: 7 })
    expect(timeAgoParts('2026-09-01T12:00:00Z', now)).toEqual({ unit: 'd', count: 8 })
    expect(timeAgoParts('not a date', now)).toEqual({ unit: 'now', count: 0 })
  })
})
