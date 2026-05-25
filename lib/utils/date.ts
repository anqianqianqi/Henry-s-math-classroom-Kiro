/**
 * Date utilities — backend stores UTC, display in user's local timezone.
 */

/**
 * Get today's date as YYYY-MM-DD in the user's LOCAL timezone.
 * Use this instead of new Date().toISOString().split('T')[0] which gives UTC date.
 */
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Get a date offset from today as YYYY-MM-DD in the user's LOCAL timezone.
 * e.g. localDateOffset(7) = 7 days from now, localDateOffset(-1) = yesterday
 */
export function localDateOffset(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return localDateString(date)
}

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
