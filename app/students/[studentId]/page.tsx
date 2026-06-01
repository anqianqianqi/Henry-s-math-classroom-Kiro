'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface StudentProfile {
  id: string
  full_name: string
  first_name?: string | null
  last_name?: string | null
  nickname?: string | null
  email?: string
}

interface ChallengeSubmission {
  id: string
  content: string
  image_url?: string | null
  points?: number | null
  is_locked?: boolean
  submitted_at: string
  updated_at: string
  daily_challenges: {
    id: string
    title: string
    description: string
    challenge_date: string
    max_points?: number | null
  } | null
}

export default function StudentHistoryPage() {
  const router = useRouter()
  const params = useParams()
  const studentId = params.studentId as string
  const supabase = createClient()

  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [studentId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Verify teacher/admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_id, roles!inner(name)')
      .eq('user_id', user.id)
      .is('class_id', null)

    const isTeacher = (roles || []).some((r: any) =>
      r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
    )
    if (!isTeacher) { router.push('/dashboard'); return }

    // Load student profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name, nickname, email')
      .eq('id', studentId)
      .single()

    if (profileError || !profile) {
      setError('Student not found')
      setLoading(false)
      return
    }
    setStudent(profile)

    // Load all challenge submissions for this student
    const { data: subs, error: subsError } = await supabase
      .from('challenge_submissions')
      .select(`
        id, content, image_url, points, is_locked, submitted_at, updated_at,
        daily_challenges:challenge_id(id, title, description, challenge_date, max_points)
      `)
      .eq('user_id', studentId)
      .order('submitted_at', { ascending: false })

    if (subsError) {
      setError('Failed to load submissions')
      setLoading(false)
      return
    }

    setSubmissions((subs || []) as unknown as ChallengeSubmission[])
    setLoading(false)
  }

  const studentName = student
    ? ([student.first_name, student.last_name].filter(Boolean).join(' ') || student.full_name || student.nickname || 'Student')
    : 'Student'

  const totalSubmissions = submissions.length
  const gradedSubmissions = submissions.filter(s => s.points != null)
  const avgScore = gradedSubmissions.length > 0
    ? Math.round(gradedSubmissions.reduce((sum, s) => sum + (s.points ?? 0), 0) / gradedSubmissions.length)
    : null

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-gray-600">Loading history...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Button onClick={() => router.back()} className="mt-4">← Go Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                {studentName}'s Challenge History
              </h1>
              {student?.email && (
                <p className="text-sm text-gray-500">{student.email}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="text-center p-4">
            <div className="text-3xl font-bold text-primary-600">{totalSubmissions}</div>
            <div className="text-sm text-gray-500 mt-1">Challenges Submitted</div>
          </Card>
          <Card className="text-center p-4">
            <div className="text-3xl font-bold text-green-600">{gradedSubmissions.length}</div>
            <div className="text-sm text-gray-500 mt-1">Graded</div>
          </Card>
          <Card className="text-center p-4">
            <div className="text-3xl font-bold text-blue-600">
              {avgScore != null ? avgScore : '—'}
            </div>
            <div className="text-sm text-gray-500 mt-1">Avg Score</div>
          </Card>
        </div>

        {/* Submission list */}
        {submissions.length === 0 ? (
          <Card className="text-center py-16">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-gray-700">No submissions yet</h3>
            <p className="text-gray-500 mt-2">This student hasn't submitted any challenges.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {submissions.map(sub => {
              const challenge = sub.daily_challenges
              const isExpanded = expandedId === sub.id
              const maxPts = challenge?.max_points ?? 100
              const scored = sub.points != null

              return (
                <Card key={sub.id} className="overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {challenge?.title ?? 'Unknown Challenge'}
                          </h3>
                          {sub.is_locked && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">🔒 Locked</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          {challenge?.challenge_date && (
                            <span>📅 {new Date(challenge.challenge_date).toLocaleDateString()}</span>
                          )}
                          <span>Submitted {new Date(sub.submitted_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Score badge */}
                      <div className="flex-shrink-0 text-right">
                        {scored ? (
                          <div className={`text-lg font-bold ${sub.points! >= maxPts * 0.7 ? 'text-green-600' : sub.points! >= maxPts * 0.4 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {sub.points}/{maxPts}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400 font-medium">Not graded</div>
                        )}
                        <div className="text-xs text-gray-400 mt-0.5">
                          {isExpanded ? '▲ collapse' : '▼ expand'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                      {/* Challenge description */}
                      {challenge?.description && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Challenge</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{challenge.description}</p>
                        </div>
                      )}

                      {/* Student answer */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Student's Answer</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap bg-white rounded-lg p-3 border border-gray-200">
                          {sub.content}
                        </p>
                      </div>

                      {/* Submission image */}
                      {sub.image_url && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Attached Image</p>
                          <img
                            src={sub.image_url}
                            alt="Submission"
                            className="max-w-sm rounded-lg border border-gray-200"
                          />
                        </div>
                      )}

                      {/* View full challenge link */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/challenges/${challenge?.id}`)}
                        >
                          View Full Challenge →
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
