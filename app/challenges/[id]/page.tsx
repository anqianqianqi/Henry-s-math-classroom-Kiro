'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CommentThread } from '@/components/CommentThread'

interface Challenge {
  id: string
  title: string
  description: string
  challenge_date: string
  created_by: string
  image_url?: string | null
}

interface Submission {
  id: string
  user_id: string
  content: string
  submitted_at: string
  profiles: {
    full_name: string
  }
}

interface Comment {
  id: string
  submission_id: string
  user_id: string
  content: string
  created_at: string
  profiles: {
    full_name: string
  }
}

export default function ChallengePage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [userSubmission, setUserSubmission] = useState<Submission | null>(null)
  const [otherSubmissions, setOtherSubmissions] = useState<Submission[]>([])
  const [solution, setSolution] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isTeacher, setIsTeacher] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [totalStudents, setTotalStudents] = useState(0)
  const [showStudentList, setShowStudentList] = useState(false)
  const [studentList, setStudentList] = useState<Array<{
    id: string
    name: string
    submitted: boolean
    submittedAt?: string
  }>>([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [totalSubmissionCount, setTotalSubmissionCount] = useState(0)
  const [comments, setComments] = useState<{[submissionId: string]: Comment[]}>({})
  const [newComment, setNewComment] = useState<{[submissionId: string]: string}>({})
  const [submittingComment, setSubmittingComment] = useState<{[submissionId: string]: boolean}>({})
  const [visibleComments, setVisibleComments] = useState<{[submissionId: string]: number}>({})
  const COMMENTS_INCREMENT = 5

  useEffect(() => {
    loadChallenge()
  }, [params.id])

  async function loadStudentList() {
    console.log('loadStudentList called')
    
    if (studentList.length > 0) {
      // Already loaded, just toggle
      console.log('Toggling student list')
      setShowStudentList(!showStudentList)
      return
    }

    console.log('Loading student list for challenge:', params.id)

    // Get classes this challenge is assigned to
    const { data: assignments } = await supabase
      .from('challenge_assignments')
      .select('class_id')
      .eq('challenge_id', params.id)

    console.log('Challenge assignments:', assignments)

    if (!assignments || assignments.length === 0) return

    const classIds = assignments.map(a => a.class_id)

    // Get all students in these classes
    const { data: members } = await supabase
      .from('class_members')
      .select(`
        user_id,
        profiles:user_id(full_name)
      `)
      .in('class_id', classIds)

    console.log('Class members:', members)

    if (!members) return

    // Get submissions for this challenge
    const { data: submissions } = await supabase
      .from('challenge_submissions')
      .select('user_id, submitted_at')
      .eq('challenge_id', params.id)

    console.log('Submissions:', submissions)

    const submissionMap = new Map(
      submissions?.map(s => [s.user_id, s.submitted_at]) || []
    )

    const students = members.map((m: any) => ({
      id: m.user_id,
      name: m.profiles?.full_name || 'Unknown',
      submitted: submissionMap.has(m.user_id),
      submittedAt: submissionMap.get(m.user_id)
    }))

    // Sort: submitted first, then by name
    students.sort((a, b) => {
      if (a.submitted !== b.submitted) return a.submitted ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    console.log('Final student list:', students)

    setStudentList(students)
    setShowStudentList(true)
  }

  async function loadChallenge() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    setUserId(user.id)

    // Load challenge
    const { data: challengeData } = await supabase
      .from('daily_challenges')
      .select('*')
      .eq('id', params.id)
      .single()

    setChallenge(challengeData)

    // Check if user is teacher first
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .is('class_id', null)

    let teacherRole = false
    if (roles && roles.length > 0) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .in('id', roles.map((r: any) => r.role_id))

      teacherRole = roleData?.some((r: any) => r.name === 'teacher') || false
      setIsTeacher(teacherRole)
    }

    // Load user's submission (for both students and teachers)
    const { data: submissionData } = await supabase
      .from('challenge_submissions')
      .select(`
        *,
        profiles!inner(full_name)
      `)
      .eq('challenge_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (submissionData) {
      setUserSubmission(submissionData)
      setSolution(submissionData.content)
      // Load comments for user's own submission
      await loadCommentsForSubmissions([submissionData.id])
    }

    // Teachers always see all submissions, students only after submitting
    if (teacherRole) {
      await loadOtherSubmissions(user.id, true)
      
      // Get total number of students in classes this challenge is assigned to
      const { data: assignments } = await supabase
        .from('challenge_assignments')
        .select('class_id')
        .eq('challenge_id', params.id)

      console.log('Challenge assignments:', assignments)

      if (assignments && assignments.length > 0) {
        const classIds = assignments.map(a => a.class_id)
        
        console.log('Class IDs:', classIds)
        
        const { count, error: countError } = await supabase
          .from('class_members')
          .select('*', { count: 'exact', head: true })
          .in('class_id', classIds)

        console.log('Student count query:', { count, countError })

        setTotalStudents(count || 0)
      }
    } else if (submissionData) {
      await loadOtherSubmissions(user.id, false)
    }

    // Load total submission count for all users (for the locked message)
    const { count: totalCount } = await supabase
      .from('challenge_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('challenge_id', params.id)
    
    setTotalSubmissionCount(totalCount || 0)

    setLoading(false)
  }

  async function loadOtherSubmissions(currentUserId: string, isTeacher: boolean = false) {
    const query = supabase
      .from('challenge_submissions')
      .select(`
        *,
        profiles!inner(full_name)
      `)
      .eq('challenge_id', params.id)
      .order('submitted_at', { ascending: false })

    // Teachers see ALL submissions, students see others' submissions
    if (!isTeacher) {
      query.neq('user_id', currentUserId)
    }

    const { data: submissions } = await query

    setOtherSubmissions(submissions || [])
    
    // Load comments for all submissions
    if (submissions && submissions.length > 0) {
      await loadCommentsForSubmissions(submissions.map(s => s.id))
    }
  }

  async function loadCommentsForSubmissions(submissionIds: string[]) {
    console.log('Loading comments for submissions:', submissionIds)
    const { data: commentsData } = await supabase
      .from('submission_comments')
      .select(`
        *,
        profiles!inner(full_name)
      `)
      .in('submission_id', submissionIds)
      .order('created_at', { ascending: true })

    console.log('Loaded comments:', commentsData)

    if (commentsData) {
      const commentsBySubmission: {[key: string]: Comment[]} = {}
      commentsData.forEach((comment: Comment) => {
        if (!commentsBySubmission[comment.submission_id]) {
          commentsBySubmission[comment.submission_id] = []
        }
        commentsBySubmission[comment.submission_id].push(comment)
      })
      console.log('Comments by submission:', commentsBySubmission)
      // MERGE with existing comments instead of replacing
      setComments(prev => ({ ...prev, ...commentsBySubmission }))
    }
  }

  async function handleSubmitComment(submissionId: string) {
    const commentText = newComment[submissionId]?.trim()
    if (!commentText || !userId) return

    setSubmittingComment({ ...submittingComment, [submissionId]: true })

    try {
      const { data, error } = await supabase
        .from('submission_comments')
        .insert({
          submission_id: submissionId,
          user_id: userId,
          content: commentText
        })
        .select(`
          *,
          profiles!inner(full_name)
        `)
        .single()

      if (error) {
        console.error('Error submitting comment:', error)
        alert('Failed to submit comment: ' + error.message)
      } else if (data) {
        // Add comment to state
        setComments(prev => ({
          ...prev,
          [submissionId]: [...(prev[submissionId] || []), data]
        }))
        // Clear input
        setNewComment(prev => ({ ...prev, [submissionId]: '' }))
        // Expand to show the new comment
        const newCommentCount = (comments[submissionId]?.length || 0) + 1
        if (newCommentCount > COMMENTS_INCREMENT) {
          setVisibleComments(prev => ({
            ...prev,
            [submissionId]: newCommentCount
          }))
        }
      }
    } catch (err) {
      console.error('Error submitting comment:', err)
      alert('An unexpected error occurred')
    } finally {
      setSubmittingComment({ ...submittingComment, [submissionId]: false })
    }
  }

  function handleShowMoreComments(submissionId: string) {
    setVisibleComments(prev => {
      const current = prev[submissionId] || COMMENTS_INCREMENT
      const total = comments[submissionId]?.length || 0
      // If showing all, collapse to 5. Otherwise expand by 5
      if (current >= total) {
        return { ...prev, [submissionId]: COMMENTS_INCREMENT }
      } else {
        return { ...prev, [submissionId]: Math.min(current + COMMENTS_INCREMENT, total) }
      }
    })
  }

  async function handleSubmit() {
    if (!solution.trim() || !userId) return

    setSubmitting(true)

    try {
      if (userSubmission) {
        // Update existing submission
        const { error } = await supabase
          .from('challenge_submissions')
          .update({ content: solution })
          .eq('id', userSubmission.id)

        if (!error) {
          setUserSubmission({ ...userSubmission, content: solution })
          setIsEditing(false)
        }
      } else {
        // Create new submission
        const { data, error } = await supabase
          .from('challenge_submissions')
          .insert({
            challenge_id: params.id,
            user_id: userId,
            content: solution
          })
          .select(`
            *,
            profiles!inner(full_name)
          `)
          .single()

        if (!error && data) {
          setUserSubmission(data)
          setShowCelebration(true)
          
          // Load other submissions now that user has submitted
          await loadOtherSubmissions(userId)
          
          // Hide celebration after 3 seconds
          setTimeout(() => setShowCelebration(false), 3000)
        }
      }
    } catch (error) {
      console.error('Error submitting:', error)
    } finally {
      setSubmitting(false)
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    return `${Math.floor(seconds / 86400)} days ago`
  }

  async function handleDelete() {
    if (!userId) return
    
    setDeleting(true)

    try {
      // Delete challenge (cascade will handle assignments and submissions)
      const { error } = await supabase
        .from('daily_challenges')
        .delete()
        .eq('id', params.id)

      if (error) {
        console.error('Error deleting challenge:', error)
        alert('Failed to delete challenge: ' + error.message)
        setDeleting(false)
        return
      }

      // Success! Redirect to challenges list
      router.push('/challenges')
    } catch (err) {
      console.error('Error deleting challenge:', err)
      alert('An unexpected error occurred')
      setDeleting(false)
    }
  }

  async function handleDuplicate() {
    if (!userId || !challenge) return
    
    setDuplicating(true)

    try {
      // Get class assignments for this challenge
      const { data: assignments } = await supabase
        .from('challenge_assignments')
        .select('class_id')
        .eq('challenge_id', params.id)

      // Create new challenge with same data but new date (tomorrow)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const newDate = tomorrow.toISOString().split('T')[0]

      const { data: newChallenge, error: createError } = await supabase
        .from('daily_challenges')
        .insert({
          title: challenge.title + ' (Copy)',
          description: challenge.description,
          challenge_date: newDate,
          created_by: userId
        })
        .select()
        .single()

      if (createError || !newChallenge) {
        console.error('Error creating duplicate:', createError)
        alert('Failed to duplicate challenge: ' + (createError?.message || 'Unknown error'))
        setDuplicating(false)
        return
      }

      // Copy class assignments
      if (assignments && assignments.length > 0) {
        const newAssignments = assignments.map(a => ({
          challenge_id: newChallenge.id,
          class_id: a.class_id
        }))

        const { error: assignError } = await supabase
          .from('challenge_assignments')
          .insert(newAssignments)

        if (assignError) {
          console.error('Error copying assignments:', assignError)
          // Continue anyway - challenge was created
        }
      }

      // Redirect to edit page for the new challenge
      router.push(`/challenges/${newChallenge.id}/edit`)
    } catch (err) {
      console.error('Error duplicating challenge:', err)
      alert('An unexpected error occurred')
      setDuplicating(false)
    }
  }

  async function handleSaveAsTemplate() {
    if (!userId || !challenge) return
    
    const templateTitle = prompt('Enter a name for this template:', challenge.title + ' (Template)')
    if (!templateTitle) return // User cancelled
    
    setSavingTemplate(true)

    try {
      const { data: template, error } = await supabase
        .from('challenge_templates')
        .insert({
          title: templateTitle,
          description: challenge.description,
          created_by: userId,
          image_url: challenge.image_url,
          is_public: false
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving template:', error)
        alert('Failed to save template: ' + error.message)
        setSavingTemplate(false)
        return
      }

      alert(`Template "${templateTitle}" saved successfully!`)
      setSavingTemplate(false)
    } catch (err) {
      console.error('Error saving template:', err)
      alert('An unexpected error occurred')
      setSavingTemplate(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🎯</div>
          <p className="text-gray-600">Loading challenge...</p>
        </div>
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <Card>
          <Card.Body className="text-center py-8">
            <div className="text-5xl mb-3">❌</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Challenge Not Found
            </h3>
            <Button onClick={() => router.push('/challenges')}>
              Back to Challenges
            </Button>
          </Card.Body>
        </Card>
      </div>
    )
  }

  const hasSubmitted = !!userSubmission
  const canSeeOthers = hasSubmitted || isTeacher
  // For teachers, otherSubmissions already includes all submissions
  // For students, otherSubmissions excludes their own, so we add 1 if they submitted
  const submissionCount = isTeacher ? otherSubmissions.length : otherSubmissions.length + (hasSubmitted ? 1 : 0)
  const completionRate = totalStudents > 0 ? Math.round((submissionCount / totalStudents) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/challenges')}
            >
              ← Back
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-3xl">📚</span>
              <h1 className="text-2xl font-bold text-gray-900">Daily Challenge</h1>
            </div>
            {isTeacher && (
              <>
                <div className="ml-auto flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/challenges/${params.id}/edit`)}
                  >
                    ✏️ Edit
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleDuplicate}
                    disabled={duplicating}
                  >
                    {duplicating ? '⏳ Duplicating...' : '📋 Duplicate'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSaveAsTemplate}
                    disabled={savingTemplate}
                  >
                    {savingTemplate ? '⏳ Saving...' : '💾 Save as Template'}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    🗑️ Delete
                  </Button>
                  <span className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-semibold">
                    <span>👨‍🏫</span>
                    Teacher View
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Celebration Banner */}
        {showCelebration && (
          <div className="bg-gradient-to-r from-primary-500 to-accent-blue rounded-3xl p-6 mb-6 text-white animate-bounce">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🎉</span>
              <div>
                <h3 className="text-xl font-bold">Great job!</h3>
                <p>You can now see what others wrote</p>
              </div>
            </div>
          </div>
        )}

        {/* Challenge Card */}
        <Card className="mb-6">
          <Card.Header>
            <div className="flex items-center gap-3">
              <span className="text-3xl">📚</span>
              <div className="flex-1">
                <Card.Title>{challenge.title}</Card.Title>
                <p className="text-sm text-gray-500">
                  {new Date(challenge.challenge_date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </Card.Header>
          <Card.Body>
            {challenge.image_url && (
              <div className="mb-4">
                <img
                  src={challenge.image_url}
                  alt="Challenge visual"
                  className="w-full max-h-96 object-contain bg-gray-50 rounded-2xl border-2 border-gray-200"
                />
              </div>
            )}
            <p className="text-gray-700 whitespace-pre-wrap">
              {challenge.description}
            </p>
          </Card.Body>
        </Card>

        {/* Teacher Stats Dashboard */}
        {isTeacher && (
          <Card className="mb-6 bg-gradient-to-r from-primary-50 to-accent-blue/10">
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <span>📊</span>
                Submission Stats
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-4 bg-white rounded-2xl">
                  <div className="text-3xl font-bold text-primary-600 mb-1">
                    {submissionCount}
                  </div>
                  <div className="text-sm text-gray-600">Submitted</div>
                </div>
                <button
                  onClick={loadStudentList}
                  type="button"
                  className="text-center p-4 bg-white rounded-2xl hover:bg-gray-50 hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-primary-200"
                >
                  <div className="text-3xl font-bold text-gray-600 mb-1">
                    {completionRate}%
                  </div>
                  <div className="text-sm text-gray-600">
                    {submissionCount} of {totalStudents} students
                  </div>
                  <div className="text-xs text-primary-600 mt-1 font-semibold">
                    👆 Click to see details
                  </div>
                </button>
              </div>

              {/* Student List */}
              {showStudentList && (
                <div className="mt-4 p-4 bg-white rounded-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">Student Status</h4>
                    <button
                      onClick={() => setShowStudentList(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {studentList.map(student => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">
                            {student.submitted ? '✅' : '⏳'}
                          </span>
                          <span className="font-medium text-gray-900">
                            {student.name}
                          </span>
                        </div>
                        {student.submitted && student.submittedAt && (
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(student.submittedAt)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        )}

        {/* Submission Section */}
        {!isTeacher && (
          <>
            {hasSubmitted && !isEditing ? (
              // Show submitted solution
              <Card className="mb-6 border-2 border-primary-500">
                <Card.Header>
                  <div className="flex items-center justify-between">
                    <Card.Title className="flex items-center gap-2">
                      <span>✅</span>
                      Your Solution
                    </Card.Title>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      Edit
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body>
                  <p className="text-gray-700 whitespace-pre-wrap mb-3">
                    {userSubmission.content}
                  </p>
                  <p className="text-sm text-gray-500 mb-3">
                    Submitted {formatTimeAgo(userSubmission.submitted_at)}
                  </p>
                  
                  <CommentThread
                    submissionId={userSubmission.id}
                    comments={comments[userSubmission.id] || []}
                    visibleCount={visibleComments[userSubmission.id] || COMMENTS_INCREMENT}
                    onShowMore={() => handleShowMoreComments(userSubmission.id)}
                    newComment={newComment[userSubmission.id] || ''}
                    onCommentChange={(value) => setNewComment(prev => ({ ...prev, [userSubmission.id]: value }))}
                    onSubmitComment={() => handleSubmitComment(userSubmission.id)}
                    isSubmitting={submittingComment[userSubmission.id] || false}
                    formatTimeAgo={formatTimeAgo}
                    showTitle={true}
                  />
                </Card.Body>
              </Card>
            ) : (
              // Show submission form
              <Card className="mb-6">
                <Card.Header>
                  <Card.Title className="flex items-center gap-2">
                    <span>✍️</span>
                    {hasSubmitted ? 'Edit Your Solution' : 'Your Solution'}
                  </Card.Title>
                </Card.Header>
                <Card.Body>
                  <textarea
                    value={solution}
                    onChange={(e) => setSolution(e.target.value)}
                    placeholder="Write your solution here... Show your work!"
                    className="w-full h-48 p-4 border-2 border-gray-200 rounded-2xl 
                             focus:border-primary-500 focus:ring-2 focus:ring-primary-200
                             resize-none transition-colors"
                  />
                  <div className="flex gap-3 mt-4">
                    <Button
                      onClick={handleSubmit}
                      disabled={!solution.trim() || submitting}
                      isLoading={submitting}
                      fullWidth
                      size="lg"
                    >
                      <span className="mr-2">🚀</span>
                      {hasSubmitted ? 'Update Solution' : 'Submit Solution'}
                    </Button>
                    {isEditing && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false)
                          setSolution(userSubmission?.content || '')
                        }}
                        size="lg"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </Card.Body>
              </Card>
            )}
          </>
        )}

        {/* Other Submissions Section */}
        {canSeeOthers ? (
          // Unlocked: Show other submissions
          <Card>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <span>💬</span>
                {isTeacher ? 'All Student Submissions' : 'Other Students\' Solutions'} ({otherSubmissions.length})
              </Card.Title>
            </Card.Header>
            <Card.Body>
              {otherSubmissions.length > 0 ? (
                <div className="space-y-4">
                  {otherSubmissions.map(submission => (
                    <div
                      key={submission.id}
                      className="p-4 bg-gray-50 rounded-2xl"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">👤</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-gray-900">
                              {submission.profiles.full_name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatTimeAgo(submission.submitted_at)}
                            </p>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap mb-3">
                            {submission.content}
                          </p>
                          
                          <CommentThread
                            submissionId={submission.id}
                            comments={comments[submission.id] || []}
                            visibleCount={visibleComments[submission.id] || COMMENTS_INCREMENT}
                            onShowMore={() => handleShowMoreComments(submission.id)}
                            newComment={newComment[submission.id] || ''}
                            onCommentChange={(value) => setNewComment(prev => ({ ...prev, [submission.id]: value }))}
                            onSubmitComment={() => handleSubmitComment(submission.id)}
                            isSubmitting={submittingComment[submission.id] || false}
                            formatTimeAgo={formatTimeAgo}
                            showTitle={false}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🤔</div>
                  <p className="text-gray-600">
                    No other submissions yet. Be the first!
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>
        ) : (
          // Locked: Must submit first
          <Card className="bg-gray-50 border-2 border-dashed border-gray-300">
            <Card.Body className="text-center py-12">
              <div className="text-6xl mb-4">🔒</div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">
                Other Students' Solutions
              </h3>
              <p className="text-gray-600 mb-4">
                Submit your solution to see what other students wrote!
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <span>👥</span>
                <span>{totalSubmissionCount} {totalSubmissionCount === 1 ? 'student has' : 'students have'} submitted</span>
              </div>
            </Card.Body>
          </Card>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <Card.Header>
              <Card.Title className="flex items-center gap-2 text-red-600">
                <span>⚠️</span>
                Delete Challenge?
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete this challenge? This action cannot be undone.
              </p>
              {submissionCount > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl mb-4">
                  <p className="text-sm text-red-800">
                    <strong>Warning:</strong> This challenge has {submissionCount} submission{submissionCount !== 1 ? 's' : ''} that will also be deleted.
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  disabled={deleting}
                  isLoading={deleting}
                  fullWidth
                >
                  Delete Challenge
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  fullWidth
                >
                  Cancel
                </Button>
              </div>
            </Card.Body>
          </Card>
        </div>
      )}
    </div>
  )
}
