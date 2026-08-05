/**
 * How long the announcement button shines, and whether it still is.
 *
 * Separate from lib/actions/announcements.ts because a 'use server' file may
 * only export async functions — a plain constant is a build error there. That
 * constraint is right: this is pure arithmetic with no request context, and
 * keeping it here means it can be imported by the client, the server and the
 * tests alike, and tested without mocking a database.
 */

/** Days the button shines for a student, from the first time they see it. */
export const ANNOUNCEMENT_SHINE_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * @param firstSeenAt when this student first had the button rendered to them,
 *   or null if never — which is itself the first render, so it shines.
 * @param now injectable so the boundary can be tested without waiting 3 days.
 */
export function isWithinShineWindow(
  firstSeenAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!firstSeenAt) return true
  const elapsed = now.getTime() - new Date(firstSeenAt).getTime()
  // Strictly less than: exactly three days is out, so "3 days" means three
  // days and not a moment more.
  return elapsed < ANNOUNCEMENT_SHINE_DAYS * DAY_MS
}
