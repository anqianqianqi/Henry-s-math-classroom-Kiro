'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatOccurrenceDisplay } from '@/lib/utils/occurrences'
import MaterialUpload from '@/components/MaterialUpload'
import HomeworkForm from '@/components/HomeworkForm'
import GradingInterface from '@/components/GradingInterface'
import SubmissionForm from '@/components/SubmissionForm'

interface Occurrence {
  id: string
  class_id: string
  occurrence_date: string
  start_time: string
  end_time: string
  session_number: number
  topic: string | null
  status: 'upcoming' | 'completed' | 'cancelled'
  notes: string | null
}

interface Material {
  id: string
  occurrence_id: string
  title: string
  description: string | null
  file_url: string
  file_type: string
  file_size: number
  material_type: 'document' | 'link' | 'note' | 'recording'
  uploaded_at: string
  profiles: {
    full_name: string
    nickname: string | null
  }
}

interface HomeworkAssignment {
  id: string
  title: string
  description: string
  due_date: string
  points_possible: number
  submission_type: 'file' | 'text' | 'link'
  allow_late: boolean
}

interface StudentSubmission {
  id: string
  assignment_id: string
  student_id: string
  submission_type: 'file' | 'text' | 'link'
  file_url: string | null
  text_content: string | null
  link_url: string | null
  comments: string | null
  is_late: boolean
  version: number
  submitted_at: string
  homework_grades?: Array<{
    id: string
    points_earned: number
    feedback: string | null
    status: 'draft' | 'published'
    published_at: string | null
  }>
}

interface SubmissionComment {
  id: string
  submission_id: string
  user_id: string
  content: string
  created_at: string
  profiles: {
    full_name: string
    nickname: string | null
  }
}

interface SessionDetailProps {
  occurrenceId: string
  userRole: 'teacher' | 'student' | 'observer'
  onClose?: () => void
}

export default function SessionDetail({ occurrenceId, userRole, onClose }: SessionDetailProps) {
  const [occurrence, setOccurrence] = useState<Occurrence | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [homework, setHomework] = useState<HomeworkAssignment | null>(null)
  const [mySubmissions, setMySubmissions] = useState<StudentSubmission[]>([])
  const [submissionComments, setSubmissionComments] = useState<Record<string, SubmissionComment[]>>({})
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({})
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({})
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [showHomeworkForm, setShowHomeworkForm] = useState(false)
  const [showGradingInterface, setShowGradingInterface] = useState(false)
  const [showSubmissionForm, setShowSubmissionForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadSessionData()
  }, [occurrenceId])

  async function loadSessionData() {
    try {
      setLoading(true)
      setError(null)

      // Load occurrence
      const { data: occData, error: occError } = await supabase
        .from('class_occurrences')
        .select('*')
        .eq('id', occurrenceId)
        .single()

      if (occError) throw occError
      setOccurrence(occData)

      // Load materials
      const { data: matData, error: matError } = await supabase
        .from('session_materials')
        .select(`
          *,
          profiles:uploaded_by(full_name, nickname)
        `)
        .eq('occurrence_id', occurrenceId)
        .eq('is_available', true)
        .order('uploaded_at', { ascending: false })

      if (matError) throw matError
      setMaterials(matData || [])

      // Load homework assignment
      const { data: hwData, error: hwError } = await supabase
        .from('homework_assignments')
        .select('*')
        .eq('occurrence_id', occurrenceId)
        .maybeSingle()

      if (hwError) throw hwError
      setHomework(hwData)

      // Load student's submissions (if student role)
      if (userRole === 'student' && hwData) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Load submissions
          const { data: subData, error: subError } = await supabase
            .from('homework_submissions')
            .select('*')
            .eq('assignment_id', hwData.id)
            .eq('student_id', user.id)
            .order('version', { ascending: false })

          if (subError) throw subError
          
          // Load published grades separately
          if (subData && subData.length > 0) {
            const submissionIds = subData.map(s => s.id)
            const { data: gradesData, error: gradesError } = await supabase
              .from('homework_grades')
              .select('*')
              .in('submission_id', submissionIds)
              .eq('status', 'published')
            
            if (gradesError) {
              console.error('Error loading grades:', gradesError)
            }
            
            // Attach grades to submissions
            const subsWithGrades = subData.map(sub => ({
              ...sub,
              homework_grades: gradesData?.filter(g => g.submission_id === sub.id) || []
            }))
            
            // Debug: Log submissions and grades
            console.log('📝 Loaded student submissions:', subsWithGrades)
            subsWithGrades.forEach((sub, idx) => {
              console.log(`  Submission ${idx + 1}:`, {
                id: sub.id,
                hasComments: !!sub.comments,
                submitted_at: sub.submitted_at,
                grades: sub.homework_grades,
                hasGrades: sub.homework_grades && sub.homework_grades.length > 0,
                gradeStatus: sub.homework_grades?.[0]?.status
              })
            })
            
            setMySubmissions(subsWithGrades)
            
            // Load comments for submissions
            await loadCommentsForSubmissions(submissionIds)
          } else {
            setMySubmissions([])
          }
        }
      }

    } catch (err) {
      console.error('Failed to load session data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load session')
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
          profiles!inner(full_name, nickname)
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
          profiles!inner(full_name, nickname)
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

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function getFileIcon(fileType: string): string {
    if (fileType === 'text/uri-list') return '🔗'
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('word') || fileType.includes('document')) return '📝'
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📊'
    if (fileType.includes('image')) return '🖼️'
    if (fileType.includes('video')) return '🎥'
    return '📎'
  }

  async function handleDownload(material: Material) {
    try {
      // For link-type materials, open in new tab
      if (material.material_type === 'link') {
        window.open(material.file_url, '_blank', 'noopener,noreferrer')
        return
      }

      // For file materials, trigger download
      const link = document.createElement('a')
      link.href = material.file_url
      link.download = material.title
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Download failed:', err)
      alert('Failed to download file')
    }
  }

  if (loading) {
    return (
      <Card>
        <Card.Body>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </Card.Body>
      </Card>
    )
  }

  if (error || !occurrence) {
    return (
      <Card>
        <Card.Body>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">⚠️ {error || 'Session not found'}</p>
            {onClose && (
              <Button onClick={onClose} variant="secondary">
                Close
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Session Header */}
      <Card>
        <Card.Header>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Card.Title>Session {occurrence.session_number}</Card.Title>
                {occurrence.status === 'completed' && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                    ✓ Completed
                  </span>
                )}
                {occurrence.status === 'cancelled' && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                    ✗ Cancelled
                  </span>
                )}
              </div>
              {occurrence.topic && (
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {occurrence.topic}
                </h3>
              )}
              <p className="text-gray-600">
                {formatOccurrenceDisplay(occurrence)}
              </p>
            </div>
            {onClose && (
              <Button onClick={onClose} variant="ghost" size="sm">
                ✕
              </Button>
            )}
          </div>
        </Card.Header>
        {occurrence.notes && (
          <Card.Body>
            <p className="text-gray-700">{occurrence.notes}</p>
          </Card.Body>
        )}
      </Card>

      {/* Materials Section */}
      {showUploadForm && userRole === 'teacher' ? (
        <MaterialUpload
          occurrenceId={occurrenceId}
          classId={occurrence.class_id}
          onUploadComplete={() => {
            setShowUploadForm(false)
            loadSessionData()
          }}
          onCancel={() => setShowUploadForm(false)}
        />
      ) : (
        <Card>
          <Card.Header>
            <div className="flex justify-between items-center">
              <Card.Title>Materials ({materials.length})</Card.Title>
              {userRole === 'teacher' && (
                <Button size="sm" onClick={() => setShowUploadForm(true)}>
                  + Upload Material
                </Button>
              )}
            </div>
          </Card.Header>
          <Card.Body>
          {materials.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📚</div>
              <p className="text-gray-500">No materials yet</p>
              {userRole === 'teacher' && (
                <p className="text-sm text-gray-400 mt-1">
                  Upload materials for students to access
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {materials.map((material) => (
                <div
                  key={material.id}
                  className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="text-3xl">
                      {getFileIcon(material.file_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 mb-1">
                        {material.title}
                      </h4>
                      {material.description && (
                        <p className="text-sm text-gray-600 mb-2">
                          {material.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                          {material.material_type}
                        </span>
                        {material.material_type !== 'link' && (
                          <>
                            <span>{formatFileSize(material.file_size)}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>
                          Uploaded by {material.profiles.nickname || material.profiles.full_name}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(material.uploaded_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDownload(material)}
                  >
                    {material.material_type === 'link' ? '🔗 Open Link' : '📥 Download'}
                  </Button>
                </div>
              ))}
            </div>
          )}
          </Card.Body>
        </Card>
      )}

      {/* Homework Section */}
      {showGradingInterface && homework && userRole === 'teacher' ? (
        <GradingInterface
          assignmentId={homework.id}
          assignmentTitle={homework.title}
          pointsPossible={homework.points_possible}
          onClose={() => setShowGradingInterface(false)}
        />
      ) : showSubmissionForm && homework && userRole === 'student' ? (
        <SubmissionForm
          assignmentId={homework.id}
          assignmentTitle={homework.title}
          dueDate={homework.due_date}
          submissionType={homework.submission_type}
          pointsPossible={homework.points_possible}
          onSubmit={() => {
            setShowSubmissionForm(false)
            loadSessionData()
          }}
          onCancel={() => setShowSubmissionForm(false)}
        />
      ) : showHomeworkForm && userRole === 'teacher' ? (
        <HomeworkForm
          occurrenceId={occurrenceId}
          existingAssignment={homework}
          onSave={() => {
            setShowHomeworkForm(false)
            loadSessionData()
          }}
          onCancel={() => setShowHomeworkForm(false)}
        />
      ) : homework ? (
        <Card>
          <Card.Header>
            <Card.Title>Homework Assignment</Card.Title>
          </Card.Header>
          <Card.Body>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {homework.title}
                </h4>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {homework.description}
                </p>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Due:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {new Date(homework.due_date).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Points:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {homework.points_possible}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Type:</span>{' '}
                  <span className="font-medium text-gray-900 capitalize">
                    {homework.submission_type}
                  </span>
                </div>
              </div>

              {userRole === 'student' && (
                <div className="pt-4 border-t border-gray-200 space-y-4">
                  {/* Submission History */}
                  {mySubmissions.length > 0 ? (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-3">
                        Your Submissions ({mySubmissions.length})
                      </h5>
                      <div className="space-y-3">
                        {mySubmissions.map((submission) => {
                          const grade = submission.homework_grades?.[0]
                          const isGraded = grade && grade.status === 'published'
                          
                          return (
                            <div
                              key={submission.id}
                              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    Version {submission.version}
                                  </span>
                                  {submission.is_late && (
                                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                      Late
                                    </span>
                                  )}
                                  {isGraded && (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                                      Graded
                                    </span>
                                  )}
                                </div>
                                <span className="text-sm text-gray-500">
                                  {new Date(submission.submitted_at).toLocaleString()}
                                </span>
                              </div>

                              {/* Submission Content Preview */}
                              <div className="text-sm text-gray-700 mb-2">
                                {submission.submission_type === 'file' && submission.file_url && (
                                  <a
                                    href={submission.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    📎 View File
                                  </a>
                                )}
                                {submission.submission_type === 'text' && submission.text_content && (
                                  <p className="line-clamp-2">{submission.text_content}</p>
                                )}
                                {submission.submission_type === 'link' && submission.link_url && (
                                  <a
                                    href={submission.link_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    🔗 {submission.link_url}
                                  </a>
                                )}
                              </div>

                              {/* Student Comments */}
                              {submission.comments && submission.comments.trim() && (
                                <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                                  <span className="text-xs font-semibold text-blue-700 block mb-1">
                                    💬 Your Comments:
                                  </span>
                                  <p className="text-sm text-blue-900 whitespace-pre-wrap">
                                    {submission.comments}
                                  </p>
                                </div>
                              )}

                              {/* Grade Display */}
                              {isGraded && grade && (
                                <div className="mt-3 pt-3 border-t border-gray-300">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">Grade:</span>
                                    <span className="text-lg font-semibold text-gray-900">
                                      {grade.points_earned}/{homework.points_possible}
                                    </span>
                                  </div>
                                  {grade.feedback && (
                                    <div className="mt-2">
                                      <span className="text-sm font-medium text-gray-700 block mb-1">
                                        Feedback:
                                      </span>
                                      <p className="text-sm text-gray-600 italic">
                                        &ldquo;{grade.feedback}&rdquo;
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Comments Thread */}
                              <div className="mt-3 pt-3 border-t border-gray-300 space-y-3">
                                <h6 className="text-sm font-medium text-gray-700">Comments</h6>
                                
                                {/* Display existing comments */}
                                {submissionComments[submission.id] && submissionComments[submission.id].length > 0 && (
                                  <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {submissionComments[submission.id].map((comment) => (
                                      <div key={comment.id} className="p-2 bg-white rounded border border-gray-200">
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1">
                                            <p className="text-xs font-semibold text-gray-700">
                                              {comment.profiles.nickname || comment.profiles.full_name}
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
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Submit/Resubmit Button */}
                  <Button onClick={() => setShowSubmissionForm(true)}>
                    {mySubmissions.length > 0 ? 'Resubmit Homework' : 'Submit Homework'}
                  </Button>
                </div>
              )}

              {userRole === 'teacher' && (
                <div className="pt-4 border-t border-gray-200 flex gap-2">
                  <Button 
                    variant="secondary"
                    onClick={() => setShowGradingInterface(true)}
                  >
                    View Submissions
                  </Button>
                  <Button variant="secondary" onClick={() => setShowHomeworkForm(true)}>
                    Edit Assignment
                  </Button>
                </div>
              )}
            </div>
          </Card.Body>
        </Card>
      ) : userRole === 'teacher' ? (
        <Card>
          <Card.Body>
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📝</div>
              <p className="text-gray-500 mb-4">No homework assignment</p>
              <Button onClick={() => setShowHomeworkForm(true)}>
                Create Assignment
              </Button>
            </div>
          </Card.Body>
        </Card>
      ) : null}
    </div>
  )
}
