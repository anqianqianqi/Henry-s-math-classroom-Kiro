/**
 * TypeScript type definitions for the Bubble Room Q&A feature.
 *
 * Requirements: 1.1, 3.3
 */

/**
 * A question posted to the Bubble Room.
 * Includes denormalised counts from joined tables.
 */
export interface BubbleQuestion {
  id: string
  class_id: string
  user_id: string
  challenge_id: string | null
  title: string | null          // optional short title (≤120 chars)
  text: string
  created_at: string            // ISO 8601
  updated_at: string
  author_display_name: string   // joined from profiles
  response_count: number        // COUNT from bubble_room_responses
  unique_view_count: number     // COUNT from bubble_room_question_views
}

/**
 * A response posted to a Bubble Room question.
 */
export interface BubbleResponse {
  id: string
  question_id: string
  user_id: string
  text: string
  created_at: string
  responder_display_name: string  // joined from profiles
  responder_role: 'teacher' | 'student'
}

/**
 * A candidate duplicate match returned by findDuplicates.
 */
export interface DuplicateMatch {
  question: BubbleQuestion
  score: number  // 0.0–1.0 Jaccard similarity
}

/**
 * A live bubble instance managed by BubbleAnimationEngine.
 */
export interface BubbleInstance {
  question: BubbleQuestion
  id: string       // unique animation instance id (not question id)
  x: number        // 0–100 (% viewport width) horizontal start position
  drift: number    // ±5–15 (% vw) lateral drift offset
  speed: number    // 6–14 seconds rise speed
  startedAt: number  // Date.now() when spawned
}
