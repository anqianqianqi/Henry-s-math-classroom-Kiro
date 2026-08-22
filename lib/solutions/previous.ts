/**
 * Matching a student's existing submissions to the problems in a set.
 *
 * ── WHY THIS IS NOT A ONE-LINE LOOKUP ───────────────────────
 * A submission carries two possible keys. A problem published from the
 * challenge bank is answered against the BANK item, so that republishing the
 * problem keeps the student's work; an ad-hoc problem is answered against the
 * daily challenge itself. Deleting an instance sets challenge_id to NULL and
 * leaves the row standing on bank_item_id alone
 * (add-bank-item-submissions.sql, fix-daily-challenges-delete-policy.sql).
 *
 * Matching on challenge_id alone therefore found nothing for any problem that
 * came from the bank. The upload showed no sign that such a problem had been
 * answered and no picture of the answer — and, worse than the missing notice,
 * would have inserted a SECOND submission beside the one already there, since
 * the unique index guarding against that only covers rows with a null
 * bank_item_id.
 *
 * Pure, so the rule can be tested without a database.
 */

/** Only the fields the matching needs, from either table shape. */
export interface SubmissionRow {
  id: string
  challenge_id?: string | null
  bank_item_id?: string | null
}

export interface ProblemKeys {
  id: string
  source_bank_id?: string | null
}

/**
 * The submission belonging to each problem, keyed by problem id.
 *
 * The bank id is tried first: it is the key that survives a republish, and
 * where a row matches both routes they are the same answer reached two ways.
 */
export function matchPrevious<R extends SubmissionRow>(
  problems: ProblemKeys[],
  rows: R[],
): Map<string, R> {
  const found = new Map<string, R>()

  for (const problem of problems) {
    const byBank = problem.source_bank_id
      ? rows.find(r => r.bank_item_id && r.bank_item_id === problem.source_bank_id)
      : undefined
    const match = byBank ?? rows.find(r => r.challenge_id && r.challenge_id === problem.id)
    if (match) found.set(problem.id, match)
  }

  return found
}
