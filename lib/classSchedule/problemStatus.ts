/**
 * Where a student stands on one problem, in one word.
 *
 * The calendar has room for a short parenthetical under a problem and nothing
 * more, so this collapses four columns — was it submitted, was it graded, what
 * was the score, what was it out of — into the one thing the student wants to
 * know: is there anything left for me to do here.
 *
 * ── WHY 'partial' SAYS "CHECK COMMENT" ──────────────────────
 * A score below full is not a verdict, it is a conversation: the teacher has
 * written something on the submission. Reporting the number here would invite
 * the student to read the mark and stop, which is the opposite of what a
 * partial score is for.
 *
 * ── TEACHERS DO NOT GET THIS ────────────────────────────────
 * None of it means anything for them — they set the problem and they wrote the
 * comment. Their calendar carries classes only.
 */

export type ProblemStatus =
  /** Nothing handed in yet. */
  | 'todo'
  /** Handed in, waiting on the teacher. */
  | 'ungraded'
  /** Graded at full marks. */
  | 'done'
  /** Graded below full marks — there is a comment to read. */
  | 'partial'

export interface ProblemMarks {
  submitted: boolean
  /** Null while ungraded. */
  points?: number | null
  /** Null when the problem never said, in which case 100 is the site default. */
  maxPoints?: number | null
}

/** What the site treats as full marks when a problem does not say. */
export const DEFAULT_MAX_POINTS = 100

export function problemStatus(p: ProblemMarks): ProblemStatus {
  if (!p.submitted) return 'todo'
  // Ungraded is the absence of a score, not a zero. A student who genuinely
  // scored 0 has been graded and should be sent to the comment, not left
  // thinking their work is still in the queue.
  if (p.points === null || p.points === undefined) return 'ungraded'

  const max = p.maxPoints ?? DEFAULT_MAX_POINTS
  // >= rather than ===: bonus marks exist, and a student who scored 105 out of
  // 100 should not be told to go and check what went wrong.
  return p.points >= max ? 'done' : 'partial'
}
