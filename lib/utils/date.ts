/**
 * Date utilities — backend stores UTC, display in the reader's own timezone.
 *
 * ── WHAT BELONGS HERE, AND WHAT DOES NOT ────────────────────
 * These format INSTANTS: the moment something happened. A submission, a
 * comment, a redemption. Those belong in the reader's own zone — "you
 * submitted at 3:42pm" has to mean 3:42pm where they are — and that is what
 * toLocaleString with an undefined locale gives.
 *
 * School CALENDAR dates are a different thing and live in utils/timezone.ts.
 * `challenge_date` is a day with no time and no zone; asking the browser what
 * day it is gets that wrong for everyone outside New York. localDateString and
 * localDateOffset used to live here and were used for exactly that, so they
 * have been removed rather than deprecated — leaving them would let the same
 * mistake back in, and the compiler catching every call site is what made the
 * migration safe.
 */

/**
 * Format a date-only string (YYYY-MM-DD) for display in the user's local timezone.
 * Uses T12:00:00 to avoid off-by-one day issues from timezone offsets.
 */
export function formatDate(
  dateStr: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string {
  if (!dateStr) return '\u2014'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, options)
}

/**
 * Format a full UTC timestamp in the user's local timezone.
 */
export function formatDateTime(
  isoString: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
): string {
  if (!isoString) return '\u2014'
  return new Date(isoString).toLocaleString(undefined, options)
}

/**
 * Format a UTC timestamp showing only the date portion in local timezone.
 */
export function formatDateFromTimestamp(
  isoString: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string {
  if (!isoString) return '\u2014'
  return new Date(isoString).toLocaleDateString(undefined, options)
}
