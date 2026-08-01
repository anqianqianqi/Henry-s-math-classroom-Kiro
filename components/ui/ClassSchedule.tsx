'use client'

/**
 * A class's weekly schedule, in the reader's own timezone.
 *
 * ── WHY THE ZONE IS ALWAYS SHOWN ────────────────────────────
 * A converted time that does not say which clock it is on is worse than an
 * unconverted one: the reader cannot tell whether it has been translated for
 * them or not, so they have to ask anyway. The label is the point.
 *
 * When the reader is in the class's own zone there is nothing to translate, so
 * it renders the plain time and stays quiet.
 */

import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { convertSession, zoneLabel } from '@/lib/utils/timezone'

export interface ScheduleSlot {
  day: string
  startTime: string
  endTime?: string
}

export interface ClassScheduleProps {
  slots: ScheduleSlot[] | null | undefined
  /** IANA zone the class runs in — classes.timezone. */
  classTimezone: string
  /** IANA zone of the person reading. */
  viewerTimezone: string
  className?: string
}

const DAY_KEYS: Record<string, string> = {
  sunday: 'day.sunday', monday: 'day.monday', tuesday: 'day.tuesday',
  wednesday: 'day.wednesday', thursday: 'day.thursday',
  friday: 'day.friday', saturday: 'day.saturday',
}

export function ClassSchedule({
  slots, classTimezone, viewerTimezone, className = '',
}: ClassScheduleProps) {
  const { t } = useLanguage()

  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return <span className={className}>{t('class.scheduleTba')}</span>
  }

  const sameZone = classTimezone === viewerTimezone

  const dayName = (key: string | undefined, fallback: string) =>
    key ? t(key as any) : fallback

  return (
    <span className={className}>
      {slots.map((slot, i) => {
        const rawDay = String(slot.day).trim().toLowerCase()
        const dayKey = DAY_KEYS[rawDay]
        const converted = sameZone
          ? null
          : convertSession(slot.day, slot.startTime, classTimezone, viewerTimezone)

        // Reader and class share a clock: one time, one label, nothing to
        // reconcile.
        if (sameZone) {
          return (
            <span key={i}>
              {i > 0 && ', '}
              {dayName(dayKey, slot.day)} {slot.startTime}
              <span className="text-gray-400"> {zoneLabel(classTimezone)}</span>
            </span>
          )
        }

        // Unparseable day or time, or an unknown zone: show what was entered
        // rather than nothing. A schedule someone typed is still information.
        if (!converted) {
          return (
            <span key={i}>
              {i > 0 && ', '}
              {dayName(dayKey, slot.day)} {slot.startTime}
              <span className="text-gray-400"> {zoneLabel(classTimezone)}</span>
            </span>
          )
        }

        /*
          Both times, always — the reader's first because it is the one they
          act on, the class's after it so they can check it against what the
          teacher actually scheduled. Showing only the converted time leaves
          no way to tell whether it has been translated for them at all, which
          is the question this is here to answer.

          Zone labels are taken AT the session, not at page load: those differ
          across a clock change, and the reader is planning for the session.
        */
        return (
          <span key={i} className="inline-block">
            {i > 0 && <span className="text-gray-400">, </span>}
            {dayName(DAY_KEYS[converted.day], converted.day)} {converted.time}
            <span className="text-gray-400">
              {' '}{zoneLabel(viewerTimezone, converted.at)} · {t('class.yourTime')}
              {converted.dayShift !== 0 && (
                // The reader's DATE differs from the class's. Silent here and
                // somebody turns up a day out.
                <> {converted.dayShift > 0 ? t('class.nextDay') : t('class.prevDay')}</>
              )}
              {' · '}
              {dayName(dayKey, slot.day)} {slot.startTime}{' '}
              {zoneLabel(classTimezone, converted.at)} · {t('class.classTime')}
            </span>
          </span>
        )
      })}
    </span>
  )
}
