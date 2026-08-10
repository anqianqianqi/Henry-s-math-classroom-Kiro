'use client'

/**
 * The calendar's class assignment window — teacher and admin only.
 *
 * Lists every recurring schedule that exists, lets one be changed or dropped,
 * and creates new ones from a class, a weekday and a time.
 *
 * ── WHAT IT DOES NOT DO ─────────────────────────────────────
 * Reach backwards. Creating, changing and deleting a schedule all act from
 * today forward; sessions that already happened keep their rows, their
 * numbering and the homework attached to them. A schedule dropped here stops
 * producing sessions, it does not erase a term.
 *
 * The one-off sessions added by clicking a day are not shown here. They belong
 * to no schedule, which is exactly what makes them survive one being changed —
 * see DaySessionsModal.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import type { TranslationKey } from '@/lib/i18n/catalog'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { classColour } from './MonthCalendar'
import { fromSqlTime } from '@/lib/classSchedule/series'
import {
  listSeries, createSeries, updateSeries, deleteSeries,
  type SeriesInput, type SeriesRow,
} from '@/lib/classSchedule/operations'

const DAY_KEYS: TranslationKey[] = [
  'day.sunday', 'day.monday', 'day.tuesday', 'day.wednesday',
  'day.thursday', 'day.friday', 'day.saturday',
]

export interface ClassAssignmentModalProps {
  open: boolean
  onClose: () => void
  today: string
  /** Fired after any write, so the calendar behind can refetch. */
  onChanged: () => void
}

interface Draft extends SeriesInput { id?: string }

const blankDraft = (today: string): Draft => ({
  class_id: '', weekday: 1, start_time: '16:00', end_time: '17:00',
  effective_from: today, effective_until: null,
})

export function ClassAssignmentModal({ open, onClose, today, onChanged }: ClassAssignmentModalProps) {
  const { t } = useLanguage()
  const supabase = createClient()

  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [series, setSeries] = useState<SeriesRow[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null); setNote(null); setDraft(null)
    ;(async () => {
      try {
        const [{ data: cls }, rows] = await Promise.all([
          supabase.from('classes').select('id, name').order('name', { ascending: true }),
          listSeries(supabase),
        ])
        setClasses(cls || [])
        setSeries(rows)
      } catch (e: any) {
        setError(e?.message ?? String(e))
      }
    })()
    // supabase is recreated per render by createClient(); depending on it would
    // reload the list on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  async function refresh() {
    setSeries(await listSeries(supabase))
    onChanged()
  }

  async function save() {
    if (!draft?.class_id) return
    setBusy(true); setError(null); setNote(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')
      const made = draft.id
        ? await updateSeries(supabase, draft.id, draft, today)
        : await createSeries(supabase, draft, user.id, today)
      setDraft(null)
      setNote(t('sched.generated', { count: made }))
      await refresh()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(row: SeriesRow) {
    if (!confirm(t('sched.deleteSeriesConfirm'))) return
    setBusy(true); setError(null); setNote(null)
    try {
      await deleteSeries(supabase, row.id, row.class_id, today)
      await refresh()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full px-2 py-1.5 border-2 border-gray-200 rounded-lg text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card plain className="max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <Card.Header>
          <div className="flex items-center justify-between gap-3">
            <Card.Title className="flex items-center gap-2">
              <span aria-hidden="true">🗓️</span>
              {t('sched.title')}
            </Card.Title>
            <button onClick={onClose} aria-label={t('action.close')}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2">×</button>
          </div>
        </Card.Header>

        <Card.Body>
          <p className="text-xs text-gray-500 mb-4">{t('sched.forwardOnly')}</p>

          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}
          {note && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              {note}
            </div>
          )}

          {/* ── Existing schedules ───────────────────────── */}
          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
            {t('sched.existing')}
          </h4>
          {series.length === 0 ? (
            <p className="text-sm text-gray-500 italic mb-4">{t('sched.none')}</p>
          ) : (
            <div className="mb-4 divide-y divide-gray-100">
              {series.map(s => (
                <div key={s.id} className="flex items-center gap-3 py-2">
                  <i className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: classColour(s.class_id) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.className}</p>
                    <p className="text-xs text-gray-500">
                      {t(DAY_KEYS[s.weekday])} · {fromSqlTime(s.start_time)}–{fromSqlTime(s.end_time)}
                      {s.effective_until ? ` · ${t('sched.until')} ${s.effective_until}` : ` · ${t('sched.untilOpen')}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" disabled={busy}
                    onClick={() => setDraft({
                      id: s.id, class_id: s.class_id, weekday: s.weekday,
                      start_time: fromSqlTime(s.start_time), end_time: fromSqlTime(s.end_time),
                      effective_from: s.effective_from, effective_until: s.effective_until,
                    })}>
                    {t('action.edit')}
                  </Button>
                  <Button variant="danger" size="sm" disabled={busy} onClick={() => remove(s)}>
                    {t('action.delete')}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* ── Add / edit ───────────────────────────────── */}
          {draft ? (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <label className="col-span-2 text-xs font-medium text-gray-600">
                  {t('sched.class')}
                  <select className={field} value={draft.class_id} disabled={!!draft.id}
                    onChange={e => setDraft({ ...draft, class_id: e.target.value })}>
                    <option value="">{t('sched.selectClass')}</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>

                <label className="text-xs font-medium text-gray-600">
                  {t('sched.weekday')}
                  <select className={field} value={draft.weekday}
                    onChange={e => setDraft({ ...draft, weekday: Number(e.target.value) })}>
                    {DAY_KEYS.map((k, i) => <option key={i} value={i}>{t(k)}</option>)}
                  </select>
                </label>

                <label className="text-xs font-medium text-gray-600">
                  {t('sched.until')}
                  <input type="date" className={field} value={draft.effective_until ?? ''}
                    min={today}
                    onChange={e => setDraft({ ...draft, effective_until: e.target.value || null })} />
                </label>

                <label className="text-xs font-medium text-gray-600">
                  {t('sched.from')}
                  <input type="time" className={field} value={draft.start_time}
                    onChange={e => setDraft({ ...draft, start_time: e.target.value })} />
                </label>

                <label className="text-xs font-medium text-gray-600">
                  {t('sched.to')}
                  <input type="time" className={field} value={draft.end_time}
                    onChange={e => setDraft({ ...draft, end_time: e.target.value })} />
                </label>
              </div>

              <p className="text-[11px] text-gray-500 mb-3">{t('sched.untilHint')}</p>

              <div className="flex gap-2">
                <Button size="sm" onClick={save} disabled={busy || !draft.class_id || draft.end_time <= draft.start_time}>
                  {busy ? t('status.saving') : t('action.save')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDraft(null)} disabled={busy}>
                  {t('action.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setDraft(blankDraft(today))}>
              + {t('sched.addNew')}
            </Button>
          )}
        </Card.Body>
      </Card>
    </div>
  )
}
