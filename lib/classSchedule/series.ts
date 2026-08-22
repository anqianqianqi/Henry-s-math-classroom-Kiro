/**
 * Turning a recurring schedule into dated sessions.
 *
 * A class no longer carries a weekly time. It has zero or more rows in
 * class_schedule_series, and this is what expands one of them into the
 * class_occurrences a calendar actually shows.
 *
 * ── WHY NOT generateOccurrences ─────────────────────────────
 * lib/utils/occurrences.ts already expands a pattern, but it takes day NAMES
 * ('Monday') where a series stores a weekday number, and it numbers sessions
 * `index + 1` within whatever batch it was handed. That is right for the one
 * call it was written for — every session of a brand new class, generated at
 * once — and wrong for every call made from a calendar, where the class
 * already has sessions and the second batch would restart at 1 and collide.
 *
 * Numbering is therefore not done at generation time here at all. See
 * renumberByDate.
 */

/** Sunday = 0, matching Date.getDay(), the calendar grid and the stored column. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface ScheduleSeries {
  id: string
  class_id: string
  weekday: number
  /** 'HH:MM:SS' in the class's own timezone. */
  start_time: string
  end_time: string
  effective_from: string
  effective_until: string | null
  /**
   * IANA zone the times above are written in — whoever scheduled it.
   *
   * Null on a row predating add-session-timezone.sql, where the reader falls
   * back to the class's own zone, which is what it meant anyway.
   */
  timezone?: string | null
}

const pad = (n: number) => (n < 10 ? `0${n}` : String(n))

/** 'YYYY-MM-DD' parsed as a local date. Parsing it as UTC shifts the weekday. */
function parseLocal(ds: string): Date {
  const [y, m, d] = ds.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function format(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Where generation may begin.
 *
 * The later of the series' own start and today, so a schedule changed mid-term
 * cannot retroactively rewrite sessions that already happened. A teacher moving
 * Monday's class from 4pm to 5pm in October is saying something about the rest
 * of the term, not about September.
 */
export function generationStart(effectiveFrom: string, today: string): string {
  return effectiveFrom > today ? effectiveFrom : today
}

/**
 * Every date matching `weekday` in [from, until], inclusive.
 *
 * Returns [] rather than throwing when the window is empty or inverted: an
 * empty range is a real answer here — a series whose effective_until has
 * already passed simply generates nothing — and making the caller catch for it
 * would mean a try/catch around ordinary use.
 */
export function weekdayDatesBetween(weekday: number, from: string, until: string): string[] {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new Error(`weekday must be 0-6, got ${weekday}`)
  }
  if (until < from) return []

  const end = parseLocal(until)
  const cursor = parseLocal(from)
  // Step to the first matching weekday. (7 + a - b) % 7 keeps it positive.
  cursor.setDate(cursor.getDate() + ((7 + weekday - cursor.getDay()) % 7))

  const out: string[] = []
  while (cursor <= end) {
    out.push(format(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }
  return out
}

export interface PlannedSession {
  class_id: string
  series_id: string
  occurrence_date: string
  start_time: string
  end_time: string
  status: 'upcoming'
}

/**
 * The rows a series should produce, forward of today, up to `until`.
 *
 * `until` is passed rather than read from the series because effective_until is
 * nullable — an open-ended series would otherwise have to invent its own
 * horizon, and "how far forward" is a question for whoever is looking at the
 * form, not for this function.
 *
 * `skipDates` is what the class already has on the books, so re-running a
 * series does not double-book a day someone added by hand.
 */
export function planSessions(
  series: ScheduleSeries,
  today: string,
  until: string,
  skipDates: Iterable<string> = [],
): PlannedSession[] {
  const horizon = series.effective_until && series.effective_until < until
    ? series.effective_until
    : until
  const taken = new Set(skipDates)

  return weekdayDatesBetween(series.weekday, generationStart(series.effective_from, today), horizon)
    .filter(d => !taken.has(d))
    .map(occurrence_date => ({
      class_id: series.class_id,
      series_id: series.id,
      occurrence_date,
      start_time: series.start_time,
      end_time: series.end_time,
      status: 'upcoming' as const,
    }))
}

export interface NumberedSession {
  id: string
  occurrence_date: string
  start_time: string
  session_number?: number
}

/**
 * A class's sittings, numbered in the order they happen.
 *
 * Recomputed across the whole class after any change rather than continued from
 * the current maximum. Continuing is cheaper and wrong: add a session between
 * two existing ones — which is the entire point of being able to click a day —
 * and the class ends up with two Session 7s and a gap, which students notice
 * and nobody can explain.
 *
 * Only rows whose number actually changes are returned, so the common case of
 * appending to the end writes one row rather than forty.
 */
export function renumberByDate(sessions: NumberedSession[]): { id: string; session_number: number }[] {
  const ordered = [...sessions].sort((a, b) =>
    a.occurrence_date === b.occurrence_date
      ? a.start_time.localeCompare(b.start_time)
      : a.occurrence_date.localeCompare(b.occurrence_date))

  const changed: { id: string; session_number: number }[] = []
  ordered.forEach((s, i) => {
    const next = i + 1
    if (s.session_number !== next) changed.push({ id: s.id, session_number: next })
  })
  return changed
}

/** 'HH:MM' or 'HH:MM:SS' → 'HH:MM:SS', which is what a TIME column wants. */
export function toSqlTime(time: string): string {
  return /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time
}

/** 'HH:MM:SS' → 'HH:MM', for a form field or a label. */
export function fromSqlTime(time: string): string {
  return time.slice(0, 5)
}
