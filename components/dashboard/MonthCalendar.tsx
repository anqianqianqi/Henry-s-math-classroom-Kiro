'use client'

/**
 * A month of the reader's own timetable, on the right half of the welcome card.
 *
 * ── WHY A DAY HOLDS MARKS AND NOT WORDS ─────────────────────
 * The card is split 40/60 and the calendar gets the wider share, which still
 * only leaves about 88px a cell. No challenge title survives that in either
 * language, so a problem is a dot and the titles stay on the left half where
 * there is room for them.
 *
 * That turns out to be the safe design as well as the only one that fits: a
 * student must not see a problem set for a future date — the challenge page
 * redirects them away from one — and a dot says something is set without saying
 * what. So the whole month can be shown honestly with no special case for
 * future days. Their own class schedule is not secret, so sessions show in full.
 *
 * ── WHAT EACH ROLE GETS ─────────────────────────────────────
 * Student  problem dots, filled once submitted, plus their own class sessions.
 * Teacher  the classes running that day and nothing else. A teacher sets the
 *          problems; a timetable is what they do not otherwise have.
 */

import { useMemo } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { zoneLabel } from '@/lib/utils/timezone'
import type { PaperPalette } from '@/lib/ui/paperCard'

export interface CalendarClass {
  /** The CLASS id — what the colour and the legend key off, not the session. */
  id: string
  name: string
  cancelled: boolean
  /*
    The session itself. Only a teacher needs these — they are what the day
    editor writes against — so they are optional rather than forcing a
    student's query to fetch columns nothing will read.
  */
  occurrenceId?: string
  seriesId?: string | null
  startTime?: string
  endTime?: string
}

export interface CalendarDay {
  /** Problems set that day. `submitted` is meaningless for a teacher. */
  problems: { id: string; submitted: boolean }[]
  classes: CalendarClass[]
}

export interface MonthCalendarProps {
  /** Any date inside the month being shown. */
  month: Date
  onMonthChange: (next: Date) => void
  /** Keyed 'YYYY-MM-DD'. Days with nothing on them may be absent. */
  days: Record<string, CalendarDay>
  /** School-timezone today, so the outline agrees with the rest of the site. */
  today: string
  isTeacher: boolean
  palette: PaperPalette
  /**
   * Opens the day editor. Absent for a student, which is what makes the grid
   * read-only for them — there is no disabled state to style around.
   */
  onDayClick?: (date: string) => void
  /** Sits at the top right of the calendar, beside the month arrows. */
  headerAction?: React.ReactNode
  /**
   * The zone every time on this calendar has been converted into — the
   * reader's own.
   *
   * Stated rather than assumed, on the same reasoning ClassSchedule gives: a
   * converted time that does not say which clock it is on is worse than an
   * unconverted one, because the reader cannot tell whether it was translated
   * for them and has to ask anyway.
   */
  viewerTimezone: string
}

/**
 * A stable colour per class, derived rather than stored.
 *
 * `classes` has no colour column and adding one is a migration for decoration.
 * Hashing the id gives every class the same colour on every render and every
 * device, which is all the legend needs. The six hues are muted on purpose —
 * these sit on painted paper, and a saturated dot would be the loudest thing
 * on the page.
 */
const CLASS_HUES = ['#c2703f', '#5b8fa8', '#7a9a52', '#a1739c', '#c99a3f', '#5f8f81']

export function classColour(id: string): string {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return CLASS_HUES[(h >>> 0) % CLASS_HUES.length]
}

const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

/** Saturday of the week containing `today`, as 'YYYY-MM-DD'. */
function endOfWeek(today: string): string {
  const d = new Date(`${today}T12:00:00`)
  d.setDate(d.getDate() + (6 - d.getDay()))
  return iso(d.getFullYear(), d.getMonth(), d.getDate())
}

export function MonthCalendar({
  month, onMonthChange, days, today, isTeacher, palette, onDayClick, headerAction,
  viewerTimezone,
}: MonthCalendarProps) {
  const { t, language } = useLanguage()

  const year = month.getFullYear()
  const monthIndex = month.getMonth()

  /*
    The next session still to come this week, which is the one that pulses.

    Today counts — a class this afternoon is still next. Cancelled ones are
    skipped, because a ring around a class that is not happening is worse than
    no ring. It stops at Saturday rather than running on into next month, so
    "next class" cannot quietly mean one three weeks away.
  */
  const nextClassDate = useMemo(() => {
    const last = endOfWeek(today)
    for (let ds = today; ds <= last;) {
      const day = days[ds]
      if (day?.classes.some(c => !c.cancelled)) return ds
      const d = new Date(`${ds}T12:00:00`)
      d.setDate(d.getDate() + 1)
      ds = iso(d.getFullYear(), d.getMonth(), d.getDate())
    }
    return null
  }, [days, today])

  const cells = useMemo(() => {
    const first = new Date(year, monthIndex, 1)
    const lead = first.getDay()
    const dayCount = new Date(year, monthIndex + 1, 0).getDate()
    const out: { key: string; date?: string; n: number }[] = []

    const prevCount = new Date(year, monthIndex, 0).getDate()
    for (let i = 0; i < lead; i++) out.push({ key: `p${i}`, n: prevCount - lead + 1 + i })
    for (let d = 1; d <= dayCount; d++) out.push({ key: iso(year, monthIndex, d), date: iso(year, monthIndex, d), n: d })
    // Pad to whole weeks so the grid does not change shape month to month.
    for (let i = 0; out.length % 7; i++) out.push({ key: `n${i}`, n: i + 1 })
    return out
  }, [year, monthIndex])

  // Chinese writes 2026年8月, English August 2026 — different order and a
  // different month form, so both halves are localized before the join.
  const monthLabel = language === 'zh'
    ? `${monthIndex + 1}月`
    : month.toLocaleDateString('en-US', { month: 'long' })
  const heading = t('dash.monthYear', { month: monthLabel, year })

  // Forward is capped at the current month: there is nothing to plan against
  // beyond it, and an unbounded ›  invites an empty grid.
  const atLatest = year === Number(today.slice(0, 4)) && monthIndex === Number(today.slice(5, 7)) - 1

  const step = (by: number) => onMonthChange(new Date(year, monthIndex + by, 1))

  const dowKeys = ['day.sunday', 'day.monday', 'day.tuesday', 'day.wednesday',
    'day.thursday', 'day.friday', 'day.saturday'] as const

  const legend = useMemo(() => {
    const seen = new Map<string, string>()
    for (const key of Object.keys(days)) {
      for (const c of days[key].classes) if (!seen.has(c.id)) seen.set(c.id, c.name)
    }
    return [...seen.entries()]
  }, [days])

  const navStyle: React.CSSProperties = {
    borderColor: palette.rule, color: palette.ink2,
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="flex-1 font-semibold" style={{ fontFamily: 'Georgia, serif', color: palette.ink }}>
          {heading}
        </span>
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={t('dash.prevMonth')}
          className="w-7 h-7 rounded-full border flex items-center justify-center text-sm transition-colors"
          style={navStyle}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={atLatest}
          aria-label={t('dash.nextMonth')}
          className="w-7 h-7 rounded-full border flex items-center justify-center text-sm transition-colors disabled:opacity-30"
          style={navStyle}
        >
          ›
        </button>
        {headerAction}
      </div>

      {/* Which clock this month is drawn on. The label is taken at the middle
          of the month rather than at page load, so a month that straddles a
          clock change is named by what it mostly is. */}
      <p className="text-[10px] mb-2 flex items-center gap-1" style={{ color: palette.ink3 }}>
        <span aria-hidden="true">🕒</span>
        {t('dash.timesShownIn', {
          zone: zoneLabel(viewerTimezone, new Date(year, monthIndex, 15)),
          place: viewerTimezone.replace(/_/g, ' '),
        })}
      </p>

      <div className="grid grid-cols-7 gap-[3px] mb-[3px]">
        {dowKeys.map((k, i) => (
          <span key={i} className="text-center text-[10px] font-bold uppercase tracking-wider"
            style={{ color: palette.ink3 }}>
            {/* One letter is all a 88px column has room for, and it is enough
                once the grid is read as a grid. */}
            {t(k).slice(0, language === 'zh' ? 3 : 1)}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-[3px]">
        {cells.map(cell => {
          if (!cell.date) {
            return (
              <div key={cell.key} className="rounded-md border px-1 py-0.5 min-h-[52px] opacity-30"
                style={{ borderColor: palette.rule, background: palette.cell }}>
                <span className="text-[10px] font-bold" style={{ color: palette.ink3 }}>{cell.n}</span>
              </div>
            )
          }

          const day = days[cell.date]
          const isToday = cell.date === today
          const isNext = cell.date === nextClassDate

          // A button only where there is something to do with it, so a student
          // gets a grid with no dead affordances in it.
          const Cell: any = onDayClick ? 'button' : 'div'

          return (
            <Cell
              key={cell.key}
              {...(onDayClick ? {
                type: 'button',
                onClick: () => onDayClick(cell.date!),
                'aria-label': cell.date,
              } : {})}
              className={`relative rounded-md px-1 py-0.5 min-h-[52px] flex flex-col gap-[2px] overflow-hidden text-left ${
                isNext ? 'dash-next-class' : ''
              } ${onDayClick ? 'hover:brightness-95 transition-[filter]' : ''}`}
              style={{
                border: `${isToday ? 2 : 1}px solid ${isToday ? palette.accent : palette.rule}`,
                background: isToday ? palette.today : palette.cell,
                // Read by the pulse ring in globals.css, so the ring is drawn in
                // whichever palette the reader chose.
                ['--dash-accent' as string]: palette.accent,
              }}
            >
              <span className="text-[10px] font-bold leading-tight"
                style={{ color: isToday ? palette.accentInk : palette.ink2 }}>
                {cell.n}
              </span>

              {!isTeacher && day?.problems.length ? (
                <span className="flex gap-[2px] flex-wrap">
                  {day.problems.map(p => (
                    <span key={p.id} className="block w-[5px] h-[5px] rounded-full"
                      style={{ background: p.submitted ? palette.done : palette.accent }} />
                  ))}
                </span>
              ) : null}

              {day?.classes.slice(0, isTeacher ? 3 : 2).map(c => (
                <span key={c.id} className="flex items-center gap-[2px] text-[9px] leading-tight overflow-hidden"
                  title={c.cancelled ? `${c.name} — ${t('dash.cancelledClass')}` : c.name}>
                  <i className="w-[4px] h-[4px] rounded-[1px] shrink-0" style={{ background: classColour(c.id) }} />
                  <span className="truncate"
                    style={{
                      color: isNext ? palette.accentInk : palette.ink2,
                      textDecoration: c.cancelled ? 'line-through' : undefined,
                      opacity: c.cancelled ? 0.55 : 1,
                    }}>
                    {c.name}
                  </span>
                </span>
              ))}
              {isTeacher && day && day.classes.length > 3 && (
                <span className="text-[9px] leading-tight" style={{ color: palette.ink3 }}>
                  +{day.classes.length - 3}
                </span>
              )}
            </Cell>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] items-center"
        style={{ color: palette.ink3 }}>
        {legend.map(([id, name]) => (
          <span key={id} className="flex items-center gap-1">
            <i className="w-[6px] h-[6px] rounded-[2px]" style={{ background: classColour(id) }} />
            {name}
          </span>
        ))}
        {!isTeacher && (
          <>
            <span className="flex items-center gap-1">
              <i className="w-[6px] h-[6px] rounded-full" style={{ background: palette.accent }} />
              {t('dash.keyProblem')}
            </span>
            <span className="flex items-center gap-1">
              <i className="w-[6px] h-[6px] rounded-full" style={{ background: palette.done }} />
              {t('dash.keySubmitted')}
            </span>
          </>
        )}
        <span>{isTeacher ? t('dash.calendarTeacherHint') : t('dash.calendarStudentHint')}</span>
      </div>
    </div>
  )
}
