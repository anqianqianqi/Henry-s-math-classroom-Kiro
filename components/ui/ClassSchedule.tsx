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

  return (
    <span className={className}>
      {slots.map((slot, i) => {
        const dayKey = DAY_KEYS[String(slot.day).trim().toLowerCase()]
        const converted = sameZone
          ? null
          : convertSession(slot.day, slot.startTime, classTimezone, viewerTimezone)

        // Unparseable day or time, or an unknown zone: show what was entered
        // rather than nothing. A schedule someone typed is still information.
        if (!sameZone && !converted) {
          return (
            <span key={i}>
              {i > 0 && ', '}
              {dayKey ? t(dayKey as any) : slot.day} {slot.startTime}
            </span>
          )
        }

        const shownDayKey = converted ? DAY_KEYS[converted.day] : dayKey
        const shownTime = converted ? converted.time : slot.startTime

        return (
          <span key={i}>
            {i > 0 && ', '}
            {shownDayKey ? t(shownDayKey as any) : (converted?.day ?? slot.day)} {shownTime}
            {converted && converted.dayShift !== 0 && (
              // The reader's date differs from the class's. Silent here and
              // somebody turns up a day out.
              <span className="text-gray-400">
                {' '}
                {converted.dayShift > 0 ? t('class.nextDay') : t('class.prevDay')}
              </span>
            )}
          </span>
        )
      })}
      <span className="text-gray-400">
        {' '}
        {zoneLabel(viewerTimezone)}
        {!sameZone && ` · ${t('class.yourTime')}`}
      </span>
    </span>
  )
}
