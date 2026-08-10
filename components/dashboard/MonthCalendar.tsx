'use client'

/**
 * A month of the reader's own timetable, on the right half of the welcome card.
 *
 * ── SHAPE FIRST, COLOUR SECOND ──────────────────────────────
 * Six muted hues on a coloured wash were too close to tell apart, and for a
 * reader who does not separate reds and greens they carried nothing at all. So
 * every class has a shape as well as a colour, and a problem has a shape no
 * class uses. The colour is now a redundant second channel rather than the only
 * one — see classShape.
 *
 * ── WHY A FUTURE PROBLEM KEEPS ITS NAME BACK ────────────────
 * The challenge page turns a student away from a problem dated after today.
 * Printing its title on the calendar would hand over the one thing that
 * redirect exists to withhold, so a future day shows a lock and "not open yet".
 * That something is set is not secret; what it is, is.
 *
 * The card is split 25/75 to pay for the words: a name, a time and a status
 * line need about 150px a cell, and the problem list on the left does not need
 * half a card to show three titles.
 *
 * ── WHAT EACH ROLE GETS ─────────────────────────────────────
 * Student  their problems by name, with where they stand on each — waiting on
 *          a mark, full marks, or a comment to go and read — plus their own
 *          classes with the exact local time.
 * Teacher  the classes running that day and nothing else. They set the
 *          problems and wrote the comments; a timetable is what they do not
 *          otherwise have. None of the student status applies to them.
 */

import { useMemo } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import type { TranslationKey } from '@/lib/i18n/catalog'
import { zoneLabel } from '@/lib/utils/timezone'
import type { PaperPalette } from '@/lib/ui/paperCard'
import { problemStatus, type ProblemStatus } from '@/lib/classSchedule/problemStatus'

/** The wording, kept for the hover title — the cell itself has room for a mark. */
const STATUS_KEY: Record<ProblemStatus, TranslationKey> = {
  todo: 'dash.statusTodo',
  ungraded: 'dash.statusUngraded',
  done: 'dash.statusDone',
  partial: 'dash.statusPartial',
}

/**
 * A mark instead of a sentence.
 *
 * A cell is 124px, and "(submitted / not graded)" measures 94 of them — set
 * beside a title it left one problem with literally zero pixels of name. The
 * name is how a student knows which problem it is, so the standing gives way to
 * a mark and the words move to the key underneath.
 *
 * ── WHY 'todo' HAS ONE AT ALL ───────────────────────────────
 * It used to show nothing, which made the state a student most needs to act on
 * the only one with no sign of itself — indistinguishable at a glance from a
 * day with no problem set. An empty ring is the obvious partner to the tick,
 * and the four together read as a progression: nothing done, waiting on the
 * teacher, marked full, go and read something.
 */
const STATUS_MARK: Record<ProblemStatus, string> = {
  todo: '○',
  ungraded: '⏳',
  done: '✓',
  partial: '💬',
}

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

export interface CalendarProblem {
  id: string
  title: string
  submitted: boolean
  /** Null while ungraded. */
  points?: number | null
  maxPoints?: number | null
}

export interface CalendarDay {
  /** Problems set that day. Everything but `id` is meaningless for a teacher. */
  problems: CalendarProblem[]
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
   * Opens a problem. Student-side: a teacher's cell carries no problems.
   *
   * Absent leaves the entries as plain text, which is also what a locked one
   * stays regardless — see the note at the call site.
   */
  onProblemClick?: (problemId: string) => void
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

/**
 * A SHAPE per class, not only a hue.
 *
 * Six muted colours on a coloured wash are hard to tell apart, and impossible
 * for a reader who does not separate reds and greens — roughly one boy in
 * twelve. Shape carries the distinction on its own; the colour is now a second,
 * redundant channel rather than the only one.
 *
 * Deliberately six blunt geometric forms rather than anything representational:
 * these render at 7px, where a picture is a smudge and a square is still a
 * square.
 */
const CLASS_SHAPES = ['●', '■', '▲', '◆', '★', '⬟']

/** Distinct from every class shape, so a problem can never be read as a class. */
export const PROBLEM_SHAPE = '✎'

function hash(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function classColour(id: string): string {
  return CLASS_HUES[hash(id) % CLASS_HUES.length]
}

/**
 * Paired with classColour by construction: both index the same hash, so a
 * class that is the third colour is also the third shape everywhere it appears
 * — cell, legend, modal — without either list being passed around.
 */
export function classShape(id: string): string {
  return CLASS_SHAPES[hash(id) % CLASS_SHAPES.length]
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
  viewerTimezone, onProblemClick,
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
              <div key={cell.key} className="rounded-md border px-1 py-0.5 min-h-[68px] opacity-30"
                style={{ borderColor: palette.rule, background: palette.cell }}>
                <span className="text-[10px] font-bold" style={{ color: palette.ink3 }}>{cell.n}</span>
              </div>
            )
          }

          const day = days[cell.date]
          const isToday = cell.date === today
          const isNext = cell.date === nextClassDate
          // The first class rides on the date's line; the rest get their own.
          // A teacher still caps at three, since a busy day is a timetable and
          // not a reading list.
          const shownClasses = day?.classes.slice(0, isTeacher ? 3 : undefined) ?? []
          const [firstClass, ...restClasses] = shownClasses

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
              className={`relative rounded-md px-1 py-0.5 min-h-[68px] flex flex-col gap-[2px] overflow-hidden text-left ${
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
              {/* The date shares its line with the day's first class, which is
                  what makes room for the problems underneath. */}
              <span className="flex items-baseline gap-1 overflow-hidden">
                <span className="text-[10px] font-bold leading-tight shrink-0"
                  style={{ color: isToday ? palette.accentInk : palette.ink2 }}>
                  {cell.n}
                </span>
                {firstClass && (
                  <span className="flex items-baseline gap-[3px] text-[9px] leading-tight min-w-0"
                    title={`${firstClass.name}${firstClass.startTime ? ` · ${firstClass.startTime}` : ''}${
                      firstClass.cancelled ? ` — ${t('dash.cancelledClass')}` : ''}`}>
                    <span className="shrink-0" style={{ color: classColour(firstClass.id) }}
                      aria-hidden="true">{classShape(firstClass.id)}</span>
                    <span className="truncate" style={{
                      color: isNext ? palette.accentInk : palette.ink2,
                      textDecoration: firstClass.cancelled ? 'line-through' : undefined,
                      opacity: firstClass.cancelled ? 0.55 : 1,
                    }}>{firstClass.name}</span>
                    {firstClass.startTime && (
                      <span className="shrink-0 tabular-nums" style={{ color: palette.ink3 }}>
                        {firstClass.startTime}
                      </span>
                    )}
                  </span>
                )}
              </span>

              {/* Any further classes get their own line. */}
              {restClasses.map(c => (
                <span key={c.occurrenceId ?? c.id}
                  className="flex items-baseline gap-[3px] text-[9px] leading-tight overflow-hidden"
                  title={`${c.name}${c.startTime ? ` · ${c.startTime}` : ''}`}>
                  <span className="shrink-0" style={{ color: classColour(c.id) }}
                    aria-hidden="true">{classShape(c.id)}</span>
                  <span className="truncate" style={{
                    color: palette.ink2,
                    textDecoration: c.cancelled ? 'line-through' : undefined,
                    opacity: c.cancelled ? 0.55 : 1,
                  }}>{c.name}</span>
                  {c.startTime && (
                    <span className="shrink-0 tabular-nums" style={{ color: palette.ink3 }}>
                      {c.startTime}
                    </span>
                  )}
                </span>
              ))}
              {isTeacher && day && day.classes.length > 3 && (
                <span className="text-[9px] leading-tight" style={{ color: palette.ink3 }}>
                  +{day.classes.length - 3}
                </span>
              )}

              {/*
                A student's problems, by name — except on a day that has not
                arrived. The challenge page turns a student away from a problem
                dated after today, and printing its title here would hand over
                the one thing that redirect exists to withhold. The fact that
                something is set is not secret; what it is, is.
              */}
              {!isTeacher && day?.problems.map(p => {
                const locked = cell.date! > today
                const status = problemStatus(p)
                /*
                  Openable from here as well as from the list on the left —
                  except when locked. The challenge page turns a student away
                  from a problem dated after today, so a link that only bounces
                  them back is worse than no link: it looks like the site is
                  broken rather than like the problem is not open.

                  A button here is safe because a student's cell is a div. The
                  teacher's cell IS a button, and a button inside a button is
                  invalid — but a teacher's cell carries no problems, so the two
                  never meet.
                */
                const Entry: any = onProblemClick && !locked ? 'button' : 'span'
                return (
                  <Entry
                    key={p.id}
                    {...(onProblemClick && !locked ? {
                      type: 'button',
                      onClick: () => onProblemClick(p.id),
                    } : {})}
                    className={`flex w-full items-center gap-[3px] text-left text-[9px] leading-tight rounded px-1 py-[1px] ${
                      onProblemClick && !locked ? 'dash-problem-btn cursor-pointer' : ''
                    }`}
                    /* The full wording survives on hover. It is the only place
                       a mouse user gets it without consulting the key. */
                    title={locked
                      ? t('dash.statusLocked')
                      : `${p.title} — ${t(STATUS_KEY[status])}`}>
                    <span className="shrink-0" style={{ color: palette.accent }}
                      aria-hidden="true">{locked ? '🔒' : PROBLEM_SHAPE}</span>
                    <span className="truncate flex-1 min-w-0" style={{
                      color: locked ? palette.ink3 : palette.ink,
                      fontStyle: locked ? 'italic' : undefined,
                    }}>
                      {locked ? t('dash.statusLocked') : p.title}
                    </span>
                    {!locked && (
                      /* Not aria-hidden: this mark is the only thing carrying
                         the standing, so a screen reader has to read it as
                         words rather than skip a decorative glyph. */
                      <span className="shrink-0" aria-label={t(STATUS_KEY[status])}
                        title={t(STATUS_KEY[status])}
                        /* The one that means "do this" gets the accent; the
                           rest are already coloured by their own meaning. */
                        style={status === 'todo' ? { color: palette.accent } : undefined}>
                        {STATUS_MARK[status]}
                      </span>
                    )}
                  </Entry>
                )
              })}
            </Cell>
          )
        })}
      </div>

      {/* Which class is which. Quiet, because the shapes are already beside the
          names in the cells and this is only for confirming one. */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] items-center"
        style={{ color: palette.ink3 }}>
        {legend.map(([id, name]) => (
          <span key={id} className="flex items-center gap-1">
            <span style={{ color: classColour(id) }} aria-hidden="true">{classShape(id)}</span>
            {name}
          </span>
        ))}
        <span>{isTeacher ? t('dash.calendarTeacherHint') : t('dash.calendarStudentHint')}</span>
      </div>

      {/*
        The key to the marks — students only.

        Louder than the class legend above it on purpose. A cell has room for a
        mark and not a sentence, so this is the ONLY place the meaning is
        written down: a student who does not read it cannot tell a problem
        waiting to be marked from one with a comment waiting to be read. Hence
        its own heading, its own boxed row, and bold throughout.
      */}
      {!isTeacher && (
        <div className="mt-2 rounded-lg border px-2 py-1.5"
          style={{ borderColor: palette.rule, background: palette.cell }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1"
            style={{ color: palette.ink2 }}>
            {t('dash.keyHeading')}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold"
            style={{ color: palette.ink }}>
            <span className="flex items-center gap-1">
              <span style={{ color: palette.accent }} aria-hidden="true">{PROBLEM_SHAPE}</span>
              {t('dash.keyProblem')}
            </span>
            <span className="flex items-center gap-1" style={{ color: palette.accentInk }}>
              <span style={{ color: palette.accent }} aria-hidden="true">{STATUS_MARK.todo}</span>
              {t('dash.keyTodo')}
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden="true">{STATUS_MARK.ungraded}</span>
              {t('dash.keyUngraded')}
            </span>
            <span className="flex items-center gap-1" style={{ color: palette.doneInk }}>
              <span aria-hidden="true">{STATUS_MARK.done}</span>
              {t('dash.keyDone')}
            </span>
            <span className="flex items-center gap-1" style={{ color: palette.accentInk }}>
              <span aria-hidden="true">{STATUS_MARK.partial}</span>
              {t('dash.keyPartial')}
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden="true">🔒</span>
              {t('dash.keyLocked')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
