'use client'

/**
 * Hand in a whole problem set at once.
 *
 * A student prints the set, works through it on paper, photographs or scans
 * the pages, and drops the result here. The pages are read, each problem's
 * working is found and cut out, and the crops are shown back before anything
 * is posted. Confirming posts one submission per problem, exactly as if each
 * had been submitted from its own challenge page.
 *
 * ── WHY THE REVIEW STEP IS NOT OPTIONAL ─────────────────────
 * Posting a submission notifies the teacher, grants pet XP, and puts the work
 * under the student's name in the grading queue. A crop cut in the wrong place
 * is easy to see and impossible to notice after the fact, so the student looks
 * at what was found before any of that happens. It costs one click and it is
 * the difference between a mistake being caught and a mistake being marked.
 */

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { createClient } from '@/lib/supabase/client'
import { readStoredHenryProblem } from '@/lib/henryproblem'
import { problemDatesForClass, problemsForClass, type ProblemSetItem } from '@/lib/problemSet/query'
import { problemSetScope, type ProblemSetScope } from '@/lib/problemSet/viewer'
import { renderUpload, visionDataUrl, type RenderedPage } from '@/lib/solutions/pages'
import { cropToBlob, cropToDataUrl } from '@/lib/solutions/cropCanvas'
import { postCrops } from '@/lib/solutions/post'
import type { Box } from '@/lib/solutions/crop'

type Stage = 'pick' | 'reading' | 'review' | 'posting' | 'done'

/** One row of the review: a problem, and whatever was found for it. */
interface Found {
  problem: ProblemSetItem
  /** Null when nothing was found — the row still shows, saying so. */
  page: number | null
  box: Box | null
  confidence: number
  preview: string | null
  accepted: boolean
  /** Id of an existing submission this would replace. */
  existing?: string
}

export default function SolutionsPage() {
  const { t } = useLanguage()
  const supabase = createClient()

  const [scope, setScope] = useState<ProblemSetScope | null>(null)
  const [classId, setClassId] = useState('')
  const [dates, setDates] = useState<string[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const [stage, setStage] = useState<Stage>('pick')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [rows, setRows] = useState<Found[]>([])
  const [result, setResult] = useState<{ posted: number; failed: number } | null>(null)

  /** Kept out of state: canvases are large and never need to re-render. */
  const pagesRef = useRef<RenderedPage[]>([])

  useEffect(() => { problemSetScope().then(setScope) }, [])

  useEffect(() => {
    if (!classId) { setDates([]); setFrom(''); setTo(''); return }
    let cancelled = false
    problemDatesForClass(classId, scope?.notAfter).then(found => {
      if (cancelled) return
      setDates(found)
      setFrom(found[0] ?? '')
      setTo(found[found.length - 1] ?? '')
    })
    return () => { cancelled = true }
  }, [classId, scope?.notAfter])

  const ready = Boolean(classId && from && to && files.length && from <= to)

  async function readPages() {
    setError('')
    setStage('reading')
    try {
      setNote(t('sol.readingPages'))
      const pages = await renderUpload(files)
      pagesRef.current = pages
      if (!pages.length) throw new Error(t('sol.noPages'))

      const problems = await problemsForClass(classId, from, to, scope?.notAfter)
      if (!problems.length) throw new Error(t('sol.noProblems'))

      // Which of these the student has already handed in, so the review can
      // say so rather than failing on the unique (challenge, user) constraint.
      const { data: already } = await supabase
        .from('challenge_submissions')
        .select('id, challenge_id')
        .eq('user_id', scope!.userId!)
        .in('challenge_id', problems.map(p => p.id))
      const existing = new Map((already ?? []).map((r: any) => [r.challenge_id, r.id as string]))

      setNote(t('sol.matching', { pages: pages.length, problems: problems.length }))
      const res = await fetch('/api/solutions/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: pages.map(visionDataUrl),
          problems: problems.map(p => {
            const sheet = readStoredHenryProblem(p.henryproblem)
            return {
              id: p.id,
              title: p.title,
              wording: sheet ? `${sheet.problem.english}\n${sheet.problem.chinese}` : (p.description ?? ''),
            }
          }),
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(t(body.error === 'not_configured' ? 'sol.notConfigured' : 'sol.matchFailed'))
      }

      const { answers } = await res.json()
      const byId = new Map((answers ?? []).map((a: any) => [a.id, a]))

      setRows(problems.map(problem => {
        const hit: any = byId.get(problem.id)
        const box: Box | null = hit ? hit.box : null
        const page = hit ? hit.page : null
        return {
          problem,
          page,
          box,
          confidence: hit?.confidence ?? 0,
          preview: box && page !== null ? cropToDataUrl(pages[page], box) : null,
          // Anything found is accepted by default; a problem already handed in
          // is not, so re-uploading a set never quietly overwrites older work.
          accepted: Boolean(box) && !existing.has(problem.id),
          existing: existing.get(problem.id),
        }
      }))
      setStage('review')
    } catch (err: any) {
      setError(String(err?.message ?? err))
      setStage('pick')
    }
  }

  /** Fall back to the whole page when the crop missed. */
  function useWholePage(index: number, page: number) {
    const pages = pagesRef.current
    if (!pages[page]) return
    const box: Box = { x: 0, y: 0, w: 1, h: 1 }
    setRows(rs => rs.map((r, i) => i === index
      ? { ...r, page, box, preview: cropToDataUrl(pages[page], box), accepted: true }
      : r))
  }

  async function post() {
    if (!scope?.userId) return
    setStage('posting')
    const pages = pagesRef.current
    const chosen = rows.filter(r => r.accepted && r.box && r.page !== null)

    const crops = await Promise.all(chosen.map(async r => ({
      challengeId: r.problem.id,
      blob: await cropToBlob(pages[r.page!], r.box!),
      replaces: r.existing,
    })))

    const outcome = await postCrops(scope.userId, crops)
    setResult({ posted: outcome.posted.length, failed: outcome.failed.length })
    setStage('done')
  }

  const acceptedCount = rows.filter(r => r.accepted).length
  const missing = rows.filter(r => !r.box).length

  if (scope && !scope.userId) {
    return <Shell title={t('sol.title')}><p className="text-sm text-gray-500">{t('pset.signedOut')}</p></Shell>
  }

  return (
    <Shell title={t('sol.title')}>
      {stage === 'pick' && (
        <>
          <p className="mb-4 text-sm text-gray-600">{t('sol.intro')}</p>

          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium text-gray-700">{t('pset.class')}</span>
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-primary-500"
            >
              <option value="">{t('pset.pickClass')}</option>
              {(scope?.classes ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          {dates.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">{t('pset.from')}</span>
                <select value={from} onChange={e => setFrom(e.target.value)}
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-primary-500">
                  {dates.map(d => <option key={d} value={d}>{niceDate(d)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">{t('pset.to')}</span>
                <select value={to} onChange={e => setTo(e.target.value)}
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-primary-500">
                  {dates.map(d => <option key={d} value={d}>{niceDate(d)}</option>)}
                </select>
              </label>
            </div>
          )}

          <label className="mb-1 block">
            <span className="mb-1 block text-sm font-medium text-gray-700">{t('sol.file')}</span>
            <input
              type="file"
              accept="application/pdf,image/*"
              multiple
              onChange={e => setFiles(Array.from(e.target.files ?? []))}
              className="w-full rounded-lg border-2 border-dashed border-gray-300 px-3 py-4 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-500">{t('sol.fileHint')}</span>
          </label>

          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="button"
            disabled={!ready}
            onClick={readPages}
            className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white
                       transition-colors hover:bg-primary-700 disabled:opacity-40"
          >
            {t('sol.read')}
          </button>
        </>
      )}

      {(stage === 'reading' || stage === 'posting') && (
        <p className="py-10 text-center text-sm text-gray-600">
          {stage === 'posting' ? t('sol.posting') : note || t('sol.readingPages')}
        </p>
      )}

      {stage === 'review' && (
        <>
          <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t('sol.reviewIntro', { found: rows.length - missing, total: rows.length })}
            {missing > 0 && <> {t('sol.reviewMissing', { count: missing })}</>}
          </div>

          <ul className="space-y-3">
            {rows.map((row, i) => (
              <li key={row.problem.id} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{row.problem.title}</p>
                    <p className="text-xs text-gray-500">{niceDate(row.problem.challenge_date)}</p>
                    {row.existing && (
                      <p className="mt-1 text-xs text-amber-700">{t('sol.alreadyHandedIn')}</p>
                    )}
                  </div>
                  {row.box && (
                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={row.accepted}
                        onChange={e => setRows(rs => rs.map((r, n) => n === i ? { ...r, accepted: e.target.checked } : r))}
                      />
                      {row.existing ? t('sol.replace') : t('sol.include')}
                    </label>
                  )}
                </div>

                {row.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.preview} alt={row.problem.title}
                    className="mt-2 max-h-64 w-full rounded border border-gray-200 object-contain bg-white" />
                ) : (
                  <div className="mt-2 rounded border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-500">
                    {t('sol.notFound')}
                    <div className="mt-2 flex flex-wrap justify-center gap-1">
                      {pagesRef.current.map((_, p) => (
                        <button key={p} type="button" onClick={() => useWholePage(i, p)}
                          className="rounded border border-gray-300 px-2 py-0.5 text-[11px] hover:bg-gray-50">
                          {t('sol.usePage', { page: p + 1 })}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center gap-2">
            <button type="button" onClick={post} disabled={!acceptedCount}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white
                         transition-colors hover:bg-primary-700 disabled:opacity-40">
              {t('sol.postCount', { count: acceptedCount })}
            </button>
            <button type="button" onClick={() => { setStage('pick'); setRows([]) }}
              className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">
              {t('action.cancel')}
            </button>
          </div>
        </>
      )}

      {stage === 'done' && result && (
        <div className="py-8 text-center">
          <p className="text-2xl" aria-hidden="true">✅</p>
          <p className="mt-2 text-sm text-gray-700">{t('sol.posted', { count: result.posted })}</p>
          {result.failed > 0 && (
            <p className="mt-1 text-sm text-red-700">{t('sol.postFailed', { count: result.failed })}</p>
          )}
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-primary-600 underline">
            {t('sol.backToDashboard')}
          </Link>
        </div>
      )}
    </Shell>
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-lg font-bold text-gray-900">{title}</h1>
        {children}
      </div>
    </div>
  )
}

function niceDate(d: string): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}
