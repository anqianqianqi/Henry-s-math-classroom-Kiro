/**
 * Unit tests for Bubble Room utility functions.
 *
 * Requirements: 2.1, 2.2, 5.2, 5.3
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeTokens,
  jaccardSimilarity,
  findDuplicates,
  computeWeight,
  weightedShuffle,
} from '../bubbleRoom'
import type { BubbleQuestion } from '@/lib/types/bubbleRoom'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeQuestion(overrides: Partial<BubbleQuestion> = {}): BubbleQuestion {
  return {
    id: 'q1',
    class_id: 'class1',
    user_id: 'user1',
    challenge_id: null,
    text: 'How do I solve quadratic equations?',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author_display_name: 'Alice',
    response_count: 0,
    unique_view_count: 0,
    ...overrides,
  }
}

// ── normalizeTokens ──────────────────────────────────────────────────────────

describe('normalizeTokens', () => {
  it('lowercases all characters', () => {
    const tokens = normalizeTokens('HELLO World')
    expect(tokens.has('hello')).toBe(true)
    expect(tokens.has('world')).toBe(true)
  })

  it('strips punctuation', () => {
    const tokens = normalizeTokens('hello, world!')
    expect(tokens.has('hello')).toBe(true)
    expect(tokens.has('world')).toBe(true)
    expect(tokens.has('hello,')).toBe(false)
  })

  it('removes stopwords', () => {
    const tokens = normalizeTokens('How do I solve this problem')
    // 'how', 'do', 'i', 'this' are stopwords
    expect(tokens.has('do')).toBe(false)
    expect(tokens.has('i')).toBe(false)
    expect(tokens.has('this')).toBe(false)
    expect(tokens.has('solve')).toBe(true)
    expect(tokens.has('problem')).toBe(true)
  })

  it('returns empty set for whitespace-only input', () => {
    expect(normalizeTokens('   ').size).toBe(0)
    expect(normalizeTokens('\t\n').size).toBe(0)
  })

  it('returns empty set for stopwords-only input', () => {
    const tokens = normalizeTokens('a the and or but')
    expect(tokens.size).toBe(0)
  })

  it('handles numbers as valid tokens', () => {
    const tokens = normalizeTokens('chapter 42')
    expect(tokens.has('chapter')).toBe(true)
    expect(tokens.has('42')).toBe(true)
  })

  it('returns a Set (deduplicated tokens)', () => {
    const tokens = normalizeTokens('math math math')
    expect(tokens.size).toBe(1)
    expect(tokens.has('math')).toBe(true)
  })
})

// ── jaccardSimilarity ────────────────────────────────────────────────────────

describe('jaccardSimilarity', () => {
  it('returns 1.0 for identical sets', () => {
    const a = new Set(['math', 'solve', 'equation'])
    const b = new Set(['math', 'solve', 'equation'])
    expect(jaccardSimilarity(a, b)).toBe(1.0)
  })

  it('returns 0.0 for disjoint sets', () => {
    const a = new Set(['apple', 'banana'])
    const b = new Set(['cat', 'dog'])
    expect(jaccardSimilarity(a, b)).toBe(0.0)
  })

  it('returns 0.5 for half-overlap', () => {
    const a = new Set(['a', 'b'])
    const b = new Set(['b', 'c'])
    // intersection = {b} = 1; union = {a, b, c} = 3 → 1/3 ≈ 0.333
    // Actual half-overlap: a={1,2}, b={2,3} → 1/3
    // For exactly 0.5: a={1,2}, b={1,3} → intersection=1, union=3 → 1/3 ≠ 0.5
    // a={1,2}, b={1,2,3} → intersection=2, union=3 → 2/3 ≠ 0.5
    // a={1,2}, b={1,2} → 1.0
    // a={1,2,3,4}, b={1,2,5,6} → intersection=2, union=6 → 1/3
    // Symmetric 0.5: a={1,2}, b={2} → intersection=1, union=2 → 0.5
    const x = new Set(['a', 'b'])
    const y = new Set(['b'])
    expect(jaccardSimilarity(x, y)).toBe(0.5)
  })

  it('returns 0.0 for two empty sets', () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(0.0)
  })

  it('returns 0.0 when one set is empty', () => {
    const a = new Set(['hello'])
    const b = new Set<string>()
    expect(jaccardSimilarity(a, b)).toBe(0.0)
  })

  it('score is in range [0,1] for arbitrary inputs', () => {
    const a = new Set(['quadratic', 'formula', 'solve'])
    const b = new Set(['solve', 'linear', 'graph'])
    const score = jaccardSimilarity(a, b)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })
})

// ── findDuplicates ───────────────────────────────────────────────────────────

describe('findDuplicates', () => {
  it('returns empty array when all scores < 0.7', () => {
    const q = makeQuestion({ text: 'quadratic equations help' })
    const results = findDuplicates('completely unrelated fruit salad', [q])
    expect(results).toHaveLength(0)
  })

  it('returns matches above threshold 0.7', () => {
    // "solve quadratic equation factor" vs "solve quadratic equation factor method"
    // candidate tokens (excluding stopwords): solve, quadratic, equation, factor
    // existing tokens: solve, quadratic, equation, factor
    // intersection=4, union=4 → score=1.0
    const q = makeQuestion({ text: 'solve quadratic equation factor' })
    const results = findDuplicates('solve quadratic equation factor', [q])
    expect(results.length).toBeGreaterThan(0)
    results.forEach(m => expect(m.score).toBeGreaterThanOrEqual(0.7))
  })

  it('returns at most 3 matches', () => {
    // Create 5 nearly identical questions
    const questions = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ id: `q${i}`, text: 'how to solve quadratic equation step' }),
    )
    const results = findDuplicates('how to solve quadratic equation step', questions)
    expect(results.length).toBeLessThanOrEqual(3)
  })

  it('sorts results in descending order of score', () => {
    // q1: very similar, q2: somewhat similar
    const q1 = makeQuestion({ id: 'q1', text: 'solve quadratic equation factor' })
    const q2 = makeQuestion({ id: 'q2', text: 'factor polynomial simple' })
    const results = findDuplicates('solve quadratic equation factor method', [q1, q2])

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }
  })
})

// ── computeWeight ─────────────────────────────────────────────────────────────

describe('computeWeight', () => {
  const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000

  it('assigns 2× base weight for questions < 48h old', () => {
    const now = Date.now()
    const recentTime = now - 10 * 60 * 1000 // 10 minutes ago
    const q = makeQuestion({ created_at: new Date(recentTime).toISOString() })
    const weight = computeWeight(q, now)
    // With zero engagement: recencyBoost=2, engagementBoost=1+log1p(0)=1
    expect(weight).toBeCloseTo(2.0)
  })

  it('assigns 1× base weight for questions > 48h old', () => {
    const now = Date.now()
    const oldTime = now - (RECENT_WINDOW_MS + 60 * 1000) // 48h+1min ago
    const q = makeQuestion({ created_at: new Date(oldTime).toISOString() })
    const weight = computeWeight(q, now)
    // With zero engagement: recencyBoost=1, engagementBoost=1
    expect(weight).toBeCloseTo(1.0)
  })

  it('returns 2× weight at exactly 48h boundary (edge case)', () => {
    const now = Date.now()
    const boundaryTime = now - RECENT_WINDOW_MS
    const q = makeQuestion({ created_at: new Date(boundaryTime).toISOString() })
    const weight = computeWeight(q, now)
    // Exactly at boundary → recencyBoost=2
    expect(weight).toBeCloseTo(2.0)
  })

  it('increases weight with engagement (response_count)', () => {
    const now = Date.now()
    const oldTime = now - 72 * 60 * 60 * 1000 // 72h ago, no recency boost
    const qNoEngagement = makeQuestion({ created_at: new Date(oldTime).toISOString(), response_count: 0, unique_view_count: 0 })
    const qHighEngagement = makeQuestion({ created_at: new Date(oldTime).toISOString(), response_count: 10, unique_view_count: 50 })
    expect(computeWeight(qHighEngagement, now)).toBeGreaterThan(computeWeight(qNoEngagement, now))
  })

  it('returns weight ≥ 1.0 for any question', () => {
    const now = Date.now()
    const q = makeQuestion({ created_at: new Date(0).toISOString(), response_count: 0, unique_view_count: 0 })
    expect(computeWeight(q, now)).toBeGreaterThanOrEqual(1.0)
  })
})

// ── weightedShuffle ───────────────────────────────────────────────────────────

describe('weightedShuffle', () => {
  it('returns all input questions exactly once', () => {
    const questions = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ id: `q${i}` }),
    )
    const result = weightedShuffle(questions)
    expect(result).toHaveLength(5)
    const ids = result.map(q => q.id).sort()
    expect(ids).toEqual(['q0', 'q1', 'q2', 'q3', 'q4'])
  })

  it('returns empty array for empty input', () => {
    expect(weightedShuffle([])).toHaveLength(0)
  })

  it('returns single question unchanged', () => {
    const questions = [makeQuestion({ id: 'only' })]
    expect(weightedShuffle(questions)[0].id).toBe('only')
  })

  it('produces different orderings across runs (probabilistic)', () => {
    const questions = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ id: `q${i}` }),
    )
    const RUNS = 100
    let differentCount = 0
    const firstOrder = weightedShuffle(questions).map(q => q.id).join(',')

    for (let i = 0; i < RUNS; i++) {
      const order = weightedShuffle(questions).map(q => q.id).join(',')
      if (order !== firstOrder) differentCount++
    }

    // Should produce different orderings > 95% of the time
    expect(differentCount / RUNS).toBeGreaterThan(0.95)
  })

  it('does not mutate the input array', () => {
    const questions = [makeQuestion({ id: 'q1' }), makeQuestion({ id: 'q2' })]
    const original = [...questions]
    weightedShuffle(questions)
    expect(questions[0].id).toBe(original[0].id)
    expect(questions[1].id).toBe(original[1].id)
  })
})
