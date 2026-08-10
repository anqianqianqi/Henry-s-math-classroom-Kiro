'use client'

/**
 * The dashboard's welcome card.
 *
 * ── WHY IT IS PAINTED PAPER ─────────────────────────────────
 * It used to be a green-to-blue gradient on a hard rounded rectangle with a
 * drop shadow — the largest surviving block of the bright direction the site is
 * being repainted out of, sitting directly above painted-paper tiles and a
 * painted pet room. It now wears the same treatment as every other card:
 * the irregular alpha mask, the grain, the inset pigment pooling.
 *
 * It does not wear the same COLOUR. A card-coloured hero is a very wide stat
 * tile, and the greeting stops reading as a greeting — so the reader picks a
 * pigment, top left. None of those washes will hold white text, which is why
 * ink travels with the palette rather than being fixed here.
 *
 * ── WHY IT IS SPLIT ─────────────────────────────────────────
 * A month grid across the whole card ran the hero past 700px tall. Beside the
 * problem list it is closer to 550, the calendar stops setting the card's
 * height, and the list — which would otherwise have left the left side empty —
 * pays for itself. 40/60 rather than half and half: the list does not need half
 * a card, and at 50/50 a calendar cell is 73px, where class names truncate to
 * "Algeb…".
 */

import { useLanguage } from '@/lib/i18n/LanguageProvider'
import type { TranslationKey } from '@/lib/i18n/catalog'
import { PAPER_PALETTES, paperSurfaceStyle, type PaperPalette } from '@/lib/ui/paperCard'
import { MonthCalendar, type CalendarDay } from './MonthCalendar'

export interface WelcomeChallenge {
  id: string
  title: string
  challenge_date: string
  submitted: boolean
  submissionId?: string
  hasNewTeacherComment?: boolean
}

export interface WelcomeCardProps {
  firstName: string
  isTeacher: boolean
  palette: PaperPalette
  onPaletteChange: (id: string) => void

  /** Today's problems — the left half, unchanged in shape from before. */
  challenges: WelcomeChallenge[]
  collapsedCount: number
  expanded: boolean
  onToggleExpanded: () => void
  onOpenChallenge: (c: WelcomeChallenge) => void
  onCreateChallenge: () => void

  /** The right half. */
  month: Date
  onMonthChange: (d: Date) => void
  days: Record<string, CalendarDay>
  today: string
  /** Teacher and admin only — absent leaves the grid read-only. */
  onDayClick?: (date: string) => void
  onOpenAssignment?: () => void
  /** The reader's own clock. The calendar converts into it and says so. */
  viewerTimezone: string
}

const PALETTE_LABEL: Record<string, TranslationKey> = {
  meadow: 'dash.paletteMeadow',
  sky: 'dash.paletteSky',
  dusk: 'dash.paletteDusk',
  sea: 'dash.paletteSea',
  rose: 'dash.paletteRose',
}

export function WelcomeCard({
  firstName, isTeacher, palette, onPaletteChange,
  challenges, collapsedCount, expanded, onToggleExpanded,
  onOpenChallenge, onCreateChallenge,
  month, onMonthChange, days, today, onDayClick, onOpenAssignment, viewerTimezone,
}: WelcomeCardProps) {
  const { t } = useLanguage()
  const shown = expanded ? challenges : challenges.slice(0, collapsedCount)
  const hidden = challenges.length - collapsedCount

  return (
    <div className="mb-8 px-6 pt-5 pb-6 relative" style={paperSurfaceStyle(palette)}>

      {/* ── The pigment picker ──────────────────────────────
          Top left, because the language switcher owns top right on every page
          and a card's own chrome should move around the shared control. */}
      <div className="absolute left-5 top-5 flex items-center gap-1.5" role="group"
        aria-label={t('dash.paletteLabel')}>
        {PAPER_PALETTES.map(p => {
          const chosen = p.id === palette.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPaletteChange(p.id)}
              aria-label={t(PALETTE_LABEL[p.id])}
              aria-pressed={chosen}
              title={t(PALETTE_LABEL[p.id])}
              className="w-4 h-4 rounded-full transition-transform hover:scale-110"
              style={{
                background: p.swatch,
                // The chosen one is ringed in the ink of the palette in use, not
                // its own, so the row reads against the card it is sitting on.
                boxShadow: chosen
                  ? `0 0 0 2px ${palette.ink3}, 0 0 0 3.5px ${p.swatch}`
                  : `inset 0 0 0 1px rgba(0,0,0,0.12)`,
              }}
            />
          )
        })}
      </div>

      {/* ── Greeting ────────────────────────────────────────
          Centred over the whole card rather than over the left column: it
          greets the reader, not the problem list. */}
      <div className="text-center mb-5">
        <h2 className="text-2xl font-semibold" style={{ fontFamily: 'Georgia, serif', color: palette.ink }}>
          <span aria-hidden="true">👋 </span>
          {t('dash.welcomeBack', { name: firstName })}
        </h2>
        <p className="text-sm mt-0.5" style={{ color: palette.ink2 }}>
          {isTeacher ? t('dash.welcomeTeacher') : t('dash.welcomeStudent')}
        </p>
      </div>

      {/* 40/60 above 1024px, stacked below it. Two columns on a narrow window
          would leave the calendar with ~40px cells, narrower than a two-digit
          date; stacked, it gets the full width instead. */}
      <div className="grid gap-8 items-start grid-cols-1 lg:grid-cols-[2fr_3fr]">
        {/* ── Left: today's problems, with room for their titles ── */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: palette.ink3 }}>
            {t('dash.today')}
          </p>

          {challenges.length > 0 ? (
            <>
              <div className="flex flex-col gap-2">
                {shown.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onOpenChallenge(c)}
                    className="text-left rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 border transition-colors w-full"
                    style={{ background: palette.chip, borderColor: palette.rule }}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: palette.ink3 }}>
                          🎯 {t('dash.today')}
                        </span>
                        {!isTeacher && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{
                              background: c.submitted ? palette.chipDone : palette.todo,
                              color: c.submitted ? palette.doneInk : palette.ink2,
                            }}>
                            {c.submitted ? `✓ ${t('dash.done')}` : '⏳'}
                          </span>
                        )}
                        {!isTeacher && c.hasNewTeacherComment && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: palette.chipDone, color: palette.doneInk }}>
                            💬 {t('dash.newComment')}
                          </span>
                        )}
                      </span>
                      <span className="block font-semibold text-sm truncate" style={{ color: palette.ink }}>
                        {c.title}
                      </span>
                    </span>
                    <span className="shrink-0" style={{ color: palette.ink3 }} aria-hidden="true">→</span>
                  </button>
                ))}
              </div>

              {challenges.length > collapsedCount && (
                <button onClick={onToggleExpanded} className="text-[11px] mt-2 pl-1 text-left block"
                  style={{ color: palette.ink3 }}>
                  {expanded ? `▲ ${t('dash.showLess')}` : `▼ ${t('dash.showMore', { count: hidden })}`}
                </button>
              )}
            </>
          ) : (
            <div className="text-sm" style={{ color: palette.ink3 }}>
              <span className="text-2xl block mb-1" aria-hidden="true">🎯</span>
              {t('dash.noChallengeToday')}
              {isTeacher && (
                <button onClick={onCreateChallenge} className="block text-xs mt-1 underline"
                  style={{ color: palette.ink2 }}>
                  {t('dash.createOne')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Right: the month ────────────────────────────── */}
        <MonthCalendar
          month={month}
          onMonthChange={onMonthChange}
          days={days}
          today={today}
          isTeacher={isTeacher}
          palette={palette}
          viewerTimezone={viewerTimezone}
          onDayClick={onDayClick}
          headerAction={onOpenAssignment && (
            <button
              type="button"
              onClick={onOpenAssignment}
              className="text-[11px] px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap"
              style={{ borderColor: palette.rule, color: palette.ink2 }}
            >
              🗓️ {t('sched.assignClasses')}
            </button>
          )}
        />
      </div>

    </div>
  )
}
