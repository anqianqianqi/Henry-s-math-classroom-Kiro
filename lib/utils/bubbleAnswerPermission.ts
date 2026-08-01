/**
 * Who may post a reply in the bubble room.
 *
 * Answering is a TA's job. A student without the badge reads the room and asks
 * their own questions, but does not answer other people's — otherwise the
 * "answer" a classmate acts on carries no more weight than a guess, and the TA
 * badge means nothing beyond a chip in the header.
 *
 * ── WHY THE OWNER IS ALWAYS ALLOWED ─────────────────────────
 * A thread is a conversation, not a wall. A TA who replies "what have you tried
 * so far?" needs an answer, and the only person who can give it is the asker.
 * Locking the owner out would leave every clarifying question unanswerable and
 * quietly kill the threads this feature exists to support.
 *
 * ── WHERE THIS IS ENFORCED ──────────────────────────────────
 * This function decides what the UI shows. The rule that actually holds is the
 * brr_insert policy in supabase/restrict-bubble-answers.sql, which asks the same
 * three questions of the database. Hiding a form stops an honest mistake; only
 * the policy stops a crafted insert.
 */

export interface AnswerPermissionInput {
  /** Whether the viewer wrote the question being answered. */
  isOwner: boolean
  role: 'teacher' | 'student'
  /** Holds an unrevoked bubble_room_ta badge. */
  isTA: boolean
}

export function canAnswerBubble({ isOwner, role, isTA }: AnswerPermissionInput): boolean {
  return isOwner || role === 'teacher' || isTA
}
