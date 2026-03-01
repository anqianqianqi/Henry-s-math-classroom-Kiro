'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Challenge {
  id: string
  title: string
  description: string
  challenge_date: string
  created_by: string
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

  useEffect(() => {
    loadChallenge()
  }, [params.id])

  async function loadChallenge() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    setUserId(user.id)

    // Check if user is teacher
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .is('class_id', null)

    if (roles && roles.length > 0) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .in('id', roles.map((r: any) => r.role_id))

      const hasTeacherRole = roleData?.some((r: any) => r.name === 'teacher')
      setIsTeacher(hasTeacherRole || false)
    }

    // Load challenge
    const { data: challengeData } = await supabase
      .from('daily_challenges')
      .select('*')
      .eq('id', params.id)
      .single()

    setChallenge(challengeData)

    // Load user's submission
    const { data: submissionData } = await supabase
      .from('challenge_submissions')
      .select(`
        *,
        profiles!inner(full_name)
      `)
      .eq('challenge_id', params.id)
      .eq('user_id', user.id)
      .single()

    if (submissionData) {
      setUserSubmission(submissionData)
      setSolution(submissionData.content)
      
      // Load other submissions only if user has submitted or is teacher
      await loadOtherSubmissions(user.id)
    }

    setLoading(false)
  }

  async function loadOtherSubmissions(currentUserId: string) {
    const { data: submissions } = await supabase
      .from('challenge_submissions')
      .select(`
        *,
        profiles!inner(full_name)
      `)
      .eq('challenge_id', params.id)
      .neq('user_id', currentUserId)
      .order('submitted_at', { ascending: false })

    setOtherSubmissions(submissions || [])
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
            <p className="text-gray-700 whitespace-pre-wrap">
              {challenge.description}
            </p>
          </Card.Body>
        </Card>

        {/* Submission Section */}
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
              <p className="text-sm text-gray-500">
                Submitted {formatTimeAgo(userSubmission.submitted_at)}
              </p>
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

        {/* Other Submissions Section */}
        {canSeeOthers ? (
          // Unlocked: Show other submissions
          <Card>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <span>💬</span>
                Other Students' Solutions ({otherSubmissions.length})
              </Card.Title>
            </Card.Header>
            <Card.Body>
              {otherSubmissions.length > 0 ? (
                <div className="space-y-4">
                  {otherSubmissions.map(submission => (
                    <div
                      key={submission.id}
                      className="p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 
                               transition-colors"
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
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {submission.content}
                          </p>
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
                <span>{otherSubmissions.length} students have submitted</span>
              </div>
            </Card.Body>
          </Card>
        )}
      </main>
    </div>
  )
}
