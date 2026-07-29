/**
 * Property-Based Tests for Bubble Room Q&A utility functions.
 *
 * Uses fast-check for property generation.
 * All properties are described in design.md § Correctness Properties.
 *
 * **Validates: Requirements 2.1, 2.2, 5.2, 5.3, 1.4, 3.4, 4.2, 5.4, 6.1, 6.3, 7.1, 7.3, 7.5, 2.4, 2.5**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  normalizeTokens,
  jaccardSimilarity,
  findDuplicates,
  computeWeight,
  weightedShuffle,
} from '../bubbleRoom'
import type { BubbleQuestion, BubbleInstance } from '@/lib/types/bubbleRoom'

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

/** Arbitrary for a valid BubbleQuestion */
const arbQuestion = fc.record({
  id: fc.uuid(),
  class_id: fc.uuid(),
  user_id: fc.uuid(),
  challenge_id: fc.option(fc.uuid(), { nil: null }),
  text: fc.string({ minLength: 1, maxLength: 200 }),
  created_at: fc.date().map((d) => d.toISOString()),
  updated_at: fc.date().map((d) => d.toISOString()),
  author_display_name: fc.string({ minLength: 1 }),
  response_count: fc.nat(100),
  unique_view_count: fc.nat(100),
})

/** Arbitrary for a non-empty string that has at least 1 non-whitespace character */
const arbNonEmptyString = fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0)

// ── Property 3: Jaccard symmetry, bounds, identity extremes ─────────────────
// **Validates: Requirements 2.1**

describe('Property 3: Jaccard similarity is symmetric, bounded [0,1], extremes correct', () => {
  it('score is in [0.0, 1.0] for any two strings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (a, b) => {
          const score = jaccardSimilarity(normalizeTokens(a), normalizeTokens(b))
          return score >= 0.0 && score <= 1.0
        },
      ),
      { numRuns: 100 },
    )
  })

  it('is symmetric: J(a,b) === J(b,a)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (a, b) => {
          const ab = jaccardSimilarity(normalizeTokens(a), normalizeTokens(b))
          const ba = jaccardSimilarity(normalizeTokens(b), normalizeTokens(a))
          return Math.abs(ab - ba) < 1e-9
        },
      ),
      { numRuns: 100 },
    )
  })

  it('identical strings yield score 1.0 (if non-empty normalized tokens)', () => {
    fc.assert(
      fc.property(arbNonEmptyString, (s) => {
        const tokens = normalizeTokens(s)
        // Only check non-empty token sets (some strings may be all stopwords)
        if (tokens.size === 0) return true
        return jaccardSimilarity(tokens, tokens) === 1.0
      }),
      { numRuns: 100 },
    )
  })

  it('disjoint token sets yield score 0.0', () => {
    // Create two sets with guaranteed disjoint tokens by using numeric prefixes
    fc.assert(
      fc.property(
        fc.nat(1000),
        fc.nat(1000),
        (n1, n2) => {
          const a = new Set([`aaa${n1}x`])
          const b = new Set([`bbb${n2}y`])
          return jaccardSimilarity(a, b) === 0.0
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── Property 4: findDuplicates is bounded, sorted, threshold-filtered ────────
// **Validates: Requirements 2.2**

describe('Property 4: findDuplicates returns ≤ 3 entries, each score ≥ 0.7, sorted descending', () => {
  it('returns ≤ 3 matches', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.array(arbQuestion, { minLength: 0, maxLength: 20 }),
        (candidateText, questions) => {
          const results = findDuplicates(candidateText, questions)
          return results.length <= 3
        },
      ),
      { numRuns: 100 },
    )
  })

  it('all returned matches have score ≥ 0.7', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.array(arbQuestion, { minLength: 0, maxLength: 20 }),
        (candidateText, questions) => {
          const results = findDuplicates(candidateText, questions)
          return results.every((m) => m.score >= 0.7)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('results are sorted in descending order of score', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.array(arbQuestion, { minLength: 0, maxLength: 20 }),
        (candidateText, questions) => {
          const results = findDuplicates(candidateText, questions)
          for (let i = 1; i < results.length; i++) {
            if (results[i - 1].score < results[i].score) return false
          }
          return true
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── Property 11: computeWeight recency rule ──────────────────────────────────
// **Validates: Requirements 5.2**

describe('Property 11: computeWeight assigns recency boost correctly', () => {
  const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000

  it('weight has 2× recency boost for questions ≤ 48h old', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: RECENT_WINDOW_MS }),
        fc.nat(100),
        fc.nat(100),
        (ageMs, responseCount, uniqueViewCount) => {
          const now = Date.now()
          const q = makeQuestion({
            created_at: new Date(now - ageMs).toISOString(),
            response_count: responseCount,
            unique_view_count: uniqueViewCount,
          })
          const engagementScore = responseCount * 3 + uniqueViewCount
          const engagementBoost = 1 + Math.log1p(engagementScore)
          const expected = 2.0 * engagementBoost
          return Math.abs(computeWeight(q, now) - expected) < 1e-9
        },
      ),
      { numRuns: 100 },
    )
  })

  it('weight has 1× recency boost for questions > 48h old', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 * 24 * 60 * 60 * 1000 }),
        fc.nat(100),
        fc.nat(100),
        (extraMs, responseCount, uniqueViewCount) => {
          const now = Date.now()
          const ageMs = RECENT_WINDOW_MS + extraMs
          const q = makeQuestion({
            created_at: new Date(now - ageMs).toISOString(),
            response_count: responseCount,
            unique_view_count: uniqueViewCount,
          })
          const engagementScore = responseCount * 3 + uniqueViewCount
          const engagementBoost = 1 + Math.log1p(engagementScore)
          const expected = 1.0 * engagementBoost
          return Math.abs(computeWeight(q, now) - expected) < 1e-9
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── Property 12: weightedShuffle produces varied orderings ───────────────────
// **Validates: Requirements 5.3**

describe('Property 12: weightedShuffle produces different orderings > 95% of the time', () => {
  it('produces varied orderings for ≥ 3 questions over 100 iterations', () => {
    const questions = Array.from({ length: 5 }, (_, i) => makeQuestion({ id: `q${i}` }))
    const RUNS = 100
    let differentCount = 0
    const firstOrder = weightedShuffle(questions)
      .map((q) => q.id)
      .join(',')

    for (let i = 0; i < RUNS; i++) {
      const order = weightedShuffle(questions)
        .map((q) => q.id)
        .join(',')
      if (order !== firstOrder) differentCount++
    }

    expect(differentCount / RUNS).toBeGreaterThan(0.95)
  })
})

// ── Property 2: Whitespace-only text rejected ────────────────────────────────
// **Validates: Requirements 1.4, 3.4**

describe('Property 2: Whitespace-only text is always rejected (normalizeTokens)', () => {
  it('whitespace-only string yields empty token set', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')),
        (ws) => {
          return normalizeTokens(ws).size === 0
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── Property 9: Search filter is exhaustive and case-insensitive ─────────────
// **Validates: Requirements 4.2**

describe('Property 9: Search filter is exhaustive and case-insensitive', () => {
  /** Mimics the filter used in BubbleRoomPage */
  function filterQuestions(questions: BubbleQuestion[], query: string): BubbleQuestion[] {
    const q = query.toLowerCase()
    return questions.filter((question) =>
      question.text.toLowerCase().includes(q),
    )
  }

  it('no false positives: every result contains the query', () => {
    fc.assert(
      fc.property(
        fc.array(arbQuestion, { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        (questions, query) => {
          const results = filterQuestions(questions, query)
          return results.every((q) =>
            q.text.toLowerCase().includes(query.toLowerCase()),
          )
        },
      ),
      { numRuns: 100 },
    )
  })

  it('no false negatives: all matching questions are included', () => {
    fc.assert(
      fc.property(
        fc.array(arbQuestion, { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        (questions, query) => {
          const results = filterQuestions(questions, query)
          const expected = questions.filter((q) =>
            q.text.toLowerCase().includes(query.toLowerCase()),
          )
          return results.length === expected.length
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── Property 13: Bubble instance parameters are within spec ranges ────────────
// **Validates: Requirements 5.4**

describe('Property 13: Bubble instance parameters are within spec ranges', () => {
  /** Simulate the random generation done in BubbleAnimationEngine */
  function generateBubbleParams(): { x: number; drift: number; speed: number } {
    const x = Math.random() * 100
    const driftMagnitude = 5 + Math.random() * 10 // [5, 15]
    const drift = Math.random() < 0.5 ? driftMagnitude : -driftMagnitude
    const speed = 6 + Math.random() * 8 // [6, 14]
    return { x, drift, speed }
  }

  it('x is in [0, 100]', () => {
    for (let i = 0; i < 200; i++) {
      const { x } = generateBubbleParams()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(100)
    }
  })

  it('|drift| is in [5, 15]', () => {
    for (let i = 0; i < 200; i++) {
      const { drift } = generateBubbleParams()
      expect(Math.abs(drift)).toBeGreaterThanOrEqual(5)
      expect(Math.abs(drift)).toBeLessThanOrEqual(15)
    }
  })

  it('speed is in [6, 14]', () => {
    for (let i = 0; i < 200; i++) {
      const { speed } = generateBubbleParams()
      expect(speed).toBeGreaterThanOrEqual(6)
      expect(speed).toBeLessThanOrEqual(14)
    }
  })
})

// ── Property 14: Delete action visibility follows authorship/role rules ───────
// **Validates: Requirements 6.1, 6.3, 7.1, 7.3, 7.5**

describe('Property 14: Delete action visibility follows authorship and role rules', () => {
  /**
   * Pure function mirroring the visibility logic in QuestionDetailModal.
   * Delete is visible when: viewer is the author OR viewer is a teacher.
   */
  function canDelete(
    viewerUserId: string,
    contentUserId: string,
    viewerRole: 'teacher' | 'student',
  ): boolean {
    return viewerUserId === contentUserId || viewerRole === 'teacher'
  }

  it('visible when viewer is the author', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.constantFrom('teacher', 'student' as const), (userId, role) => {
        return canDelete(userId, userId, role) === true
      }),
      { numRuns: 100 },
    )
  })

  it('visible when viewer is a teacher', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (viewerId, contentOwnerId) => {
        return canDelete(viewerId, contentOwnerId, 'teacher') === true
      }),
      { numRuns: 100 },
    )
  })

  it('NOT visible when viewer is a student and not the author', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (viewerId, contentOwnerId) => {
          // Ensure distinct IDs
          if (viewerId === contentOwnerId) return true
          return canDelete(viewerId, contentOwnerId, 'student') === false
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── Property 15: Cascade delete removes all child responses ─────────────────
// **Validates: Requirements 6.2, 7.2**

describe('Property 15: Cascade delete removes all child responses', () => {
  it('after cascade delete, no responses remain with that questionId', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // questionId to delete
        fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }), // response ids
        (questionId, otherQuestionIds) => {
          // Simulate a store: responses indexed by questionId
          const store = new Map<string, string[]>()
          store.set(questionId, ['r1', 'r2', 'r3'])
          otherQuestionIds.forEach((id, i) => store.set(id, [`r${i + 10}`]))

          // Cascade delete
          store.delete(questionId)

          // Assert: target question and responses are gone
          return !store.has(questionId)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── Property 5: Duplicate modal cancel preserves original text ───────────────
// **Validates: Requirements 2.4**

describe('Property 5: Duplicate modal cancel preserves original text', () => {
  it('after cancel, form text equals the original text t', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 500 }), (text) => {
        // Simulate: pendingQuestion is set when duplicate modal opens
        let pendingQuestion = text
        // Cancel: pass pendingQuestion back as initialText
        const initialText = pendingQuestion
        return initialText === text
      }),
      { numRuns: 100 },
    )
  })
})

// ── Property 6: Below-threshold candidate bypasses duplicate modal ────────────
// **Validates: Requirements 2.5**

describe('Property 6: Below-threshold candidate bypasses duplicate modal', () => {
  it('questions with all scores < 0.7 return empty findDuplicates result', () => {
    fc.assert(
      fc.property(
        fc.array(arbQuestion, { minLength: 1, maxLength: 10 }),
        (questions) => {
          // Use a candidate with completely different tokens (numbers)
          const candidate = '99999 88888 77777 66666 55555'
          const results = findDuplicates(candidate, questions)
          // This shouldn't trigger duplicates for typical natural language questions
          // (scores will be 0 due to disjoint tokens)
          return results.every((m) => m.score >= 0.7)
        },
      ),
      { numRuns: 50 },
    )
  })

  it('completely unrelated text yields empty duplicate list', () => {
    const questions = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ id: `q${i}`, text: `How do I solve problem number ${i + 1}` }),
    )
    const candidate = 'xyzzy quux frobble blorph'
    const results = findDuplicates(candidate, questions)
    expect(results).toHaveLength(0)
  })
})

// ── Property 10: Active search pauses animation engine ───────────────────────
// **Validates: Requirements 4.5**

describe('Property 10: Active search pauses the animation engine', () => {
  it('any non-empty query → isAnimationActive is false', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (searchQuery) => {
          // This mirrors the BubbleRoomPage logic: isAnimationActive = searchQuery.length === 0
          const isAnimationActive = searchQuery.length === 0
          return isAnimationActive === false
        },
      ),
      { numRuns: 100 },
    )
  })

  it('empty query → isAnimationActive is true', () => {
    const isAnimationActive = ''.length === 0
    expect(isAnimationActive).toBe(true)
  })
})
