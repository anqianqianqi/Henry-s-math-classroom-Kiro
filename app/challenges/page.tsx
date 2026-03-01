'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Challenge {
  id: string
  title: string
  description: string
  challenge_date: string
  created_at: string
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadChallenges()
  }, [])

  async function loadChallenges() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    // Get user's classes
    const { data: classMembers, error: classMembersError } = await supabase
      .from('class_members')
      .select('class_id')
      .eq('user_id', user.id)

    console.log('Class members:', classMembers, 'Error:', classMembersError)

    const classIds = classMembers?.map(cm => cm.class_id) || []

    if (classIds.length === 0) {
      console.log('No classes found for user')
      setLoading(false)
      return
    }

    // Get challenges assigned to user's classes
    const { data: assignments, error: assignmentsError } = await supabase
      .from('challenge_assignments')
      .select('challenge_id')
      .in('class_id', classIds)

    console.log('Assignments:', assignments, 'Error:', assignmentsError)

    const challengeIds = assignments?.map(a => a.challenge_id) || []

    if (challengeIds.length === 0) {
      console.log('No challenge assignments found')
      setLoading(false)
      return
    }

    // Get challenge details
    const { data: challengesData, error: challengesError } = await supabase
      .from('daily_challenges')
      .select('*')
      .in('id', challengeIds)
      .order('challenge_date', { ascending: false })

    console.log('Challenges:', challengesData, 'Error:', challengesError)

    setChallenges(challengesData || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🎯</div>
          <p className="text-gray-600">Loading challenges...</p>
        </div>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const todayChallenge = challenges.find(c => c.challenge_date === today)

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
            >
              ← Back
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎯</span>
              <h1 className="text-2xl font-bold text-gray-900">Daily Challenges</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Today's Challenge */}
        {todayChallenge ? (
          <Card className="mb-8 border-2 border-primary-500">
            <Card.Header>
              <div className="flex items-center justify-between">
                <Card.Title className="flex items-center gap-2">
                  <span>🔥</span>
                  Today's Challenge
                </Card.Title>
                <span className="text-sm text-primary-600 font-semibold">
                  Active Now
                </span>
              </div>
            </Card.Header>
            <Card.Body>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {todayChallenge.title}
              </h3>
              <p className="text-gray-600 mb-4 line-clamp-2">
                {todayChallenge.description}
              </p>
              <Button
                onClick={() => router.push(`/challenges/${todayChallenge.id}`)}
                fullWidth
              >
                <span className="mr-2">🚀</span>
                Start Challenge
              </Button>
            </Card.Body>
          </Card>
        ) : (
          <Card className="mb-8 bg-gray-50">
            <Card.Body className="text-center py-8">
              <div className="text-5xl mb-3">😴</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No Challenge Today
              </h3>
              <p className="text-gray-600">
                Check back tomorrow for a new challenge!
              </p>
            </Card.Body>
          </Card>
        )}

        {/* Past Challenges */}
        {challenges.filter(c => c.challenge_date !== today).length > 0 && (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>📚</span>
              Past Challenges
            </h2>
            <div className="space-y-4">
              {challenges
                .filter(c => c.challenge_date !== today)
                .map(challenge => (
                  <Card
                    key={challenge.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => router.push(`/challenges/${challenge.id}`)}
                  >
                    <Card.Body>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {challenge.title}
                          </h3>
                          <p className="text-sm text-gray-600 line-clamp-1 mb-2">
                            {challenge.description}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(challenge.challenge_date).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                        <span className="text-2xl ml-4">→</span>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
            </div>
          </>
        )}

        {challenges.length === 0 && (
          <Card className="bg-gray-50">
            <Card.Body className="text-center py-12">
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">
                No Challenges Yet
              </h3>
              <p className="text-gray-600">
                Your teacher will post challenges soon!
              </p>
            </Card.Body>
          </Card>
        )}
      </main>
    </div>
  )
}
