// Tests for collapsing a student's standing on a problem into one word.
//
// The two that matter are a genuine zero not reading as "still in the queue",
// and full marks not depending on the problem having declared a maximum.
import { describe, it, expect } from 'vitest'
import { problemStatus, DEFAULT_MAX_POINTS } from '../problemStatus'

describe('problemStatus', () => {
  it('is todo before anything is handed in', () => {
    expect(problemStatus({ submitted: false })).toBe('todo')
    // Even if a score somehow exists, nothing submitted means nothing done.
    expect(problemStatus({ submitted: false, points: 80, maxPoints: 100 })).toBe('todo')
  })

  it('is ungraded once handed in and not yet marked', () => {
    expect(problemStatus({ submitted: true, points: null })).toBe('ungraded')
    expect(problemStatus({ submitted: true })).toBe('ungraded')
    expect(problemStatus({ submitted: true, points: undefined })).toBe('ungraded')
  })

  it('treats a genuine zero as graded, not as waiting', () => {
    // The distinction the whole function turns on: 0 is a mark, null is not.
    // Telling a student their work is still in the queue when it has been
    // marked zero is the one wrong answer that keeps them from the comment.
    expect(problemStatus({ submitted: true, points: 0, maxPoints: 100 })).toBe('partial')
  })

  it('is done at full marks', () => {
    expect(problemStatus({ submitted: true, points: 100, maxPoints: 100 })).toBe('done')
  })

  it('is done above full marks, since bonus marks exist', () => {
    expect(problemStatus({ submitted: true, points: 105, maxPoints: 100 })).toBe('done')
  })

  it('is partial below full marks', () => {
    expect(problemStatus({ submitted: true, points: 99, maxPoints: 100 })).toBe('partial')
  })

  it('falls back to the site default when the problem never said', () => {
    expect(problemStatus({ submitted: true, points: DEFAULT_MAX_POINTS })).toBe('done')
    expect(problemStatus({ submitted: true, points: DEFAULT_MAX_POINTS - 1 })).toBe('partial')
    expect(problemStatus({ submitted: true, points: 50, maxPoints: null })).toBe('partial')
  })

  it('handles a problem worth something other than 100', () => {
    expect(problemStatus({ submitted: true, points: 5, maxPoints: 5 })).toBe('done')
    expect(problemStatus({ submitted: true, points: 4, maxPoints: 5 })).toBe('partial')
  })
})
