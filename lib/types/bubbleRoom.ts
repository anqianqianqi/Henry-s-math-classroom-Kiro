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
  /** Stored translations — see supabase/add-user-text-translations.sql.
   *  Read with localizeQuestion(); the originals above stay authoritative for
   *  search and duplicate detection. */
  title_en?: string | null
  title_zh?: string | null
  text_en?: string | null
  text_zh?: string | null
  text_lang?: 'en' | 'zh' | 'other' | null
  text: string
  image_url: string | null      // optional attached image
  created_at: string            // ISO 8601
  updated_at: string
  expires_at?: string | null    // null = legacy row (no expiry set yet)
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
  /** Stored translations — read with pickTranslation(). */
  text_en?: string | null
  text_zh?: string | null
  text_lang?: 'en' | 'zh' | 'other' | null
  image_url: string | null      // optional attached image
  created_at: string
  responder_display_name: string  // joined from profiles
  responder_role: 'teacher' | 'student'
  responder_badges?: Array<{ slug: string; name: string; emoji: string; color: string }>
}

/**
 * An assignment linking a question to a specific responder (teacher or TA).
 */
export interface BubbleQuestionAssignment {
  id: string
  question_id: string
  assignee_id: string
  assigned_by: string
  responded_at: string | null
  created_at: string
  question?: BubbleQuestion  // joined when fetching "assigned to me"
}
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
