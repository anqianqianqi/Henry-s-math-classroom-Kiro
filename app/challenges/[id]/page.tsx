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
  image_url?: string | null
  points?: number | null
  is_locked?: boolean
  submitted_at: string
  profiles: {
    full_name: string
    nickname: string | null
  }
}

interface Comment {
  id: string
  submission_id: string
  user_id: string
  content: string
  image_url?: string | null
  created_at: string
  profiles: {
    full_name: string
    nickname: string | null
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
  const [solutionImage, setSolutionImage] = useState<File | null>(null)
  const [solutionImagePreview, setSolutionImagePreview] = useState<string | null>(null)
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
        profiles:user_id(full_name, nickname)
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

    const students = members
      .filter((m: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.user_id === m.user_id) === i)
      .map((m: any) => ({
      id: m.user_id,
      name: m.profiles?.nickname || m.profiles?.full_name || 'Unknown',
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
        profiles!inner(full_name, nickname)
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
        
        const { data: memberData } = await supabase
          .from('class_members')
          .select('user_id')
          .in('class_id', classIds)

        const uniqueStudents = new Set(memberData?.map(m => m.user_id) || [])
        setTotalStudents(uniqueStudents.size)
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
        profiles!inner(full_name, nickname)
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
        profiles!inner(full_name, nickname)
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

  async function handleSubmitComment(submissionId: string, imageFile?: File | null) {
    const commentText = newComment[submissionId]?.trim()
    if ((!commentText && !imageFile) || !userId) return

    setSubmittingComment({ ...submittingComment, [submissionId]: true })

    try {
      // Upload comment image if provided
      let commentImageUrl: string | null = null
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${userId}/comment-${submissionId}-${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('challenge-images')
          .upload(fileName, imageFile, { contentType: imageFile.type })
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('challenge-images')
            .getPublicUrl(fileName)
          commentImageUrl = urlData.publicUrl
        }
      }

      const insertData: any = {
        submission_id: submissionId,
        user_id: userId,
        content: commentText || ''
      }
      if (commentImageUrl) insertData.image_url = commentImageUrl

      const { data, error } = await supabase
        .from('submission_comments')
        .insert(insertData)
        .select(`
          *,
          profiles!inner(full_name, nickname)
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
      // Upload image if provided
      let imageUrl: string | null = null
      if (solutionImage) {
        const fileExt = solutionImage.name.split('.').pop()
        const fileName = `${userId}/${params.id}-${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('challenge-images')
          .upload(fileName, solutionImage, { contentType: solutionImage.type })
        
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('challenge-images')
            .getPublicUrl(fileName)
          imageUrl = urlData.publicUrl
        }
      }

      if (userSubmission) {
        const updateData: any = { content: solution }
        if (imageUrl) updateData.image_url = imageUrl
        
        const { error } = await supabase
          .from('challenge_submissions')
          .update(updateData)
          .eq('id', userSubmission.id)

        if (!error) {
          setUserSubmission({ ...userSubmission, content: solution, image_url: imageUrl || userSubmission.image_url })
          setIsEditing(false)
        }
      } else {
        const insertData: any = {
          challenge_id: params.id,
          user_id: userId,
          content: solution
        }
        if (imageUrl) insertData.image_url = imageUrl

        const { data, error } = await supabase
          .from('challenge_submissions')
          .insert(insertData)
          .select(`
            *,
            profiles!inner(full_name, nickname)
          `)
          .single()

        if (!error && data) {
          setUserSubmission(data)
          setShowCelebration(true)
          await loadOtherSubmissions(userId)
          setTimeout(() => setShowCelebration(false), 3000)
        }
      }
      setSolutionImage(null)
      setSolutionImagePreview(null)
    } catch (error) {
      console.error('Error submitting:', error)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevealOthers() {
    if (!userSubmission || !userId) return
    if (!confirm('⚠️ This will lock your current submission and grade. You won\'t be able to edit your answer after this. Continue?')) return

    const { error } = await supabase
      .from('challenge_submissions')
      .update({ is_locked: true })
      .eq('id', userSubmission.id)

    if (!error) {
      setUserSubmission({ ...userSubmission, is_locked: true })
      await loadOtherSubmissions(userId)
    }
  }

  async function handleGradeSubmission(submissionId: string, points: number) {
    const { error } = await supabase
      .from('challenge_submissions')
      .update({ points })
      .eq('id', submissionId)

    if (error) {
      console.error('Error grading:', error)
      alert('Failed to save grade: ' + error.message)
    } else {
      setOtherSubmissions(prev => prev.map(s => 
        s.id === submissionId ? { ...s, points } : s
      ))
      if (userSubmission?.id === submissionId) {
        setUserSubmission({ ...userSubmission, points })
      }
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
  const canSeeOthers = (hasSubmitted && userSubmission?.is_locked) || isTeacher
  // For teachers, otherSubmissions already includes all submissions
  // For students, otherSubmissions excludes their own, so we add 1 if they submitted
  const submissionCount = isTeacher ? otherSubmissions.length : otherSubmissions.length + (hasSubmitted ? 1 : 0)
  const completionRate = totalStudents > 0 ? Math.round((submissionCount / totalStudents) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/challenges')}
              >
                ←
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-2xl sm:text-3xl">📚</span>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Challenge</h1>
              </div>
            </div>
            {isTeacher && (
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/challenges/${params.id}/edit`)}
                >
                  <span className="sm:hidden">✏️</span>
                  <span className="hidden sm:inline">✏️ Edit</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDuplicate}
                  disabled={duplicating}
                >
                  <span className="sm:hidden">📋</span>
                  <span className="hidden sm:inline">{duplicating ? '⏳...' : '📋 Duplicate'}</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveAsTemplate}
                  disabled={savingTemplate}
                >
                  <span className="sm:hidden">💾</span>
                  <span className="hidden sm:inline">{savingTemplate ? '⏳...' : '💾 Template'}</span>
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <span className="sm:hidden">🗑️</span>
                  <span className="hidden sm:inline">🗑️ Delete</span>
                </Button>
              </div>
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
              <>
              {/* Show submitted solution */}
              <Card className="mb-6 border-2 border-primary-500">
                <Card.Header>
                  <div className="flex items-center justify-between">
                    <Card.Title className="flex items-center gap-2">
                      <span>✅</span>
                      Your Solution
                      {userSubmission?.points != null && (
                        <span className="ml-2 px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-bold">
                          {userSubmission.points}/100
                        </span>
                      )}
                      {userSubmission?.is_locked && (
                        <span className="text-xs text-gray-500">🔒 Locked</span>
                      )}
                    </Card.Title>
                    {!userSubmission?.is_locked && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditing(true)
                          if (userSubmission?.image_url) {
                            setSolutionImagePreview(userSubmission.image_url)
                          }
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </Card.Header>
                <Card.Body>
                  <p className="text-gray-700 whitespace-pre-wrap mb-3">
                    {userSubmission.content}
                  </p>
                  {userSubmission.image_url && (
                    <img src={userSubmission.image_url} alt="Solution" className="max-w-full max-h-64 rounded-lg border mb-3" />
                  )}
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
                    onSubmitComment={(img?: File | null) => handleSubmitComment(userSubmission.id, img)}
                    isSubmitting={submittingComment[userSubmission.id] || false}
                    formatTimeAgo={formatTimeAgo}
                    showTitle={true}
                    allowImage={true}
                  />
                </Card.Body>
              </Card>

              {!userSubmission?.is_locked && (
                <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl text-center">
                  <p className="text-gray-700 mb-3">
                    🔒 Want to see what other students wrote?
                  </p>
                  <Button onClick={handleRevealOthers} size="sm">
                    🔓 Reveal Others&apos; Solutions
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    ⚠️ This will lock your submission and grade
                  </p>
                </div>
              )}
              </>
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
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      📷 Attach Image (Optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        setSolutionImage(file)
                        if (file) {
                          setSolutionImagePreview(URL.createObjectURL(file))
                        } else {
                          setSolutionImagePreview(null)
                        }
                      }}
                      className="text-sm text-gray-600"
                    />
                    {solutionImagePreview && (
                      <div className="mt-2 relative inline-block">
                        <img src={solutionImagePreview} alt="Preview" className="max-h-40 rounded-lg border" />
                        <button
                          type="button"
                          onClick={() => { setSolutionImage(null); setSolutionImagePreview(null) }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs"
                        >✕</button>
                      </div>
                    )}
                  </div>
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
                              {submission.profiles.nickname || submission.profiles.full_name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatTimeAgo(submission.submitted_at)}
                            </p>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap mb-3">
                            {submission.content}
                          </p>
                          {submission.image_url && (
                            <img src={submission.image_url} alt="Solution" className="max-w-full max-h-64 rounded-lg border mb-3" />
                          )}
                          
                          {/* Grading - Teacher only */}
                          {isTeacher && (
                            submission.is_locked ? (
                              <div className="flex items-center gap-2 mb-3 p-3 bg-gray-100 rounded-lg border-2 border-gray-300">
                                <span className="text-sm font-bold text-gray-700">📝 Grade:</span>
                                <span className="text-sm font-bold">{submission.points ?? '—'}/100</span>
                                <span className="text-xs text-orange-600 font-medium">🔒 Student locked their grade</span>
                              </div>
                            ) : (
                            <div className="flex items-center gap-2 mb-3 p-3 bg-yellow-50 rounded-lg border-2 border-yellow-200 flex-wrap">
                              <span className="text-sm font-bold text-gray-700">📝 Grade:</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                defaultValue={submission.points ?? undefined}
                                id={`grade-${submission.id}`}
                                className="w-20 px-3 py-2 border-2 border-gray-300 rounded-lg text-center text-sm font-bold focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                                placeholder="0"
                              />
                              <span className="text-sm font-medium text-gray-500">/ 100</span>
                              <button
                                onClick={() => {
                                  const input = document.getElementById(`grade-${submission.id}`) as HTMLInputElement
                                  const val = input?.value
                                  if (val === '') return alert('Enter a score first')
                                  const num = Math.min(100, Math.max(0, parseInt(val)))
                                  handleGradeSubmission(submission.id, num)
                                  alert(`✅ Grade saved: ${num}/100`)
                                }}
                                className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                              >
                                Publish Grade
                              </button>
                              {submission.points != null && (
                                <span className="text-xs text-green-600 font-medium">Current: {submission.points}/100</span>
                              )}
                            </div>
                            )
                          )}
                          {/* Show points to students */}
                          {!isTeacher && submission.points != null && (
                            <div className="mb-3 px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium inline-block">
                              Score: {submission.points}/100
                            </div>
                          )}

                          <CommentThread
                            submissionId={submission.id}
                            comments={comments[submission.id] || []}
                            visibleCount={visibleComments[submission.id] || COMMENTS_INCREMENT}
                            onShowMore={() => handleShowMoreComments(submission.id)}
                            newComment={newComment[submission.id] || ''}
                            onCommentChange={(value) => setNewComment(prev => ({ ...prev, [submission.id]: value }))}
                            onSubmitComment={(img?: File | null) => handleSubmitComment(submission.id, img)}
                            isSubmitting={submittingComment[submission.id] || false}
                            formatTimeAgo={formatTimeAgo}
                            showTitle={false}
                            allowImage={true}
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
          // Must submit first OR must choose to reveal
          <Card className="bg-gray-50 border-2 border-dashed border-gray-300">
            <Card.Body className="text-center py-12">
              <div className="text-6xl mb-4">🔒</div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">
                Other Students' Solutions
              </h3>
              {hasSubmitted ? (
                <>
                  <p className="text-gray-600 mb-4">
                    Want to see what others wrote? This will lock your submission and current grade.
                  </p>
                  <Button onClick={handleRevealOthers}>
                    🔓 Reveal Others' Solutions
                  </Button>
                  <p className="text-xs text-gray-500 mt-3">
                    ⚠️ You won't be able to edit your answer after revealing
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gray-600 mb-4">
                    Submit your solution first!
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <span>👥</span>
                    <span>{totalSubmissionCount} {totalSubmissionCount === 1 ? 'student has' : 'students have'} submitted</span>
                  </div>
                </>
              )}
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
