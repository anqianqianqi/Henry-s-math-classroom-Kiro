/**
 * Bubble Room Q&A — pure client-side utility functions.
 *
 * Contains:
 *  - normalizeTokens: text → Set<string>
 *  - jaccardSimilarity: Set × Set → [0,1]
 *  - findDuplicates: candidate text × questions → DuplicateMatch[]
 *  - computeWeight: composite recency × engagement weight
 *  - weightedShuffle: Algorithm A-Res (Efraimidis & Spirakis)
 *
 * All functions are pure — no side effects, no external I/O.
 *
 * Requirements: 2.1, 2.2, 5.2, 5.3
 */

import type { BubbleQuestion, DuplicateMatch } from '@/lib/types/bubbleRoom'

// ── Constants ────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were',
  'i', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'this', 'that',
  'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'not', 'do', 'does', 'did',
])

const DUPLICATE_THRESHOLD = 0.7
const MAX_MATCHES = 3

/** 48 hours in milliseconds — recency window for 2× weight boost */
const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000

// ── Token Normalisation ──────────────────────────────────────────────────────

/**
 * Normalize a string to a set of meaningful tokens.
 * Steps: lowercase → strip punctuation → split on whitespace → drop stopwords.
 *
 * @param text - Input string to tokenize
 * @returns Set of meaningful lowercased tokens
 */
export function normalizeTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0 && !STOPWORDS.has(t)),
  )
}

// ── Jaccard Similarity ───────────────────────────────────────────────────────

/**
 * Compute Jaccard similarity between two token sets.
 * Returns 0.0 for two empty sets to avoid 0/0.
 *
 * @param a - First token set
 * @param b - Second token set
 * @returns Jaccard similarity score in [0.0, 1.0]
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  const intersection = new Set([...a].filter(t => b.has(t)))
  const union = new Set([...a, ...b])
  return intersection.size / union.size
}

// ── Duplicate Detection ──────────────────────────────────────────────────────

/**
 * Find questions similar to the candidate text using Jaccard similarity.
 *
 * Returns at most MAX_MATCHES (3) results with score ≥ DUPLICATE_THRESHOLD (0.7),
 * sorted in descending order of score.
 *
 * Complexity: O(n × |tokens|) — suitable for classroom-scale sets (< 500 questions).
 *
 * @param candidateText     - The new question text entered by the student
 * @param existingQuestions - List of existing questions in the same class
 * @returns Up to 3 DuplicateMatch objects, sorted by descending score
 */
export function findDuplicates(
  candidateText: string,
  existingQuestions: BubbleQuestion[],
): DuplicateMatch[] {
  const candidateTokens = normalizeTokens(candidateText)
  return existingQuestions
    .map(q => ({
      question: q,
      score: jaccardSimilarity(candidateTokens, normalizeTokens(q.text)),
    }))
    .filter(m => m.score >= DUPLICATE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES)
}

// ── Weighted Shuffle ─────────────────────────────────────────────────────────

/**
 * Compute composite weight for a question.
 *
 * - Recency boost:    questions < 48 h old get 2× base weight.
 * - Engagement boost: log-scaled so popular questions surface more often
 *   without completely dominating the cycle.
 *   engagement_score = (response_count × 3) + unique_view_count
 *
 * Why log-scale? A question with 100 responses would otherwise get 300× the weight
 * of a brand-new question, making the cycle deterministic. Math.log1p compresses the
 * range while still rewarding popular questions.
 *
 * Why responses weighted 3×? Responses represent deeper engagement than passive views.
 *
 * @param question - The question to weight
 * @param now      - Reference timestamp (default: Date.now())
 * @returns Composite weight ≥ 1.0
 */
export function computeWeight(
  question: BubbleQuestion,
  now: number = Date.now(),
): number {
  const ageMs = now - new Date(question.created_at).getTime()
  const recencyBoost = ageMs <= RECENT_WINDOW_MS ? 2.0 : 1.0

  const engagementScore = (question.response_count * 3) + question.unique_view_count
  // Math.log1p(0) = 0, so brand-new questions with no engagement get base weight
  const engagementBoost = 1 + Math.log1p(engagementScore)

  return recencyBoost * engagementBoost
}

/**
 * Weighted reservoir shuffle using Algorithm A-Res (Efraimidis & Spirakis).
 *
 * Each item receives a key = u^(1/weight) where u ~ Uniform(0,1).
 * Items sorted descending by key → higher weight → higher expected rank.
 *
 * @param questions - Questions to shuffle
 * @param now       - Reference timestamp (default: Date.now())
 * @returns A new array with the same questions in weighted-random order
 */
export function weightedShuffle(
  questions: BubbleQuestion[],
  now: number = Date.now(),
): BubbleQuestion[] {
  return questions
    .map(question => ({
      question,
      key: Math.pow(Math.random(), 1 / computeWeight(question, now)),
    }))
    .sort((a, b) => b.key - a.key)
    .map(({ question }) => question)
}
