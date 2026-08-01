/**
 * TA points — the rules, separate from any database call so they can be tested.
 *
 * A TA point is earned by being thanked on a question you answered. Staff are
 * excluded: helping is part of the job, and paying teachers would make the
 * leaderboard meaningless.
 */

/** Points granted for one thanks. */
export const TA_POINTS_PER_THANKS = 1

/**
 * Whether thanking this person should pay them.
 *
 * Decided ONCE, at the moment of thanks, and stored on the row — never
 * recomputed. A student promoted to teacher later must not retroactively lose
 * points they were fairly given, and a teacher who steps down must not
 * retroactively gain them.
 */
export function shouldAwardPoint(recipientIsStaff: boolean): boolean {
  return !recipientIsStaff
}

/**
 * Who the owner may thank.
 *
 * The owner is excluded because a student can answer their own question — so
 * without this, thanking yourself would mint a point out of nothing. The
 * database refuses it as well, but offering a choice that will be rejected is
 * a worse experience than not offering it.
 */
export function thankableResponders<T extends { userId: string }>(
  responders: T[],
  ownerId: string,
): T[] {
  const seen = new Set<string>()
  return responders.filter(r => {
    if (r.userId === ownerId) return false
    if (seen.has(r.userId)) return false   // answered more than once
    seen.add(r.userId)
    return true
  })
}

/**
 * Spendable TA points.
 *
 * Mirrors computeSpendableBalance for challenge points: earning and spending
 * are separate totals, and spending never reduces what was earned.
 */
export function computeTaBalance(earned: number, spent: number): number {
  return earned - spent
}
