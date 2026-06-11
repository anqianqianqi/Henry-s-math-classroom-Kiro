'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import GradingInterface from '@/components/GradingInterface'
import { HomeButton } from '@/components/ui/HomeButton'

interface UngradedAssignment {
  assignment_id: string
  assignment_title: string
  points_possible: number
  due_date: string
  class_name: string
  class_id: string
  ungraded_count: number
  total_count: number
}

export default function GradingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<UngradedAssignment[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState<UngradedAssignment | null>(null)
  const [showAll, setShowAll] = useState(false)

  const loadUngraded = useCallback(async () => {
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

    // Load all assignments created by this teacher with submission counts
    const { data: assignmentsData } = await supabase
      .from('homework_assignments')
      .select(`
        id,
        title,
        points_possible,
        due_date,
        created_by,
        class_occurrences!inner(
          class_id,
          classes!inner(name)
        )
      `)
      .eq('created_by', user.id)
      .order('due_date', { ascending: false })

    if (!assignmentsData || assignmentsData.length === 0) {
      setAssignments([])
      setLoading(false)
      return
    }

    const assignmentIds = assignmentsData.map((a: any) => a.id)

    // Get all submissions for these assignments
    const { data: submissions } = await supabase
      .from('homework_submissions')
      .select('id, assignment_id, student_id')
      .in('assignment_id', assignmentIds)

    // Get all published grades for these submissions
    const submissionIds = (submissions || []).map((s: any) => s.id)
    const { data: grades } = submissionIds.length > 0
      ? await supabase
          .from('homework_grades')
          .select('submission_id, status')
          .in('submission_id', submissionIds)
          .eq('status', 'published')
      : { data: [] }

    const gradedSubmissionIds = new Set((grades || []).map((g: any) => g.submission_id))

    // Deduplicate submissions to latest version per student per assignment
    const latestByStudentAssignment = new Map<string, string>()
    for (const sub of (submissions || [])) {
      const key = `${sub.assignment_id}:${sub.student_id}`
      if (!latestByStudentAssignment.has(key)) {
        latestByStudentAssignment.set(key, sub.id)
      }
    }
    const latestIds = new Set(latestByStudentAssignment.values())

    // Build per-assignment counts
    const countMap: Record<string, { total: number; ungraded: number }> = {}
    for (const sub of (submissions || [])) {
      if (!latestIds.has(sub.id)) continue
      if (!countMap[sub.assignment_id]) countMap[sub.assignment_id] = { total: 0, ungraded: 0 }
      countMap[sub.assignment_id].total++
      if (!gradedSubmissionIds.has(sub.id)) countMap[sub.assignment_id].ungraded++
    }

    const result: UngradedAssignment[] = assignmentsData
      .map((a: any) => ({
        assignment_id: a.id,
        assignment_title: a.title,
        points_possible: a.points_possible,
        due_date: a.due_date,
        class_name: (a.class_occurrences as any)?.classes?.name ?? 'Unknown Class',
        class_id: (a.class_occurrences as any)?.class_id ?? '',
        ungraded_count: countMap[a.id]?.ungraded ?? 0,
        total_count: countMap[a.id]?.total ?? 0,
      }))
      // Show those with submissions first, sorted by most ungraded
      .sort((a, b) => b.ungraded_count - a.ungraded_count || b.total_count - a.total_count)

    setAssignments(result)
    setLoading(false)
  }, [router, supabase])

  useEffect(() => { loadUngraded() }, [loadUngraded])

  const displayed = showAll ? assignments : assignments.filter(a => a.total_count > 0)
  const totalUngraded = assignments.reduce((sum, a) => sum + a.ungraded_count, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <p className="text-gray-500">Loading submissions...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
                ← Back
              </Button>
              <HomeButton />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Grade Homework</h1>
                {totalUngraded > 0 && (
                  <p className="text-sm text-amber-600 font-medium">{totalUngraded} ungraded submission{totalUngraded !== 1 ? 's' : ''}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {selectedAssignment ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedAssignment(null); loadUngraded() }}>
                ← All Assignments
              </Button>
              <div>
                <p className="text-sm text-gray-500">{selectedAssignment.class_name}</p>
                <h2 className="font-semibold text-gray-900">{selectedAssignment.assignment_title}</h2>
              </div>
            </div>
            <GradingInterface
              assignmentId={selectedAssignment.assignment_id}
              assignmentTitle={selectedAssignment.assignment_title}
              pointsPossible={selectedAssignment.points_possible}
              onClose={() => { setSelectedAssignment(null); loadUngraded() }}
            />
          </div>
        ) : (
          <>
            {displayed.length === 0 ? (
              <Card>
                <Card.Body>
                  <div className="text-center py-16">
                    <div className="text-5xl mb-3">✅</div>
                    <p className="text-lg font-medium text-gray-700">All caught up!</p>
                    <p className="text-sm text-gray-500 mt-1">No submissions to grade right now.</p>
                  </div>
                </Card.Body>
              </Card>
            ) : (
              <div className="space-y-3">
                {displayed.map(a => {
                  const allGraded = a.ungraded_count === 0
                  return (
                    <Card key={a.assignment_id}>
                      <Card.Body>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{a.class_name}</p>
                            <h3 className="font-semibold text-gray-900 truncate">{a.assignment_title}</h3>
                            <p className="text-sm text-gray-500 mt-1">
                              Due {new Date(a.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              {' · '}{a.points_possible} pts
                            </p>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              {a.total_count === 0 ? (
                                <p className="text-sm text-gray-400">No submissions</p>
                              ) : (
                                <>
                                  <p className={`text-sm font-semibold ${allGraded ? 'text-green-600' : 'text-amber-600'}`}>
                                    {allGraded ? '✓ All graded' : `${a.ungraded_count} ungraded`}
                                  </p>
                                  <p className="text-xs text-gray-400">{a.total_count} submission{a.total_count !== 1 ? 's' : ''} total</p>
                                </>
                              )}
                            </div>
                            {a.total_count > 0 && (
                              <Button
                                size="sm"
                                variant={allGraded ? 'ghost' : undefined}
                                onClick={() => setSelectedAssignment(a)}
                              >
                                {allGraded ? 'Review' : 'Grade'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  )
                })}
              </div>
            )}

            <div className="flex justify-center">
              <button
                onClick={() => setShowAll(v => !v)}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showAll ? 'Show only assignments with submissions' : `Show all assignments (${assignments.length})`}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
