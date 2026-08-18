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
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { createClient } from '@/lib/supabase/client'
import { readStoredHenryProblem } from '@/lib/henryproblem'
import { problemDatesForClass, problemsForClass, type ProblemSetItem } from '@/lib/problemSet/query'
import { problemSetScope, type ProblemSetScope } from '@/lib/problemSet/viewer'
import { renderUpload, visionDataUrl, type RenderedPage } from '@/lib/solutions/pages'
import { cropToBlob, cropToDataUrl, measureWorkBox } from '@/lib/solutions/cropCanvas'
import { postCrops } from '@/lib/solutions/post'
import { matchPrevious } from '@/lib/solutions/previous'
import { ProblemPeek } from '@/components/solutions/ProblemPeek'
import type { Box } from '@/lib/solutions/crop'

type Stage = 'pick' | 'reading' | 'review' | 'posting' | 'done'

/** Work already handed in for a problem, shown beside the new crop. */
interface Previous {
  id: string
  imageUrl: string | null
  /** Typed working, when it was submitted from the challenge page. */
  content: string
  points: number | null
  /**
   * Locked means the student accepted the grade and the challenge page stops
   * offering them an Edit button. Nothing here may overwrite that.
   */
  isLocked: boolean
  submittedAt: string
}

/** One row of the review: a problem, and whatever was found for it. */
interface Found {
  problem: ProblemSetItem
  /** Null when nothing was found — the row still shows, saying so. */
  page: number | null
  box: Box | null
  confidence: number
  preview: string | null
  accepted: boolean
  /** What is already there, if anything. */
  previous?: Previous
}

/**
 * What this student has already handed in, for each problem in the set.
 *
 * ── WHY TWO KEYS ────────────────────────────────────────────
 * A submission to a problem published from the challenge bank is keyed by the
 * BANK item, not by the daily instance, so that republishing the problem keeps
 * the student's work (add-bank-item-submissions.sql). Deleting an instance
 * sets challenge_id to NULL and leaves the row standing on bank_item_id alone.
 *
 * Looking only under challenge_id therefore found nothing for any problem that
 * came from the bank — which is most of them — so the review showed no sign
 * that a problem had been answered and no picture of the answer. Worse than the
 * missing notice: an insert would then have added a SECOND submission beside
 * the one already there, since the partial unique index only covers rows with a
 * null bank_item_id.
 *
 * Both keys are read, and the bank id wins where a problem has one, matching
 * how the challenge page resolves the same question.
 */
async function loadPrevious(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  problems: ProblemSetItem[],
): Promise<Map<string, Previous>> {
  const columns = 'id, challenge_id, bank_item_id, content, image_url, points, is_locked, submitted_at'
  const bankIds = problems.map(p => p.source_bank_id).filter(Boolean) as string[]

  const [byChallenge, byBank] = await Promise.all([
    supabase.from('challenge_submissions').select(columns)
      .eq('user_id', userId).in('challenge_id', problems.map(p => p.id)),
    bankIds.length
      ? supabase.from('challenge_submissions').select(columns)
          .eq('user_id', userId).in('bank_item_id', bankIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const read = (r: any): Previous => ({
    id: r.id,
    imageUrl: r.image_url ?? null,
    content: String(r.content ?? ''),
    points: typeof r.points === 'number' ? r.points : null,
    isLocked: Boolean(r.is_locked),
    submittedAt: String(r.submitted_at ?? ''),
  })

  const rows = [...((byChallenge as any).data ?? []), ...((byBank as any).data ?? [])]

  const found = new Map<string, Previous>()
  matchPrevious(problems, rows).forEach((row, problemId) => found.set(problemId, read(row)))
  return found
}

export default function SolutionsPage() {
  const { t } = useLanguage()
  const supabase = createClient()
  const router = useRouter()

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
  const [result, setResult] = useState<{ posted: number; failed: number; locked: number } | null>(null)

  /** The problem being read full size, if one is open. */
  const [peek, setPeek] = useState<Found | null>(null)

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

      /*
        What has already been handed in, in full rather than just its id.

        Enough to put the old answer beside the new one: its picture, anything
        typed, when it was sent, the mark if it has been graded, and whether it
        is locked. A student re-uploading a set they have partly done should be
        deciding between two answers they can both see, not agreeing to
        overwrite something described to them only as "already handed in".
      */
      const existing = await loadPrevious(supabase, scope!.userId!, problems)

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
        const page = hit ? hit.page : null
        /*
          The model says which page a problem is on, and which side of a
          two-up scan. The rectangle is then measured off that page: the
          bottom edge of the printed card down to the last stroke of writing.

          Its own boxes were wrong in both directions at once — opening inside
          the printed card, so the crop arrived with the Chinese wording and
          the tag chips above the answer, and closing above the final line, so
          the answer was cut off. Vision models identify reliably and locate
          approximately, so it is used as a hint about which half and nothing
          more.
        */
        const box: Box | null = page !== null ? measureWorkBox(pages[page], hit?.box) : null
        return {
          problem,
          page,
          box,
          confidence: hit?.confidence ?? 0,
          preview: box && page !== null ? cropToDataUrl(pages[page], box) : null,
          /*
            Anything newly found is handed in by default. A problem that
            already has an answer is not: re-uploading a whole set must never
            quietly replace work the student did earlier, so keeping what is
            there is the default and replacing is the deliberate choice.
          */
          accepted: Boolean(box) && !existing.has(problem.id),
          previous: existing.get(problem.id),
        }
      }))
      setStage('review')
    } catch (err: any) {
      const raw = String(err?.message ?? err)
      // A file the browser cannot decode names itself; anything else is shown
      // as it came, since it is already one of the messages thrown above.
      const unreadable = raw.startsWith('UNREADABLE_IMAGE:')
      setError(unreadable ? t('sol.unreadableImage', { file: raw.slice('UNREADABLE_IMAGE:'.length) }) : raw)
      setStage('pick')
    }
  }

  /**
   * Point a problem at a page by hand, when the matching missed it.
   *
   * Still measured rather than taken whole: the same card-edge detection runs
   * on the page chosen, so picking a page by hand gives the same tidy crop as
   * a match. Only if there is nothing measurable there does it fall back to
   * the entire page, which at least hands in something the teacher can read.
   */
  function useWholePage(index: number, page: number) {
    const pages = pagesRef.current
    if (!pages[page]) return
    const box: Box = measureWorkBox(pages[page]) ?? { x: 0, y: 0, w: 1, h: 1 }
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
      replaces: r.previous?.id,
      // Carried so the writer can refuse a locked row on its own account,
      // rather than trusting this page to have filtered it out.
      previousIsLocked: r.previous?.isLocked ?? false,
      // Without this a bank-sourced problem gets a row keyed only by its daily
      // instance, which the challenge page will not find and which sits beside
      // the student's real submission rather than being it.
      bankItemId: r.problem.source_bank_id,
    })))

    const outcome = await postCrops(scope.userId, crops)
    // A locked row was refused on purpose, so it is reported as left alone
    // rather than counted among the failures.
    const locked = outcome.failed.filter(f => f.reason === 'LOCKED').length
    setResult({
      posted: outcome.posted.length,
      failed: outcome.failed.length - locked,
      locked,
    })
    setStage('done')
  }

  /**
    Leaving, with a word first where there is something to lose.

    The rendered pages and their crops live only in this page's memory, and
    the reading that produced them cost a call to the model. Walking away from
    a review that has answers waiting to be handed in throws all of that away,
    and it is not obvious from a back arrow that it would.
  */
  function leave() {
    const busy = stage === 'reading' || stage === 'posting'
    const unposted = stage === 'review' && rows.some(r => r.accepted)
    if ((busy || unposted) && !window.confirm(t('sol.leaveWarning'))) return
    router.push('/dashboard')
  }

  const acceptedCount = rows.filter(r => r.accepted).length
  const missing = rows.filter(r => !r.box).length

  if (scope && !scope.userId) {
    return <Shell title={t('sol.title')}><p className="text-sm text-gray-500">{t('pset.signedOut')}</p></Shell>
  }

  return (
    <Shell title={t('sol.title')} onBack={leave}>
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
            <span className="mt-1 block text-[11px] text-amber-800/80">{t('sol.reviewHint')}</span>
          </div>

          {peek && <ProblemPeek problem={peek.problem} preview={peek.preview} onClose={() => setPeek(null)} />}

          <ul className="space-y-3">
            {rows.map((row, i) => (
              <li key={row.problem.id} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {/*
                      The title opens the question, and says so with a button
                      beside it. Checking that a crop landed on the right
                      problem means reading the problem, and the review only
                      ever showed its title — the one thing a student cannot
                      check an answer against.
                    */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPeek(row)}
                        className="truncate text-left text-sm font-semibold text-gray-900 underline decoration-dotted
                                   underline-offset-2 hover:text-primary-700"
                      >
                        {row.problem.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPeek(row)}
                        className="shrink-0 rounded-full border border-gray-300 px-2 py-0.5 text-[11px]
                                   text-gray-600 transition-colors hover:border-primary-400 hover:text-primary-700"
                      >
                        🔍 {t('sol.viewProblem')}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">{niceDate(row.problem.challenge_date)}</p>
                    {/* Said in the header as well as shown in the panels below.
                        A problem with an answer already but no new crop found
                        falls through to the "nothing found" branch, and used to
                        give no hint at all that it had been answered. */}
                    {row.previous && (
                      <p className="mt-1 text-xs text-amber-700">
                        {row.previous.isLocked ? `🔒 ${t('sol.alreadyLocked')}` : t('sol.alreadyHandedIn')}
                      </p>
                    )}
                  </div>
                  {/* Only a problem with nothing handed in yet gets a plain
                      include box. Where there is already an answer the choice
                      is between two of them, and it is made below, next to
                      both. */}
                  {row.box && !row.previous && (
                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={row.accepted}
                        onChange={e => setRows(rs => rs.map((r, n) => n === i ? { ...r, accepted: e.target.checked } : r))}
                      />
                      {t('sol.include')}
                    </label>
                  )}
                </div>

                {row.previous && row.preview ? (
                  <Compare
                    row={row}
                    onChoose={replace => setRows(rs => rs.map((r, n) => n === i ? { ...r, accepted: replace } : r))}
                  />
                ) : row.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.preview} alt={row.problem.title}
                    className="mt-2 max-h-64 w-full rounded border border-gray-200 object-contain bg-white" />
                ) : (
                  <div className="mt-2 rounded border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-500">
                    {/* Nothing new was found. If there is an answer already,
                        show it — the student needs to know this problem is
                        covered, not just that this upload missed it. */}
                    {row.previous && (
                      <div className="mb-3 text-left">
                        <p className="mb-1 text-[11px] font-semibold text-gray-700">
                          {t('sol.previous')}
                          <span className="ml-2 font-normal text-gray-500">
                            {row.previous.submittedAt ? niceDate(row.previous.submittedAt.slice(0, 10)) : ''}
                          </span>
                        </p>
                        {row.previous.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.previous.imageUrl} alt={t('sol.previous')}
                            className="max-h-48 w-full rounded border border-gray-200 bg-white object-contain" />
                        )}
                        {row.previous.content.trim() && (
                          <p className="whitespace-pre-wrap break-words text-[11px] text-gray-700">
                            {row.previous.content.trim().slice(0, 400)}
                          </p>
                        )}
                      </div>
                    )}
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
          {result.locked > 0 && (
            <p className="mt-1 text-sm text-gray-600">{t('sol.postFailedLocked', { count: result.locked })}</p>
          )}
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-primary-600 underline">
            {t('sol.backToDashboard')}
          </Link>
        </div>
      )}
    </Shell>
  )
}

/**
 * The answer already handed in, beside the one just found.
 *
 * Two panels rather than a checkbox saying "replace". The student is choosing
 * between two pieces of their own work, possibly written weeks apart, and the
 * only way to choose sensibly is to see both. Keeping what is there is
 * selected: an upload of a whole set will meet problems already done, and the
 * safe reading of that is "I am filling in the gaps", not "throw the rest
 * away".
 *
 * A locked answer offers no choice at all. Locked means the student accepted
 * the grade, and the challenge page withdraws its Edit button at that point;
 * this has no business doing what that page refuses to.
 */
function Compare({ row, onChoose }: { row: Found; onChoose: (replace: boolean) => void }) {
  const { t } = useLanguage()
  const previous = row.previous!
  const locked = previous.isLocked

  const panel = 'rounded-lg border p-2'
  const chosen = 'border-primary-500 bg-primary-50'
  const plain = 'border-gray-200'

  return (
    <div className="mt-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {/* What is there now */}
        <div className={`${panel} ${!row.accepted ? chosen : plain}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-gray-700">{t('sol.previous')}</span>
            <span className="text-[11px] text-gray-500">
              {previous.submittedAt ? niceDate(previous.submittedAt.slice(0, 10)) : ''}
            </span>
          </div>
          {previous.points !== null && (
            <p className="mb-1 text-[11px] font-medium text-emerald-700">
              {t('sol.gradedAt', { points: previous.points })}
            </p>
          )}
          {previous.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previous.imageUrl} alt={t('sol.previous')}
              className="max-h-56 w-full rounded border border-gray-200 bg-white object-contain" />
          )}
          {previous.content.trim() && (
            <p className="mt-1 whitespace-pre-wrap break-words text-[11px] text-gray-700">
              {previous.content.trim().slice(0, 400)}
            </p>
          )}
          {!previous.imageUrl && !previous.content.trim() && (
            <p className="text-[11px] italic text-gray-400">{t('sol.previousEmpty')}</p>
          )}
        </div>

        {/* What this upload found */}
        <div className={`${panel} ${row.accepted ? chosen : plain}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-gray-700">{t('sol.current')}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.preview!} alt={t('sol.current')}
            className="max-h-56 w-full rounded border border-gray-200 bg-white object-contain" />
        </div>
      </div>

      {locked ? (
        <p className="mt-2 rounded bg-gray-100 px-2 py-1.5 text-[11px] text-gray-600">
          🔒 {t('sol.lockedKeep')}
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-gray-700">
            <input type="radio" name={`choice-${row.problem.id}`}
              checked={!row.accepted} onChange={() => onChoose(false)} />
            {t('sol.keepPrevious')}
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-700">
            <input type="radio" name={`choice-${row.problem.id}`}
              checked={row.accepted} onChange={() => onChoose(true)} />
            {t('sol.useNew')}
          </label>
          {previous.points !== null && row.accepted && (
            // Replacing graded work is allowed while it is unlocked, but the
            // student should know the mark it already carries is about to
            // describe an answer that is no longer there.
            <span className="text-[11px] text-amber-700">{t('sol.replacingGraded')}</span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The page frame, with the way out.
 *
 * This route is pushed from the dashboard rather than opened in its own
 * window, so leaving it is a navigation the page has to offer. Without one, a
 * student who opened it to look, or whose upload matched nothing, is left
 * pressing the browser's back button — and on the phone build there is not
 * always one of those to press.
 */
function Shell({
  title, onBack, children,
}: {
  title: string
  /** Runs instead of the plain link, for a stage with work to lose. */
  onBack?: () => void
  children: React.ReactNode
}) {
  const { t } = useLanguage()

  const label = <>← {t('sol.backToDashboard')}</>
  const style = 'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900'

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2">
          {onBack
            ? <button type="button" onClick={onBack} className={style}>{label}</button>
            : <Link href="/dashboard" className={style}>{label}</Link>}
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-lg font-bold text-gray-900">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  )
}

function niceDate(d: string): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}
