/**
 * Timezones — what day it is, and what time a class starts, for people who are
 * not all in the same place.
 *
 * ── THE BUG THIS EXISTS TO FIX ──────────────────────────────
 * `challenge_date` is a DATE: a day with no time and no zone. "Today" was
 * computed from the BROWSER, so a teacher in New York publishing today's
 * challenge writes 2026-08-01 while a student in Shanghai at 8am already calls
 * it 2026-08-02 — and the challenge is filtered out of their list. They do not
 * see a wrong time; they see nothing, and miss the day.
 *
 * So a school day is defined by the school, not the reader. Everything that
 * asks "which challenge is today" asks in SCHOOL_TIMEZONE.
 *
 * ── WHY IANA NAMES, NEVER OFFSETS ───────────────────────────
 * The school is in New York, which observes daylight saving. Storing "UTC-5"
 * would be right for half the year and an hour wrong for the other half, and
 * the error would appear twice a year on the days people are least likely to
 * suspect the clock. An IANA name carries its own rules.
 *
 * ── NO DEPENDENCY ───────────────────────────────────────────
 * Intl handles zones and DST correctly and ships with the platform, so this
 * adds no library.
 */

/**
 * Where the school runs. The definition of a school day.
 *
 * Every class predating the timezone column is backfilled to this, which is
 * correct as long as all classes actually run here.
 */
export const SCHOOL_TIMEZONE = 'America/New_York'

/** Regions a person can be in. Deliberately short — see the shop notes. */
export const REGIONS = ['us', 'cn', 'other'] as const
export type Region = (typeof REGIONS)[number]

/**
 * The date in a given zone, as YYYY-MM-DD.
 *
 * 'en-CA' because its short date format IS YYYY-MM-DD, which avoids
 * reassembling parts by hand and getting the padding wrong.
 */
export function dateStringIn(timeZone: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Today, as the school reckons it. What "today's challenge" means. */
export function schoolDateString(date: Date = new Date()): string {
  return dateStringIn(SCHOOL_TIMEZONE, date)
}

/**
 * A school date offset by whole days.
 *
 * Steps in UTC and re-reads the school date rather than doing arithmetic on
 * the string: adding a day to a date at a DST boundary is not a fixed number
 * of hours, and string maths would silently skip or repeat a day.
 */
export function schoolDateOffset(days: number, from: Date = new Date()): string {
  const stepped = new Date(from.getTime() + days * 86400000)
  return schoolDateString(stepped)
}

/**
 * Whether a zone name is one the platform actually knows.
 *
 * Detected zones come from the browser and stored ones from the database, so
 * both can be stale or junk; an unknown name makes Intl throw, which would
 * take down whatever page tried to render a date.
 */
export function isValidTimeZone(timeZone: string | null | undefined): boolean {
  if (!timeZone) return false
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

/** The viewer's own zone, or the school's if the browser will not say. */
export function detectTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return isValidTimeZone(zone) ? zone : SCHOOL_TIMEZONE
  } catch {
    return SCHOOL_TIMEZONE
  }
}

/** Short zone label for a moment — "EDT", "GMT+8". Shown so times are unambiguous. */
export function zoneLabel(timeZone: string, date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(date)
    return parts.find(p => p.type === 'timeZoneName')?.value ?? timeZone
  } catch {
    return timeZone
  }
}

/** Days of the week as stored in classes.schedule, Sunday first to match getDay(). */
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * The offset of a zone from UTC at a given instant, in minutes.
 *
 * Derived by asking Intl what the wall clock reads there and comparing, which
 * is the only way to get this right across DST without a tz database of our
 * own. Positive east of UTC.
 */
function offsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  // Date.UTC of the wall-clock reading, minus the real instant, is the offset.
  const asUtc = Date.UTC(
    get('year'), get('month') - 1, get('day'),
    get('hour') % 24, get('minute'), get('second'),
  )
  return Math.round((asUtc - at.getTime()) / 60000)
}

export interface ConvertedSession {
  /** Day name in the viewer's zone — may differ from the class's. */
  day: string
  /** HH:MM in the viewer's zone. */
  time: string
  /** How many days the viewer's date differs: -1, 0 or +1. */
  dayShift: number
}

/**
 * A weekly class session, expressed in the viewer's zone.
 *
 * ── WHY THIS RESOLVES TO A REAL DATE FIRST ──────────────────
 * A weekly slot has no fixed conversion. "Monday 16:00 New York" is 04:00 in
 * Shanghai for most of the year and 05:00 in winter, because the two zones
 * change clocks on different dates — and for a few weeks each year they are
 * simply a different number of hours apart. Converting an abstract offset
 * would be wrong for part of the year with nothing to show it was wrong.
 *
 * So it finds the next actual occurrence and converts that instant. The answer
 * is correct for the session the reader is about to attend, which is the
 * question they are really asking.
 */
export function convertSession(
  day: string,
  time: string,
  fromZone: string,
  toZone: string,
  now: Date = new Date(),
): ConvertedSession | null {
  const targetDay = DAY_NAMES.indexOf(day.trim().toLowerCase())
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim())
  if (targetDay < 0 || !match) return null
  if (!isValidTimeZone(fromZone) || !isValidTimeZone(toZone)) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null

  // Walk forward from today until the wall-clock day in the class's zone is the
  // one wanted, then pin the instant that reads as that wall time there.
  for (let i = 0; i < 8; i++) {
    const probe = new Date(now.getTime() + i * 86400000)
    const ymd = dateStringIn(fromZone, probe).split('-').map(Number)

    // Guess the instant assuming the offset now, then correct once: the guess
    // can land the other side of a DST change, where the offset differs.
    let instant = Date.UTC(ymd[0], ymd[1] - 1, ymd[2], hour, minute)
    instant -= offsetMinutes(fromZone, new Date(instant)) * 60000
    const corrected = new Date(instant)
    instant = Date.UTC(ymd[0], ymd[1] - 1, ymd[2], hour, minute)
      - offsetMinutes(fromZone, corrected) * 60000

    const at = new Date(instant)
    if (at.getTime() < now.getTime()) continue

    const localDayName = new Intl.DateTimeFormat('en-US', { timeZone: fromZone, weekday: 'long' })
      .format(at).toLowerCase()
    if (localDayName !== DAY_NAMES[targetDay]) continue

    const viewerParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: toZone, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(at)
    const pick = (t: string) => viewerParts.find(p => p.type === t)?.value ?? ''

    const classDate = dateStringIn(fromZone, at)
    const viewerDate = dateStringIn(toZone, at)
    const dayShift = Math.sign(Date.parse(viewerDate) - Date.parse(classDate))

    return {
      day: pick('weekday').toLowerCase(),
      time: `${pick('hour')}:${pick('minute')}`,
      dayShift,
    }
  }
  return null
}
