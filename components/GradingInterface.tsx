'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface GradingInterfaceProps {
  assignmentId: string
  assignmentTitle: string
  pointsPossible: number
  onClose?: () => void
}

interface SubmissionComment {
  id: string
  submission_id: string
  user_id: string
  content: string
  created_at: string
  profiles: {
    full_name: string
  }
}

interface Submission {
  id: string
  student_id: string
  submission_type: 'file' | 'text' | 'link'
  file_url?: string
  text_content?: string
  link_url?: string
  comments?: string
  submitted_at: string
  is_late: boolean
  version: number
  profiles: {
    full_name: string
    email: string
  }
  homework_grades?: {
    id: string
    points_earned: number
    feedback: string
    status: 'draft' | 'published'
    graded_at: string
  }[]
}

type FilterStatus = 'all' | 'submitted' | 'graded' | 'late'
type SortBy = 'name' | 'date' | 'status'

export default function GradingInterface({
  assignmentId,
  assignmentTitle,
  pointsPossible,
  onClose
}: GradingInterfaceProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([])
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null)
  const [editingGrade, setEditingGrade] = useState<string | null>(null)
  const [gradeData, setGradeData] = useState<Record<string, { points: number; feedback: string }>>({})
  const [submissionComments, setSubmissionComments] = useState<Record<string, SubmissionComment[]>>({})
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({})
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadSubmissions()
  }, [assignmentId])

  useEffect(() => {
    filterAndSortSubmissions()
  }, [submissions, filterStatus, sortBy])

  async function loadSubmissions() {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('homework_submissions')
        .select(`
          *,
          profiles:student_id(full_name, email)
        `)
        .eq('assignment_id', assignmentId)
        .order('version', { ascending: false })
        .order('submitted_at', { ascending: false })

      if (fetchError) throw fetchError

      console.log('🔍 Raw submissions from database:', data)

      // Get latest version for each student
      const latestSubmissions = data?.reduce((acc: Submission[], sub) => {
        const existing = acc.find((s: Submission) => s.student_id === sub.student_id)
        if (!existing || sub.version > existing.version) {
          return [...acc.filter((s: Submission) => s.student_id !== sub.student_id), sub]
        }
        return acc
      }, [] as Submission[]) || []

      console.log('📋 Latest submissions (one per student):', latestSubmissions)

      // Load grades separately to avoid RLS issues with nested queries
      if (latestSubmissions.length > 0) {
        const submissionIds = latestSubmissions.map(s => s.id)
        const { data: gradesData, error: gradesError } = await supabase
          .from('homework_grades')
          .select('*')
          .in('submission_id', submissionIds)

        if (gradesError) {
          console.error('Error loading grades:', gradesError)
        } else {
          console.log('📊 Loaded grades:', gradesData)
          
          // Attach grades to submissions
          const submissionsWithGrades = latestSubmissions.map(sub => ({
            ...sub,
            homework_grades: gradesData?.filter(g => g.submission_id === sub.id) || []
          }))

          console.log('✅ Final submissions with grades:', submissionsWithGrades)
          submissionsWithGrades.forEach((sub, idx) => {
            const grade = sub.homework_grades?.[0]
            console.log(`  Submission ${idx + 1} (${sub.profiles.full_name}):`, {
              id: sub.id,
              hasGrade: !!grade,
              gradeStatus: grade?.status,
              points: grade?.points_earned,
              feedback: grade?.feedback
            })
          })

          setSubmissions(submissionsWithGrades)
        }
      } else {
        setSubmissions([])
      }
      
      // Load comments for all submissions
      if (latestSubmissions.length > 0) {
        await loadCommentsForSubmissions(latestSubmissions.map((s: Submission) => s.id))
      }
    } catch (err) {
      console.error('Failed to load submissions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }

  async function loadCommentsForSubmissions(submissionIds: string[]) {
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('homework_submission_comments')
        .select(`
          *,
          profiles!inner(full_name)
        `)
        .in('submission_id', submissionIds)
        .order('created_at', { ascending: true })

      if (commentsError) {
        console.error('Failed to load comments:', commentsError)
        return
      }

      if (commentsData) {
        const commentsBySubmission: Record<string, SubmissionComment[]> = {}
        commentsData.forEach((comment: SubmissionComment) => {
          if (!commentsBySubmission[comment.submission_id]) {
            commentsBySubmission[comment.submission_id] = []
          }
          commentsBySubmission[comment.submission_id].push(comment)
        })
        setSubmissionComments(commentsBySubmission)
      }
    } catch (err) {
      console.error('Error loading comments:', err)
    }
  }

  async function handleSubmitComment(submissionId: string) {
    const commentText = newCommentText[submissionId]?.trim()
    if (!commentText) return

    setSubmittingComment({ ...submittingComment, [submissionId]: true })

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error: insertError } = await supabase
        .from('homework_submission_comments')
        .insert({
          submission_id: submissionId,
          user_id: user.id,
          content: commentText
        })
        .select(`
          *,
          profiles!inner(full_name)
        `)
        .single()

      if (insertError) throw insertError

      if (data) {
        // Add comment to state
        setSubmissionComments(prev => ({
          ...prev,
          [submissionId]: [...(prev[submissionId] || []), data]
        }))
        // Clear input
        setNewCommentText(prev => ({ ...prev, [submissionId]: '' }))
      }
    } catch (err) {
      console.error('Failed to submit comment:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit comment')
    } finally {
      setSubmittingComment({ ...submittingComment, [submissionId]: false })
    }
  }

  function filterAndSortSubmissions() {
    let filtered = [...submissions]

    // Apply filter
    if (filterStatus === 'submitted') {
      filtered = filtered.filter(s => !s.homework_grades || s.homework_grades.length === 0)
    } else if (filterStatus === 'graded') {
      filtered = filtered.filter(s => s.homework_grades && s.homework_grades.length > 0)
    } else if (filterStatus === 'late') {
      filtered = filtered.filter(s => s.is_late)
    }

    // Apply sort
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.profiles.full_name.localeCompare(b.profiles.full_name)
      } else if (sortBy === 'date') {
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      } else { // status
        const aGraded = a.homework_grades && a.homework_grades.length > 0
        const bGraded = b.homework_grades && b.homework_grades.length > 0
        return aGraded === bGraded ? 0 : aGraded ? 1 : -1
      }
    })

    setFilteredSubmissions(filtered)
  }

  async function handleGrade(submissionId: string, isDraft: boolean) {
    const data = gradeData[submissionId]
    if (!data || data.points < 0 || data.points > pointsPossible) {
      setError(`Points must be between 0 and ${pointsPossible}`)
      return
    }

    try {
      setSaving(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const gradeRecord = {
        submission_id: submissionId,
        graded_by: user.id,
        points_earned: data.points,
        feedback: data.feedback || null,
        status: isDraft ? 'draft' : 'published',
        published_at: isDraft ? null : new Date().toISOString()
      }

      // Use upsert to insert or update grade (overwrites if exists)
      const { error: upsertError } = await supabase
        .from('homework_grades')
        .upsert(gradeRecord, {
          onConflict: 'submission_id'
        })

      if (upsertError) throw upsertError

      // Reload submissions
      await loadSubmissions()
      
      // Don't clear grade data or close submission - keep it visible
      // User can see what they just graded

    } catch (err) {
      console.error('Failed to save grade:', err)
      setError(err instanceof Error ? err.message : 'Failed to save grade')
    } finally {
      setSaving(false)
    }
  }

  function getSubmissionContent(submission: Submission) {
    if (submission.submission_type === 'file' && submission.file_url) {
      return (
        <a
          href={submission.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          📎 View File
        </a>
      )
    } else if (submission.submission_type === 'text' && submission.text_content) {
      return (
        <div className="text-sm text-gray-700 max-h-20 overflow-y-auto">
          {submission.text_content.substring(0, 200)}
          {submission.text_content.length > 200 && '...'}
        </div>
      )
    } else if (submission.submission_type === 'link' && submission.link_url) {
      return (
        <a
          href={submission.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          🔗 {submission.link_url}
        </a>
      )
    }
    return <span className="text-gray-400">No content</span>
  }

  if (loading) {
    return (
      <Card>
        <Card.Body>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </Card.Body>
      </Card>
    )
  }

  return (
    <Card>
      <Card.Header>
        <div className="flex justify-between items-center">
          <div>
            <Card.Title>Grade Submissions</Card.Title>
            <p className="text-sm text-gray-600 mt-1">{assignmentTitle}</p>
          </div>
          {onClose && (
            <Button onClick={onClose} variant="ghost" size="sm">
              ✕
            </Button>
          )}
        </div>
      </Card.Header>
      <Card.Body>
        <div className="space-y-4">
          {/* Filters and Sort */}
          <div className="flex gap-4 items-center">
            <div>
              <label className="text-sm text-gray-600 mr-2">Filter:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All ({submissions.length})</option>
                <option value="submitted">Not Graded</option>
                <option value="graded">Graded</option>
                <option value="late">Late</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 mr-2">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="name">Student Name</option>
                <option value="date">Submission Date</option>
                <option value="status">Grading Status</option>
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">⚠️ {error}</p>
            </div>
          )}

          {/* Submissions Table */}
          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-2">📝</div>
              <p className="text-gray-500">No submissions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map((submission) => {
                const grade = submission.homework_grades?.[0]
                const isExpanded = selectedSubmission === submission.id
                
                // Always use grade data if it exists, otherwise use gradeData state
                const currentGrade = grade ? {
                  points: grade.points_earned,
                  feedback: grade.feedback || ''
                } : (gradeData[submission.id] || {
                  points: 0,
                  feedback: ''
                })

                return (
                  <div
                    key={submission.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Submission Header */}
                    <div
                      className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                      onClick={() => {
                        const newExpanded = isExpanded ? null : submission.id
                        setSelectedSubmission(newExpanded)
                        
                        // Initialize grade data when expanding if not already set
                        if (newExpanded && !gradeData[submission.id] && grade) {
                          setGradeData({
                            ...gradeData,
                            [submission.id]: {
                              points: grade.points_earned,
                              feedback: grade.feedback || ''
                            }
                          })
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium text-gray-900">
                              {submission.profiles.full_name}
                            </h4>
                            {submission.is_late && (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                Late
                              </span>
                            )}
                            {grade && (
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                grade.status === 'published'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {grade.status === 'published' ? '✓ Graded' : 'Draft'}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Submitted {new Date(submission.submitted_at).toLocaleString()}
                            {submission.version > 1 && ` • Version ${submission.version}`}
                          </p>
                        </div>
                        <div className="text-right">
                          {grade && (
                            <div className="text-lg font-semibold text-gray-900">
                              {grade.points_earned}/{pointsPossible}
                            </div>
                          )}
                          <div className="text-gray-400 text-sm">
                            {isExpanded ? '▼' : '▶'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="p-4 border-t border-gray-200 space-y-4">
                        {/* Submission Content */}
                        <div>
                          <label className="text-sm font-medium text-gray-700 block mb-1">
                            Submission:
                          </label>
                          {getSubmissionContent(submission)}
                          {submission.comments && submission.comments.trim() && (
                            <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                              <span className="text-xs font-semibold text-blue-700 block mb-1">
                                💬 Student Comments:
                              </span>
                              <p className="text-sm text-blue-900 whitespace-pre-wrap">
                                {submission.comments}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Grading Form */}
                        <div className="space-y-3 pt-3 border-t border-gray-200">
                          {grade && editingGrade !== submission.id ? (
                            /* Read-only view for existing grades */
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-gray-700">Current Grade</h4>
                                <Button
                                  onClick={() => {
                                    setEditingGrade(submission.id)
                                    setGradeData({
                                      ...gradeData,
                                      [submission.id]: {
                                        points: grade.points_earned,
                                        feedback: grade.feedback || ''
                                      }
                                    })
                                  }}
                                  variant="secondary"
                                  size="sm"
                                >
                                  Edit Grade
                                </Button>
                              </div>
                              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                                <div>
                                  <span className="text-sm text-gray-600">Points:</span>{' '}
                                  <span className="text-lg font-semibold text-gray-900">
                                    {grade.points_earned}/{pointsPossible}
                                  </span>
                                </div>
                                {grade.feedback && (
                                  <div>
                                    <span className="text-sm text-gray-600 block mb-1">Feedback:</span>
                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                                      {grade.feedback}
                                    </p>
                                  </div>
                                )}
                                <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                                  Status: {grade.status === 'published' ? 'Published' : 'Draft'} • 
                                  Graded {new Date(grade.graded_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* Edit mode for new or editing grades */
                            <div className="space-y-3">
                              {editingGrade === submission.id && (
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-medium text-gray-700">Edit Grade</h4>
                                  <Button
                                    onClick={() => setEditingGrade(null)}
                                    variant="ghost"
                                    size="sm"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              )}
                              <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1">
                                  Points Earned (out of {pointsPossible})
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={pointsPossible}
                                  value={currentGrade.points}
                                  onChange={(e) => setGradeData({
                                    ...gradeData,
                                    [submission.id]: {
                                      ...currentGrade,
                                      points: parseInt(e.target.value) || 0
                                    }
                                  })}
                                  disabled={saving}
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1">
                                  Feedback
                                </label>
                                <textarea
                                  value={currentGrade.feedback}
                                  onChange={(e) => setGradeData({
                                    ...gradeData,
                                    [submission.id]: {
                                      ...currentGrade,
                                      feedback: e.target.value
                                    }
                                  })}
                                  placeholder="Provide feedback to the student..."
                                  rows={3}
                                  disabled={saving}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    handleGrade(submission.id, false)
                                    setEditingGrade(null)
                                  }}
                                  disabled={saving}
                                  size="sm"
                                >
                                  {saving ? 'Saving...' : 'Publish Grade'}
                                </Button>
                                <Button
                                  onClick={() => {
                                    handleGrade(submission.id, true)
                                    setEditingGrade(null)
                                  }}
                                  disabled={saving}
                                  variant="secondary"
                                  size="sm"
                                >
                                  Save as Draft
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Comments Section */}
                        <div className="space-y-3 pt-3 border-t border-gray-200">
                          <h4 className="text-sm font-medium text-gray-700">Comments</h4>
                          
                          {/* Display existing comments */}
                          {submissionComments[submission.id] && submissionComments[submission.id].length > 0 && (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {submissionComments[submission.id].map((comment) => (
                                <div key={comment.id} className="p-3 bg-gray-50 rounded border border-gray-200">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className="text-xs font-semibold text-gray-700">
                                        {comment.profiles.full_name}
                                      </p>
                                      <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">
                                        {comment.content}
                                      </p>
                                    </div>
                                    <span className="text-xs text-gray-500 ml-2">
                                      {new Date(comment.created_at).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add new comment */}
                          <div className="space-y-2">
                            <textarea
                              value={newCommentText[submission.id] || ''}
                              onChange={(e) => setNewCommentText({
                                ...newCommentText,
                                [submission.id]: e.target.value
                              })}
                              placeholder="Add a comment..."
                              rows={2}
                              disabled={submittingComment[submission.id]}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <Button
                              onClick={() => handleSubmitComment(submission.id)}
                              disabled={submittingComment[submission.id] || !newCommentText[submission.id]?.trim()}
                              size="sm"
                              variant="secondary"
                            >
                              {submittingComment[submission.id] ? 'Posting...' : 'Post Comment'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  )
}
