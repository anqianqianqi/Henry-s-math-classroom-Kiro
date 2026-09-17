'use client'

/**
 * The grading desk: the teacher's side of the Studio.
 *
 * ── WHY A DESK AND NOT THE GRADING PAGE ─────────────────────
 * /grading loads every submission on the site, lists them, and opens a spread
 * with the whole class's answers. Good for a look around; slow for a Tuesday
 * evening with thirty photographs to mark. The desk is the other shape: the
 * queue on the left holds only what still needs a grade, one student's work
 * sits beside the problem in the middle, and the assistant's suggestion is on
 * the right with the score box already filled. Enter saves and moves on.
 *
 * ── WHAT IT WRITES ──────────────────────────────────────────
 * Exactly what the site writes when a teacher grades from the challenge page:
 * the score, the comment, the notification to the student, and the feedback
 * that teaches the assistant. All of that lives in lib/studio/grade.ts, with
 * tests; this file only decides when to call it.
 *
 * ── LOCAL ONLY ──────────────────────────────────────────────
 * app/studio/layout.tsx refuses to render unless STUDIO_ENABLED=1, which
 * `npm run studio` sets on the teacher's machine and Vercel never does.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { createClient } from '@/lib/supabase/client'
import { QueueRail, type BatchState, type ClassOption, type RailFilters } from '@/components/studio/QueueRail'
import { WorkPane, type ProblemInfo, type WorkComment } from '@/components/studio/WorkPane'
import { DeskActions, type DeskMessage } from '@/components/studio/DeskActions'
import {
  applyFilters,
  attachTa,
  feedbackActionFor,
  flatten,
  groupByProblem,
  problemKey,
  rowFromRecord,
  stepIndex,
  timeAgoParts,
  type QueueRow,
  type TaSuggestion,
} from '@/lib/studio/queue'
import { gradeSubmission, requestTaGrade, sendTaFeedback, StudioError } from '@/lib/studio/grade'
import { fieldFrom, interpretKey } from '@/lib/studio/keys'

export const dynamic = 'force-dynamic'

const SUBMISSION_COLUMNS = `
  id, user_id, challenge_id, bank_item_id, content, image_url, points, is_locked, submitted_at,
  profiles:user_id(full_name, first_name, last_name, email),
  daily_challenges:challenge_id(title, challenge_date, max_points),
  challenge_bank:bank_item_id(title, max_points)
`
const TA_COLUMNS = 'id, submission_id, suggested_score, max_score, confidence, suggested_comment, reasoning, status, henry_score'
/** How many hand-ins one load brings back. Pending queues are small; the graded view is a window. */
const PENDING_LIMIT = 400
const GRADED_LIMIT = 150
/** Digits typed this close together make one number: "1" then "0" is ten, not a change of mind. */
const DIGIT_WINDOW_MS = 900

type Mode = 'pending' | 'graded'

export default function StudioPage() {
  const { t, language } = useLanguage()
  const supabase = useMemo(() => createClient(), [])

  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [mode, setMode] = useState<Mode>('pending')
  const [rows, setRows] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [filters, setFilters] = useState<RailFilters>({ classId: '', from: '', to: '', search: '' })
  const [members, setMembers] = useState<Set<string> | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [problems, setProblems] = useState<Record<string, ProblemInfo>>({})
  const [problemLoading, setProblemLoading] = useState(false)
  const [comments, setComments] = useState<WorkComment[]>([])
  const [score, setScore] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<DeskMessage | null>(null)
  const [taRunning, setTaRunning] = useState<Record<string, boolean>>({})
  const [taErrors, setTaErrors] = useState<Record<string, string>>({})
  const [flagOpen, setFlagOpen] = useState(false)
  const [flagNote, setFlagNote] = useState('')
  const [batch, setBatch] = useState<BatchState>({ running: false, done: 0, total: 0 })

  const scoreRef = useRef<HTMLInputElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const lastDigitAt = useRef(0)
  const batchStop = useRef(false)

  // ── Reading ───────────────────────────────────────────────────────────

  const token = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const [{ data: profile }, submissions, { data: classRows }] = await Promise.all([
      supabase.from('profiles').select('full_name, nickname').eq('id', user.id).maybeSingle(),
      mode === 'pending'
        ? supabase.from('challenge_submissions').select(SUBMISSION_COLUMNS).is('points', null)
            .order('submitted_at', { ascending: false }).limit(PENDING_LIMIT)
        : supabase.from('challenge_submissions').select(SUBMISSION_COLUMNS).not('points', 'is', null)
            .order('updated_at', { ascending: false }).limit(GRADED_LIMIT),
      supabase.from('classes').select('id, name').eq('is_active', true).order('name'),
    ])
    setUserName(String((profile as any)?.full_name || (profile as any)?.nickname || ''))
    setClasses(((classRows as any[] | null) || []).map(c => ({ id: String(c.id), name: String(c.name) })))

    if (submissions.error) {
      setLoadError(t('studio.errLoad'))
      setLoading(false)
      return
    }
    const shaped = ((submissions.data as any[] | null) || []).map(rowFromRecord)

    // The assistant's rows, in batches: a long IN list makes a long URL.
    const taRows: any[] = []
    const ids = shaped.map(r => r.id)
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await supabase.from('ta_grades').select(TA_COLUMNS).in('submission_id', ids.slice(i, i + 150))
      if (data) taRows.push(...(data as any[]))
    }
    setRows(attachTa(shaped, taRows))
    setLoading(false)
  }, [supabase, mode, t])

  useEffect(() => { load() }, [load])

  // The class filter: the ids of everyone in that class, fetched once per choice.
  useEffect(() => {
    if (!filters.classId) { setMembers(null); return }
    let cancelled = false
    supabase.from('class_members').select('user_id').eq('class_id', filters.classId).then(({ data }) => {
      if (!cancelled) setMembers(new Set(((data as any[] | null) || []).map(m => String(m.user_id))))
    })
    return () => { cancelled = true }
  }, [filters.classId, supabase])

  const visible = useMemo(
    () => applyFilters(rows, { members, from: filters.from, to: filters.to, search: filters.search }),
    [rows, members, filters.from, filters.to, filters.search],
  )
  const groups = useMemo(() => groupByProblem(visible), [visible])
  const ordered = useMemo(() => flatten(groups), [groups])
  const index = ordered.findIndex(r => r.id === activeId)
  const active = index >= 0 ? ordered[index] : null

  // Keep a valid selection: the first row when nothing is chosen, nothing when the list empties.
  useEffect(() => {
    if (ordered.length === 0) { if (activeId) setActiveId(null); return }
    if (!activeId || !ordered.some(r => r.id === activeId)) setActiveId(ordered[0].id)
  }, [ordered, activeId])

  // The problem for the open row, cached by key so walking a class costs one fetch per problem.
  useEffect(() => {
    if (!active) return
    const key = problemKey(active)
    if (problems[key]) return
    let cancelled = false
    setProblemLoading(true)
    ;(async () => {
      let info: ProblemInfo = {
        key, title: active.problemTitle, description: null, henryproblem: null, imageUrl: null,
        maxPoints: active.maxPoints, challengeId: active.challengeId, gone: true,
      }
      if (active.challengeId) {
        const { data } = await supabase.from('daily_challenges')
          .select('id, title, challenge_date, description, henryproblem, image_url, max_points')
          .eq('id', active.challengeId).maybeSingle()
        if (data) {
          const d = data as any
          info = { ...info, title: d.title, description: d.description ?? null, henryproblem: d.henryproblem,
            imageUrl: d.image_url ?? null, maxPoints: d.max_points ?? active.maxPoints, gone: false }
        }
      }
      if (info.gone && active.bankItemId) {
        const { data } = await supabase.from('challenge_bank')
          .select('id, title, description, henryproblem, image_url, max_points')
          .eq('id', active.bankItemId).maybeSingle()
        if (data) {
          const d = data as any
          info = { ...info, title: d.title, description: d.description ?? null, henryproblem: d.henryproblem,
            imageUrl: d.image_url ?? null, maxPoints: d.max_points ?? active.maxPoints, gone: false }
        }
      }
      if (!cancelled) {
        setProblems(prev => ({ ...prev, [key]: info }))
        setProblemLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [active, problems, supabase])

  // The thread under the open row, and the fields, reset for each student.
  useEffect(() => {
    setComments([])
    setFlagOpen(false)
    setFlagNote('')
    setMessage(null)
    if (!active) { setScore(''); setComment(''); return }
    // The assistant's suggestion goes straight into the boxes: reading, then Enter.
    const suggested = active.ta && active.ta.status === 'pending' ? active.ta : null
    setScore(active.points !== null ? String(active.points) : suggested ? String(suggested.suggestedScore) : '')
    setComment(suggested?.comment ?? '')
    let cancelled = false
    supabase.from('submission_comments')
      .select('id, user_id, content, created_at, profiles!inner(full_name, nickname)')
      .eq('submission_id', active.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setComments(((data as any[] | null) || []).map(c => ({
          id: String(c.id), userId: String(c.user_id), content: String(c.content ?? ''),
          createdAt: String(c.created_at), authorName: String(c.profiles?.full_name || c.profiles?.nickname || ''),
        })))
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  // ── Writing ───────────────────────────────────────────────────────────

  const updateRow = useCallback((id: string, patch: Partial<QueueRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }, [])

  function describe(err: unknown): string {
    if (err instanceof StudioError) {
      if (err.code === 'score') return t('studio.errScore', { max: active?.maxPoints ?? 100 })
      if (err.code === 'comment') return t('studio.errComment', { reason: err.detail })
      if (err.code === 'feedback') return t('studio.errFeedback', { reason: err.detail })
      return t('studio.errSave', { reason: err.detail })
    }
    return t('studio.errSave', { reason: err instanceof Error ? err.message : String(err) })
  }

  const moveBy = useCallback((delta: number) => {
    const next = stepIndex(index, delta, ordered.length)
    if (next >= 0 && ordered[next]) setActiveId(ordered[next].id)
  }, [index, ordered])

  const save = useCallback(async (override?: { score: number; comment: string }) => {
    if (!active || !userId || busy) return
    const scoreValue = override ? override.score : score
    const commentValue = override ? override.comment : comment
    setBusy(true)
    setMessage(null)
    try {
      const result = await gradeSubmission(supabase, {
        submissionId: active.id,
        studentId: active.userId,
        teacherId: userId,
        teacherName: userName,
        score: scoreValue,
        maxPoints: active.maxPoints,
        comment: commentValue,
        problemTitle: problems[problemKey(active)]?.title || active.problemTitle,
        link: active.challengeId ? `/challenges/${active.challengeId}` : null,
      })
      const action = feedbackActionFor(active.ta, result.score)
      let taPatch: TaSuggestion | null = active.ta
      let warning: string | null = null
      if (action && active.ta?.id) {
        try {
          await sendTaFeedback(fetch, await token(), {
            taGradeId: active.ta.id, action, score: result.score, comment: commentValue, note: flagNote,
          })
          taPatch = { ...active.ta, status: action, henryScore: result.score }
        } catch (err) {
          // The grade is saved; only the assistant's lesson was lost. Say so and carry on.
          warning = describe(err)
        }
      }
      updateRow(active.id, { points: result.score, ta: taPatch })
      setMessage(warning
        ? { kind: 'error', text: warning }
        : { kind: 'ok', text: t('studio.saved', { score: result.score, max: active.maxPoints, name: active.studentName || t('studio.unknownStudent') }) })
      if (mode === 'pending') {
        // The row leaves the queue; the desk moves to whichever now sits at its place.
        const next = ordered[index + 1] ?? ordered[index - 1] ?? null
        setRows(prev => prev.filter(r => r.id !== active.id))
        setActiveId(next?.id ?? null)
      }
    } catch (err) {
      setMessage({ kind: 'error', text: describe(err) })
    } finally {
      setBusy(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId, busy, score, comment, supabase, userName, problems, flagNote, updateRow, mode, ordered, index, t, token])

  const accept = useCallback(() => {
    if (!active?.ta || active.ta.status !== 'pending') return
    setScore(String(active.ta.suggestedScore))
    setComment(active.ta.comment)
    void save({ score: active.ta.suggestedScore, comment: active.ta.comment })
  }, [active, save])

  const runTa = useCallback(async (row: QueueRow) => {
    if (!row.challengeId) return
    setTaRunning(prev => ({ ...prev, [row.id]: true }))
    setTaErrors(prev => { const next = { ...prev }; delete next[row.id]; return next })
    try {
      const ta = await requestTaGrade(fetch, await token(), row.id)
      updateRow(row.id, { ta })
      if (row.id === activeId && row.points === null) {
        setScore(String(ta.suggestedScore))
        setComment(ta.comment)
      }
    } catch (err) {
      setTaErrors(prev => ({ ...prev, [row.id]: err instanceof StudioError ? err.detail : String(err) }))
    } finally {
      setTaRunning(prev => ({ ...prev, [row.id]: false }))
    }
  }, [activeId, token, updateRow])

  const runAll = useCallback(async () => {
    const targets = ordered.filter(r => r.points === null && !r.ta && r.challengeId)
    if (targets.length === 0) return
    batchStop.current = false
    setBatch({ running: true, done: 0, total: targets.length })
    let done = 0
    for (const row of targets) {
      if (batchStop.current) break
      await runTa(row)
      done += 1
      setBatch({ running: true, done, total: targets.length })
    }
    setBatch({ running: false, done, total: targets.length })
    setMessage({ kind: 'ok', text: t('studio.runAllDone', { count: done }) })
  }, [ordered, runTa, t])

  const sendFlag = useCallback(async () => {
    if (!active?.ta?.id || !flagNote.trim()) return
    setBusy(true)
    try {
      await sendTaFeedback(fetch, await token(), {
        taGradeId: active.ta.id, action: 'flagged', score: active.ta.suggestedScore, comment: '', note: flagNote,
      })
      updateRow(active.id, { ta: { ...active.ta, status: 'accepted' } })
      setFlagOpen(false)
      setFlagNote('')
      setMessage({ kind: 'ok', text: t('studio.flagged') })
    } catch (err) {
      setMessage({ kind: 'error', text: t('studio.errFlag', { reason: err instanceof StudioError ? err.detail : String(err) }) })
    } finally {
      setBusy(false)
    }
  }, [active, flagNote, token, updateRow, t])

  // ── Keys ──────────────────────────────────────────────────────────────

  const actions = useRef({ moveBy, save, accept, runTa, active })
  actions.current = { moveBy, save, accept, runTa, active }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const field = fieldFrom(target?.id, target?.tagName, !!target?.isContentEditable)
      const action = interpretKey({ key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, field })
      if (!action) return
      const a = actions.current
      switch (action.type) {
        case 'blur': target?.blur(); break
        case 'next': a.moveBy(1); break
        case 'prev': a.moveBy(-1); break
        case 'skip': a.moveBy(1); break
        case 'save': void a.save(); break
        case 'accept': a.accept(); break
        case 'focusComment': commentRef.current?.focus(); break
        case 'flag': setFlagOpen(open => !open); break
        case 'runTa': if (a.active) void a.runTa(a.active); break
        case 'digit': {
          const now = Date.now()
          const append = now - lastDigitAt.current < DIGIT_WINDOW_MS
          lastDigitAt.current = now
          setScore(prev => (append ? prev + String(action.digit) : String(action.digit)))
          break
        }
        case 'backspace': setScore(''); break
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Formatting ────────────────────────────────────────────────────────

  const timeAgo = useCallback((iso: string) => {
    const { unit, count } = timeAgoParts(iso)
    if (unit === 'now') return t('studio.justNow')
    if (unit === 'm') return t('studio.minutesAgo', { count })
    if (unit === 'h') return t('studio.hoursAgo', { count })
    return t('studio.daysAgo', { count })
  }, [t])

  const formatDate = useCallback((iso: string) => {
    const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
    return Number.isNaN(date.getTime()) ? iso
      : date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }, [language])

  const runnable = ordered.filter(r => r.points === null && !r.ta && r.challengeId).length
  const activeProblem = active ? problems[problemKey(active)] ?? null : null

  return (
    <div className="studio-grid">
      <QueueRail
        groups={groups}
        shown={visible.length}
        pendingTotal={mode === 'pending' ? rows.length : rows.filter(r => r.points === null).length}
        mode={mode}
        onMode={m => { setMode(m); setActiveId(null) }}
        activeId={activeId}
        onSelect={setActiveId}
        classes={classes}
        filters={filters}
        onFilters={setFilters}
        timeAgo={timeAgo}
        batch={batch}
        runnable={runnable}
        onRunAll={() => void runAll()}
        onStopBatch={() => { batchStop.current = true }}
        onRefresh={() => void load()}
        loading={loading}
      />
      {loadError ? (
        <main className="studio-work"><p className="studio-error p-6">{loadError}</p></main>
      ) : (
        <WorkPane
          row={active}
          position={{ index, total: ordered.length }}
          problem={activeProblem}
          problemLoading={problemLoading && !activeProblem}
          comments={comments}
          timeAgo={timeAgo}
          formatDate={formatDate}
        />
      )}
      <DeskActions
        row={active}
        ta={active?.ta ?? null}
        score={score}
        onScore={setScore}
        comment={comment}
        onComment={setComment}
        busy={busy}
        onSave={() => void save()}
        onAccept={accept}
        onSkip={() => moveBy(1)}
        onRunTa={() => { if (active) void runTa(active) }}
        taRunning={!!(active && taRunning[active.id])}
        taError={active ? taErrors[active.id] ?? null : null}
        flagOpen={flagOpen}
        onFlagOpen={setFlagOpen}
        flagNote={flagNote}
        onFlagNote={setFlagNote}
        onFlagSend={() => void sendFlag()}
        message={message}
        scoreRef={scoreRef}
        commentRef={commentRef}
      />
    </div>
  )
}
