'use client'

/**
 * Generate a printable problem set — teacher and admin only.
 *
 * Pick a class and a span of dates; every problem assigned to that class in
 * the span is laid out one to a page in a new window, ready to print.
 *
 * ── WHY THE DATES ARE DROPDOWNS AND NOT DATE FIELDS ─────────
 * They list the days this class actually has problems on. A free date picker
 * invites a range with nothing in it, and the only way to find out is to
 * generate an empty document. Offering the real days means every range that
 * can be chosen produces pages, and the count below the fields says how many
 * before anything opens.
 */

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { readStoredHenryProblem } from '@/lib/henryproblem'
import { problemDatesForClass, problemsForClass } from '@/lib/problemSet/query'
import type { PrintLanguage } from '@/lib/problemSet/wording'

export interface ProblemSetModalProps {
  open: boolean
  onClose: () => void
  /** Classes this teacher can print for. */
  classes: { id: string; name: string }[]
}

export function ProblemSetModal({ open, onClose, classes }: ProblemSetModalProps) {
  const { t } = useLanguage()
  const [classId, setClassId] = useState('')
  const [dates, setDates] = useState<string[]>([])
  const [loadingDates, setLoadingDates] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const [lang, setLang] = useState<PrintLanguage>('both')
  /** How many in range have no snapshot, so the language choice misses them. */
  const [plain, setPlain] = useState(0)

  // Reset on close, so reopening never shows the previous class's dates.
  useEffect(() => {
    if (!open) {
      setClassId(''); setDates([]); setFrom(''); setTo('')
      setCount(null); setLang('both'); setPlain(0)
    }
  }, [open])

  // The days this class has problems on.
  useEffect(() => {
    if (!classId) { setDates([]); setFrom(''); setTo(''); return }
    let cancelled = false
    setLoadingDates(true)
    problemDatesForClass(classId)
      .then(found => {
        if (cancelled) return
        setDates(found)
        // Default to the whole span — the common case is "everything so far".
        setFrom(found[0] ?? '')
        setTo(found[found.length - 1] ?? '')
      })
      .finally(() => { if (!cancelled) setLoadingDates(false) })
    return () => { cancelled = true }
  }, [classId])

  // How many problems the chosen span holds, counted the same way the printed
  // page will count them. The same pass counts the ones with no editable
  // snapshot, which are the ones the language choice cannot touch.
  useEffect(() => {
    if (!classId || !from || !to || from > to) { setCount(null); setPlain(0); return }
    let cancelled = false
    problemsForClass(classId, from, to).then(items => {
      if (cancelled) return
      setCount(items.length)
      setPlain(items.filter(i => !readStoredHenryProblem(i.henryproblem)).length)
    })
    return () => { cancelled = true }
  }, [classId, from, to])

  if (!open) return null

  const backwards = Boolean(from && to && from > to)
  const ready = Boolean(classId && from && to) && !backwards && (count ?? 0) > 0

  function generate() {
    const params = new URLSearchParams({ class: classId, from, to, lang })
    // A new window rather than a route change: the teacher keeps the dashboard
    // they were on, and the printable page owns a clean document to print.
    window.open(`/problem-set?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  const label = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={event => event.stopPropagation()}
        className="mt-16 w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl"
      >
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('pset.title')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('pset.intro')}</p>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">{t('pset.class')}</span>
          <select
            value={classId}
            onChange={e => setClassId(e.target.value)}
            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-primary-500"
          >
            <option value="">{t('pset.pickClass')}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        {classId && (
          loadingDates ? (
            <p className="text-sm text-gray-500">{t('pset.loadingDates')}</p>
          ) : dates.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t('pset.noProblems')}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">{t('pset.from')}</span>
                  <select
                    value={from}
                    onChange={e => setFrom(e.target.value)}
                    className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-primary-500"
                  >
                    {dates.map(d => <option key={d} value={d}>{label(d)}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">{t('pset.to')}</span>
                  <select
                    value={to}
                    onChange={e => setTo(e.target.value)}
                    className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-primary-500"
                  >
                    {dates.map(d => <option key={d} value={d}>{label(d)}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">{t('pset.wording')}</span>
                <select
                  value={lang}
                  onChange={e => setLang(e.target.value as PrintLanguage)}
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-primary-500"
                >
                  <option value="both">{t('pset.langBoth')}</option>
                  <option value="en">{t('pset.langEn')}</option>
                  <option value="zh">{t('pset.langZh')}</option>
                </select>
              </label>

              {backwards ? (
                <p className="text-sm text-red-600">{t('pset.rangeBackwards')}</p>
              ) : count !== null && (
                <p className="text-sm text-gray-500">{t('pset.countInRange', { count })}</p>
              )}

              {/* Only worth saying once a single language has been asked for. */}
              {lang !== 'both' && !backwards && plain > 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {plain === count
                    ? t('pset.langAllNoSnapshot')
                    : t('pset.langNoSnapshot', { count: plain })}
                </p>
              )}
            </>
          )
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>{t('action.cancel')}</Button>
          <Button size="sm" disabled={!ready} onClick={generate}>{t('pset.generate')}</Button>
        </div>
      </div>
    </div>
  )
}
