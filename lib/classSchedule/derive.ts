/**
 * Reading a class's meeting pattern back out of its sessions.
 *
 * classes.schedule used to say when a class met. Nothing says it any more —
 * sessions are authored one at a time on the dashboard calendar — so the class
 * list and the browse page derive the pattern from what is actually booked.
 *
 * ── WHY IT PRODUCES THE OLD SHAPE ───────────────────────────
 * The output is deliberately the same {day, startTime, endTime} that
 * classes.schedule held, so it can go straight into the existing
 * ClassSchedule component. That component already knows how to name a weekday
 * in either language and how to convert a time into the reader's own zone, and
 * none of that reasoning changes just because the source did.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────
 * A promise. It describes the sessions on the books, so a class whose teacher
 * has not scheduled anything yet correctly shows nothing rather than a pattern
 * inherited from last term.
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface DerivedSlot {
  day: string
  startTime: string
  endTime: string
}

export interface OccurrenceLike {
  occurrence_date: string
  start_time: string
  end_time?: string | null
  status?: string | null
}

/**
 * The distinct weekday-and-time combinations a class currently meets at.
 *
 * Cancelled sessions are ignored: a cancellation says this week is off, not
 * that the class stopped meeting on Mondays, and letting one drop a whole slot
 * out of the pattern would make the class list flicker week to week.
 *
 * Sorted by weekday then time so two classes with the same pattern always read
 * the same, rather than in whatever order the rows came back.
 */
export function slotsFromOccurrences(occurrences: OccurrenceLike[]): DerivedSlot[] {
  const seen = new Map<string, DerivedSlot & { weekday: number }>()

  for (const o of occurrences) {
    if (o.status === 'cancelled') continue
    // Parsed as local, not UTC — parsing 'YYYY-MM-DD' as UTC can land on the
    // previous day west of Greenwich and report the wrong weekday entirely.
    const [y, m, d] = o.occurrence_date.split('-').map(Number)
    const weekday = new Date(y, m - 1, d).getDay()

    const startTime = o.start_time.slice(0, 5)
    const endTime = (o.end_time ?? '').slice(0, 5)
    const key = `${weekday}|${startTime}|${endTime}`
    if (!seen.has(key)) {
      seen.set(key, { weekday, day: DAY_NAMES[weekday], startTime, endTime })
    }
  }

  return [...seen.values()]
    .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))
    .map(({ day, startTime, endTime }) => ({ day, startTime, endTime }))
}

/**
 * Group occurrences by class, so a list of classes costs one query rather than
 * one per class. A page showing thirty classes should not make thirty round
 * trips to say when each of them meets.
 */
export function groupByClass<T extends { class_id: string }>(rows: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const r of rows) (out[r.class_id] ||= []).push(r)
  return out
}
