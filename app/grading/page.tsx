'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HomeButton } from '@/components/ui/HomeButton'

interface Submission {
  id: string
  user_id: string
  challenge_id: string
  answer: string | null
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
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [ungraded, setUngraded] = useState<Submission[]>([])
  const [graded, setGraded] = useState<Submission[]>([])
  const [tab, setTab] = useState<Tab>('ungraded')
  const [grading, setGrading] = useState<Record<string, { points: string; saving: boolean }>>({})
  const [error, setError] = useState<string | null>(null)

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
        answer,
        points,
        submitted_at,
        updated_at,
        profiles:user_id(full_name, first_name, last_name, email),
        daily_challenges:challenge_id(title, challenge_date, max_points)
      `)
      .order('submitted_at', { ascending: false })

    if (fetchErr) {
      setError('Failed to load submissions')
      setLoading(false)
      return
    }

    const all: Submission[] = (data || []).map((s: any) => ({
      id: s.id,
      user_id: s.user_id,
      challenge_id: s.challenge_id,
      answer: s.answer,
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

  async function handleGrade(submissionId: string, maxPts: number | null) {
    const entry = grading[submissionId]
    if (!entry) return
    const pts = parseFloat(entry.points)
    if (isNaN(pts) || pts < 0) { setError('Enter a valid point value'); return }
    if (maxPts !== null && pts > maxPts) { setError(`Max points is ${maxPts}`); return }

    setGrading(g => ({ ...g, [submissionId]: { ...g[submissionId], saving: true } }))
    setError(null)

    const { error: updateErr } = await supabase
      .from('challenge_submissions')
      .update({ points: pts })
      .eq('id', submissionId)

    if (updateErr) {
      setError('Failed to save grade')
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
        <p className="text-gray-500">Loading submissions...</p>
      </div>
    )
  }

  const currentList = tab === 'ungraded' ? ungraded : graded

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              ← Back
            </Button>
            <HomeButton />
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Grade Submissions</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

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
            Needs Grading
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
            Grade History ({graded.length})
          </button>
        </div>

        {currentList.length === 0 ? (
          <Card>
            <Card.Body>
              <div className="text-center py-16">
                <p className="text-lg font-medium text-gray-600">
                  {tab === 'ungraded' ? 'No ungraded submissions — all caught up!' : 'No graded submissions yet.'}
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
                <Card key={s.id}>
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
                          <p className="text-sm font-medium text-gray-700 mt-0.5">{s.challenge_title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Challenge date: {formatDate(s.challenge_date)}
                            {' · '}Submitted: {formatDate(s.submitted_at)}
                            {s.max_points !== null && ` · Max: ${s.max_points} pts`}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          {tab === 'history' && s.points !== null && (
                            <div className="text-lg font-bold text-primary-600">
                              {s.points}{s.max_points !== null ? `/${s.max_points}` : ''} pts
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Answer */}
                      {s.answer && (
                        <div className="bg-gray-50 rounded-lg px-4 py-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Answer</p>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{s.answer}</p>
                        </div>
                      )}

                      {/* Grading row */}
                      {tab === 'ungraded' && (
                        <div className="flex items-center gap-3 pt-1">
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
                                {g.saving ? 'Saving…' : 'Save'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={g.saving}
                                onClick={() => setGrading(prev => { const n = { ...prev }; delete n[s.id]; return n })}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => setGrading(prev => ({
                                ...prev,
                                [s.id]: { points: '', saving: false }
                              }))}
                            >
                              Grade
                            </Button>
                          )}
                        </div>
                      )}

                      {/* History: edit button */}
                      {tab === 'history' && (
                        <div className="flex items-center gap-3 pt-1">
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
                                {g.saving ? 'Saving…' : 'Update'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={g.saving}
                                onClick={() => setGrading(prev => { const n = { ...prev }; delete n[s.id]; return n })}
                              >
                                Cancel
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
                              Edit Grade
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
    </div>
  )
}
