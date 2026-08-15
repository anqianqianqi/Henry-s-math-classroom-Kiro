'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HomeButton } from '@/components/ui/HomeButton'
import { SubmissionSpread, type SpreadChallenge } from '@/components/grading/SubmissionSpread'

interface Submission {
  id: string
  user_id: string
  challenge_id: string
  answer: string | null   // maps to challenge_submissions.content
  points: number | null
  submitted_at: string
  updated_at: string
  student_name: string
  student_email: string
  challenge_title: string
  challenge_date: string
  max_points: number | null
}

type Tab = 'ungraded' | 'history'

export default function GradingPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [ungraded, setUngraded] = useState<Submission[]>([])
  const [graded, setGraded] = useState<Submission[]>([])
  const [tab, setTab] = useState<Tab>('ungraded')
  const [grading, setGrading] = useState<Record<string, { points: string; saving: boolean }>>({})
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  /*
    ── The open spread ─────────────────────────────────────────
    Which problem is open, and which student was clicked to open it. The
    submissions themselves are not stored: they are derived from the lists
    already in state, so grading one and reloading updates the spread without
    it having to refetch or close.
  */
  const [spread, setSpread] = useState<{ challengeId: string; focusId: string } | null>(null)
  const [spreadChallenge, setSpreadChallenge] = useState<SpreadChallenge | null>(null)
  const [spreadLoading, setSpreadLoading] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Verify teacher role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', user.id)
      .is('class_id', null)

    const isTeacher = (roles as any[])?.some((r: any) =>
      r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
    )
    if (!isTeacher) { router.push('/dashboard'); return }

    // Load all challenge submissions with student + challenge info
    const { data, error: fetchErr } = await supabase
      .from('challenge_submissions')
      .select(`
        id,
        user_id,
        challenge_id,
        content,
        points,
        submitted_at,
        updated_at,
        profiles:user_id(full_name, first_name, last_name, email),
        daily_challenges:challenge_id(title, challenge_date, max_points)
      `)
      .order('submitted_at', { ascending: false })

    if (fetchErr) {
      setError(t('grade.errLoad'))
      setLoading(false)
      return
    }

    const all: Submission[] = (data || []).map((s: any) => ({
      id: s.id,
      user_id: s.user_id,
      challenge_id: s.challenge_id,
      answer: s.content,
      points: s.points,
      submitted_at: s.submitted_at,
      updated_at: s.updated_at,
      student_name: s.profiles?.full_name
        || [s.profiles?.first_name, s.profiles?.last_name].filter(Boolean).join(' ')
        || 'Unknown',
      student_email: s.profiles?.email || '',
      challenge_title: s.daily_challenges?.title || 'Unknown Challenge',
      challenge_date: s.daily_challenges?.challenge_date || '',
      max_points: s.daily_challenges?.max_points ?? null,
    }))

    setUngraded(all.filter(s => s.points === null))
    setGraded(all.filter(s => s.points !== null))
    setLoading(false)
  }, [router, supabase])

  useEffect(() => { load() }, [load])

  /**
   * Open the spread on a submission's problem.
   *
   * The problem text is fetched here rather than with the list: the list query
   * pulls only a title and a date for every submission on the site, and the
   * wording is needed for exactly one challenge at a time.
   */
  async function openSpread(s: Submission) {
    setSpread({ challengeId: s.challenge_id, focusId: s.id })
    setSpreadChallenge(null)
    setSpreadLoading(true)

    const { data } = await supabase
      .from('daily_challenges')
      .select('id, title, challenge_date, description, henryproblem')
      .eq('id', s.challenge_id)
      .single()

    setSpreadChallenge((data as SpreadChallenge) ?? null)
    setSpreadLoading(false)
  }

  /*
    Every answer to the open problem, graded or not, in a stable order.

    Sorted by name rather than by grading state on purpose: ordering by
    "still needs a mark" would make a row jump to the bottom the moment it is
    graded, and the teacher loses their place mid-list.
  */
  const spreadSubmissions = useMemo(() => {
    if (!spread) return []
    return [...ungraded, ...graded]
      .filter(s => s.challenge_id === spread.challengeId)
      .sort((a, b) => a.student_name.localeCompare(b.student_name))
  }, [spread, ungraded, graded])

  // Apply date filter client-side
  function applyDateFilter(list: Submission[]) {
    return list.filter(s => {
      const d = s.submitted_at.slice(0, 10)
      if (dateFrom && d < dateFrom) return false
      if (dateTo && d > dateTo) return false
      return true
    })
  }

  async function handleMarkReviewed(submissionId: string) {
    const { error: updateErr } = await supabase
      .from('challenge_submissions')
      .update({ points: 0 })
      .eq('id', submissionId)

    if (updateErr) { setError(t('grade.errReview')); return }
    await load()
  }

  async function handleGrade(submissionId: string, maxPts: number | null) {
    const entry = grading[submissionId]
    if (!entry) return
    const pts = parseFloat(entry.points)
    if (isNaN(pts) || pts < 0) { setError(t('grade.errInvalidPoints')); return }
    if (maxPts !== null && pts > maxPts) { setError(t('grade.errMaxPoints', { max: maxPts })); return }

    setGrading(g => ({ ...g, [submissionId]: { ...g[submissionId], saving: true } }))
    setError(null)

    const { error: updateErr } = await supabase
      .from('challenge_submissions')
      .update({ points: pts })
      .eq('id', submissionId)

    if (updateErr) {
      setError(t('grade.errSave'))
      setGrading(g => ({ ...g, [submissionId]: { ...g[submissionId], saving: false } }))
      return
    }

    // Remove from grading state and reload
    setGrading(g => { const n = { ...g }; delete n[submissionId]; return n })
    await load()
  }

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <p className="text-gray-500">{t('grade.loadingSubmissions')}</p>
      </div>
    )
  }

  const currentList = applyDateFilter(tab === 'ungraded' ? ungraded : graded)

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              {t('action.back')}
            </Button>
            <HomeButton />
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">{t('grade.pageTitle')}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        {/* Date filter */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-600">{t('grade.filterByDate')}</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
            <span className="text-gray-400 text-sm">{t('grade.dateTo')}</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              {t('grade.clear')}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          <button
            onClick={() => setTab('ungraded')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'ungraded'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('grade.needsGrading')}
            {ungraded.length > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {ungraded.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'history'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('grade.history', { count: graded.length })}
          </button>
        </div>

        {currentList.length === 0 ? (
          <Card>
            <Card.Body>
              <div className="text-center py-16">
                <p className="text-lg font-medium text-gray-600">
                  {tab === 'ungraded' ? t('grade.allCaughtUp') : t('grade.noneGradedYet')}
                </p>
              </div>
            </Card.Body>
          </Card>
        ) : (
          <div className="space-y-3">
            {currentList.map(s => {
              const g = grading[s.id]
              const isEditing = !!g

              return (
                <Card
                  key={s.id}
                  onClick={() => openSpread(s)}
                  title={t('grade.openSpread')}
                  className="cursor-pointer"
                >
                  <Card.Body>
                    <div className="space-y-3">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">{s.student_name}</span>
                            {s.student_email && (
                              <span className="text-xs text-gray-400">{s.student_email}</span>
                            )}
                          </div>
                          {/* Opens the spread in place. It used to push to
                              /challenges/{id}, which is the trip this whole
                              feature exists to stop making. */}
                          <button
                            onClick={event => { event.stopPropagation(); openSpread(s) }}
                            className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline mt-0.5 text-left"
                          >
                            {s.challenge_title} →
                          </button>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {t('grade.challengeDate', { date: formatDate(s.challenge_date) })}
                            {' · '}{t('grade.submittedOn', { date: formatDate(s.submitted_at) })}
                            {s.max_points !== null && ` · ${t('grade.maxPts', { points: s.max_points })}`}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          {tab === 'history' && s.points !== null && (
                            <div className="text-lg font-bold text-primary-600">
                              {t('grade.scoreOf', { points: s.points ?? 0, max: s.max_points ?? '—' })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Answer */}
                      {s.answer && (
                        <div className="bg-gray-50 rounded-lg px-4 py-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{t('grade.answer')}</p>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{s.answer}</p>
                        </div>
                      )}

                      {/* Grading row */}
                      {tab === 'ungraded' && (
                        <div className="flex items-center gap-3 pt-1" onClick={event => event.stopPropagation()}>
                          {isEditing ? (
                            <>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={s.max_points ?? undefined}
                                  step={1}
                                  value={g.points}
                                  onChange={e => setGrading(prev => ({
                                    ...prev,
                                    [s.id]: { ...prev[s.id], points: e.target.value }
                                  }))}
                                  className="w-24 px-3 py-1.5 border-2 border-primary-300 rounded-lg text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                                  placeholder="pts"
                                  autoFocus
                                />
                                {s.max_points !== null && (
                                  <span className="text-sm text-gray-400">/ {s.max_points}</span>
                                )}
                              </div>
                              <Button
                                size="sm"
                                disabled={g.saving || !g.points}
                                onClick={() => handleGrade(s.id, s.max_points)}
                              >
                                {g.saving ? t('status.saving') : t('action.save')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={g.saving}
                                onClick={() => setGrading(prev => { const n = { ...prev }; delete n[s.id]; return n })}
                              >
                                {t('action.cancel')}
                              </Button>
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => setGrading(prev => ({
                                  ...prev,
                                  [s.id]: { points: '', saving: false }
                                }))}
                              >
                                {t('grade.grade')}
                              </Button>
                              <button
                                onClick={() => handleMarkReviewed(s.id)}
                                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                title={t('grade.markReviewedHint')}
                              >
                                {t('grade.markReviewed')}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* History: edit button */}
                      {tab === 'history' && (
                        <div className="flex items-center gap-3 pt-1" onClick={event => event.stopPropagation()}>
                          {isEditing ? (
                            <>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={s.max_points ?? undefined}
                                  step={1}
                                  value={g.points}
                                  onChange={e => setGrading(prev => ({
                                    ...prev,
                                    [s.id]: { ...prev[s.id], points: e.target.value }
                                  }))}
                                  className="w-24 px-3 py-1.5 border-2 border-primary-300 rounded-lg text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                                  placeholder="pts"
                                  autoFocus
                                />
                                {s.max_points !== null && (
                                  <span className="text-sm text-gray-400">/ {s.max_points}</span>
                                )}
                              </div>
                              <Button
                                size="sm"
                                disabled={g.saving || !g.points}
                                onClick={() => handleGrade(s.id, s.max_points)}
                              >
                                {g.saving ? t('status.saving') : t('grade.update')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={g.saving}
                                onClick={() => setGrading(prev => { const n = { ...prev }; delete n[s.id]; return n })}
                              >
                                {t('action.cancel')}
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setGrading(prev => ({
                                ...prev,
                                [s.id]: { points: String(s.points ?? ''), saving: false }
                              }))}
                            >
                              {t('grade.editGrade')}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      {/*
        The spread reads the same draft state and the same save handler as the
        list, so a mark typed in either place behaves identically and there is
        one code path that writes to challenge_submissions.
      */}
      {spread && (
        <SubmissionSpread
          challenge={spreadChallenge}
          submissions={spreadSubmissions}
          focusId={spread.focusId}
          drafts={grading}
          loading={spreadLoading}
          formatDate={formatDate}
          onClose={() => { setSpread(null); setSpreadChallenge(null) }}
          onDraftChange={(id, points) =>
            setGrading(prev => ({ ...prev, [id]: { points, saving: prev[id]?.saving ?? false } }))
          }
          onSave={handleGrade}
        />
      )}
    </div>
  )
}
