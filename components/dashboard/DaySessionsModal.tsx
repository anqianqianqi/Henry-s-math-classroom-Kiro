'use client'

/**
 * One day's classes, opened by clicking a cell — teacher and admin only.
 *
 * Adds a one-off session, or removes one that is there.
 *
 * ── THE TWO KINDS OF REMOVAL ────────────────────────────────
 * A session that belongs to a repeating schedule can go two ways, and the
 * difference matters enough to be two buttons rather than a checkbox:
 *
 *   Just this one     the single sitting goes. The schedule keeps running, so
 *                     this is "no class that week", not "we stopped meeting".
 *   This and future   the schedule stops here — its later sessions go and its
 *                     effective_until is clipped to yesterday, so it cannot
 *                     regenerate them.
 *
 * Neither reaches backwards, and neither takes student work with it: homework
 * and materials belong to the class now and merely lose the session link.
 *
 * A one-off has no series, so it only ever offers the first.
 */

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { classColour } from './MonthCalendar'
import { fromSqlTime } from '@/lib/classSchedule/series'
import {
  addOneOff, deleteOccurrence, deleteSeriesFrom, updateOccurrenceTime,
} from '@/lib/classSchedule/operations'

export interface DaySession {
  id: string
  classId: string
  className: string
  seriesId: string | null
  startTime: string
  endTime: string
  cancelled: boolean
}

export interface DaySessionsModalProps {
  /** null when closed. */
  date: string | null
  sessions: DaySession[]
  classes: { id: string; name: string }[]
  today: string
  onClose: () => void
  onChanged: () => void
}

export function DaySessionsModal({
  date, sessions, classes, today, onClose, onChanged,
}: DaySessionsModalProps) {
  const { t } = useLanguage()
  const supabase = createClient()

  const [adding, setAdding] = useState(false)
  const [classId, setClassId] = useState('')
  const [start, setStart] = useState('16:00')
  const [end, setEnd] = useState('17:00')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Occurrence id whose time is being edited, and the fields for it. */
  const [editing, setEditing] = useState<string | null>(null)
  const [editStart, setEditStart] = useState('16:00')
  const [editEnd, setEditEnd] = useState('17:00')

  if (!date) return null

  const isPast = date < today

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null)
    try {
      await fn()
      onChanged()
      setAdding(false)
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full px-2 py-1.5 border-2 border-gray-200 rounded-lg text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card plain className="max-w-md w-full max-h-[85vh] overflow-y-auto">
        <Card.Header>
          <div className="flex items-center justify-between gap-3">
            <Card.Title className="text-lg">{date}</Card.Title>
            <button onClick={onClose} aria-label={t('action.close')}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2">×</button>
          </div>
        </Card.Header>

        <Card.Body>
          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
            {t('sched.sessionsOn')}
          </h4>

          {sessions.length === 0 ? (
            <p className="text-sm text-gray-500 italic mb-4">{t('sched.noSessions')}</p>
          ) : (
            <div className="mb-4 divide-y divide-gray-100">
              {sessions.map(s => (
                <div key={s.id} className="py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <i className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: classColour(s.classId) }} />
                    <span className={`text-sm font-semibold text-gray-900 ${s.cancelled ? 'line-through opacity-60' : ''}`}>
                      {s.className}
                    </span>
                    <span className="text-xs text-gray-500">
                      {fromSqlTime(s.startTime)}–{fromSqlTime(s.endTime)}
                    </span>
                  </div>
                  {s.seriesId && (
                    <p className="text-[11px] text-gray-400 mb-1.5 pl-4">{t('sched.partOfSeries')}</p>
                  )}

                  {editing === s.id ? (
                    <div className="pl-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <label className="text-xs font-medium text-gray-600">
                          {t('sched.from')}
                          <input type="time" className={field} value={editStart}
                            onChange={e => setEditStart(e.target.value)} />
                        </label>
                        <label className="text-xs font-medium text-gray-600">
                          {t('sched.to')}
                          <input type="time" className={field} value={editEnd}
                            onChange={e => setEditEnd(e.target.value)} />
                        </label>
                      </div>
                      {/* Said before saving, not after: moving one sitting of a
                          repeating class takes it out of that schedule for good,
                          which is not obvious from a time field. */}
                      {s.seriesId && (
                        <p className="text-[11px] text-amber-700 mb-2">{t('sched.modifyDetaches')}</p>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" disabled={busy || editEnd <= editStart}
                          onClick={() => run(async () => {
                            await updateOccurrenceTime(supabase, s.id, s.classId, editStart, editEnd)
                            setEditing(null)
                          })}>
                          {busy ? t('status.saving') : t('action.save')}
                        </Button>
                        <Button variant="outline" size="sm" disabled={busy}
                          onClick={() => setEditing(null)}>
                          {t('action.cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pl-4">
                      <Button variant="outline" size="sm" disabled={busy}
                        onClick={() => {
                          setEditing(s.id)
                          setEditStart(fromSqlTime(s.startTime))
                          setEditEnd(fromSqlTime(s.endTime))
                        }}>
                        {t('sched.modify')}
                      </Button>
                      {/*
                        "Just this one" only means anything next to "this and all
                        future". A session that belongs to no schedule has nothing
                        to be contrasted with, so it just says Delete.
                      */}
                      <Button variant="danger" size="sm" disabled={busy}
                        onClick={() => {
                          if (!confirm(t('sched.deleteOccurrenceConfirm'))) return
                          run(() => deleteOccurrence(supabase, s.id, s.classId))
                        }}>
                        {s.seriesId ? t('sched.removeThis') : t('action.delete')}
                      </Button>
                      {s.seriesId && (
                        <Button variant="danger" size="sm" disabled={busy}
                          onClick={() => {
                            if (!confirm(t('sched.deleteFromHereConfirm'))) return
                            run(() => deleteSeriesFrom(supabase, s.seriesId!, s.classId, date!))
                          }}>
                          {t('sched.removeSeries')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Adding to a day that has already been and gone would create a
              session nobody attended, which is a data-entry mistake rather than
              a feature. */}
          {isPast ? (
            <p className="text-xs text-gray-400 italic">{t('sched.pastDay')}</p>
          ) : adding ? (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <label className="block text-xs font-medium text-gray-600 mb-2">
                {t('sched.class')}
                <select className={field} value={classId} onChange={e => setClassId(e.target.value)}>
                  <option value="">{t('sched.selectClass')}</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <label className="text-xs font-medium text-gray-600">
                  {t('sched.from')}
                  <input type="time" className={field} value={start} onChange={e => setStart(e.target.value)} />
                </label>
                <label className="text-xs font-medium text-gray-600">
                  {t('sched.to')}
                  <input type="time" className={field} value={end} onChange={e => setEnd(e.target.value)} />
                </label>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || !classId || end <= start}
                  onClick={() => run(() => addOneOff(supabase, classId, date!, start, end))}>
                  {busy ? t('status.saving') : t('action.save')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAdding(false)} disabled={busy}>
                  {t('action.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              + {t('sched.addClass')}
            </Button>
          )}
        </Card.Body>
      </Card>
    </div>
  )
}
