'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import NotificationBell from '@/components/NotificationBell'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isTeacher, setIsTeacher] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [stats, setStats] = useState({
    classesCount: 0,
    challengesCount: 0,
    dayStreak: 0,
    pendingRequests: 0
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      router.push('/login')
      return
    }

    setUser(user)

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setProfile(profile)

    // Check if user is a teacher - using RPC for reliable role check
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .is('class_id', null)

    console.log('User roles:', { userRoles, rolesError, userId: user.id })

    let hasTeacherRole = false
    let hasAdminRole = false

    if (userRoles && userRoles.length > 0) {
      // Get role names
      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .in('id', userRoles.map((r: any) => r.role_id))

      console.log('Role names:', roleData)
      hasTeacherRole = roleData?.some((r: any) => r.name === 'teacher') || false
      hasAdminRole = roleData?.some((r: any) => r.name === 'administrator') || false
      console.log('Is teacher?', hasTeacherRole, 'Is admin?', hasAdminRole)
      setIsTeacher(hasTeacherRole)
      setIsAdmin(hasAdminRole)
    } else {
      setIsTeacher(false)
      setIsAdmin(false)
    }

    // Load stats
    await loadStats(user.id)

    setLoading(false)
  }

  async function loadStats(userId: string) {
    try {
      // Count classes where user is teacher (created_by) or member (class_members)
      const { count: teachingCount } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', userId)

      const { count: memberCount } = await supabase
        .from('class_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      const classesCount = (teachingCount || 0) + (memberCount || 0)

      // Count challenges assigned to user's classes or created by user
      const { data: userClassIds } = await supabase
        .from('class_members')
        .select('class_id')
        .eq('user_id', userId)

      const { data: teachingClassIds } = await supabase
        .from('classes')
        .select('id')
        .eq('created_by', userId)

      const allClassIds = [
        ...(userClassIds?.map(m => m.class_id) || []),
        ...(teachingClassIds?.map(c => c.id) || [])
      ]

      let challengesCount = 0
      if (allClassIds.length > 0) {
        const { count } = await supabase
          .from('challenge_assignments')
          .select('challenge_id', { count: 'exact', head: true })
          .in('class_id', allClassIds)
        challengesCount = count || 0
      }

      // Calculate day streak from challenge submissions
      const { data: submissions, error: submissionsError } = await supabase
        .from('challenge_submissions')
        .select('submitted_at')
        .eq('student_id', userId)
        .order('submitted_at', { ascending: false })

      console.log('🔥 Streak Debug - Submissions:', submissions?.length, 'Error:', submissionsError)
      console.log('🔥 Streak Debug - Raw submissions:', submissions)

      let dayStreak = 0
      if (submissions && submissions.length > 0) {
        // Calculate streak by checking consecutive days
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        console.log('🔥 Streak Debug - Today:', today)
        
        const submissionDates = submissions.map(s => {
          const date = new Date(s.submitted_at)
          date.setHours(0, 0, 0, 0)
          console.log('🔥 Streak Debug - Submission date:', s.submitted_at, '→', date)
          return date.getTime()
        })
        
        // Remove duplicates (multiple submissions on same day)
        const uniqueDates = [...new Set(submissionDates)].sort((a, b) => b - a)
        console.log('🔥 Streak Debug - Unique dates:', uniqueDates.map(d => new Date(d).toLocaleDateString()))
        
        // Check if there's a submission today or yesterday (streak can continue)
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        
        let currentDate = today.getTime()
        const hasSubmissionToday = uniqueDates.includes(today.getTime())
        const hasSubmissionYesterday = uniqueDates.includes(yesterday.getTime())
        
        console.log('🔥 Streak Debug - Has submission today?', hasSubmissionToday)
        console.log('🔥 Streak Debug - Has submission yesterday?', hasSubmissionYesterday)
        
        if (!hasSubmissionToday && !hasSubmissionYesterday) {
          // No submission today or yesterday, streak is broken
          console.log('🔥 Streak Debug - Streak broken (no submission today or yesterday)')
          dayStreak = 0
        } else {
          // Start from yesterday if no submission today, otherwise start from today
          if (!hasSubmissionToday) {
            currentDate = yesterday.getTime()
          }
          
          console.log('🔥 Streak Debug - Starting from:', new Date(currentDate).toLocaleDateString())
          
          // Count consecutive days
          for (const dateTime of uniqueDates) {
            console.log('🔥 Streak Debug - Checking:', new Date(dateTime).toLocaleDateString(), 'vs', new Date(currentDate).toLocaleDateString())
            if (dateTime === currentDate) {
              dayStreak++
              console.log('🔥 Streak Debug - Match! Streak now:', dayStreak)
              currentDate -= 24 * 60 * 60 * 1000 // Go back one day
            } else if (dateTime < currentDate) {
              // Gap found, stop counting
              console.log('🔥 Streak Debug - Gap found, stopping')
              break
            }
          }
        }
      }

      console.log('🔥 Streak Debug - Final streak:', dayStreak)

      // Count pending join requests for teacher's classes
      let pendingRequests = 0
      if (teachingClassIds && teachingClassIds.length > 0) {
        const { count } = await supabase
          .from('class_join_requests')
          .select('*', { count: 'exact', head: true })
          .in('class_id', teachingClassIds.map(c => c.id))
          .eq('status', 'pending')
        pendingRequests = count || 0
      }

      const newStats = {
        classesCount: classesCount || 0,
        challengesCount: challengesCount || 0,
        dayStreak,
        pendingRequests
      }

      console.log('Setting stats:', newStats)
      setStats(newStats)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const firstName = profile?.nickname || profile?.full_name?.split(' ')[0] || 'there'

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📚</span>
              <h1 className="text-2xl font-bold text-gray-900">Henry&apos;s Math Classroom</h1>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <button
                onClick={() => router.push('/settings')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Settings"
              >
                <span className="text-2xl">⚙️</span>
              </button>
              <span className="text-gray-600 font-medium">
                {profile?.nickname || profile?.full_name || user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium rounded-xl hover:bg-gray-100 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-primary-500 to-accent-blue rounded-3xl p-8 mb-8 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">👋</span>
            <h2 className="text-3xl font-bold">Welcome back, {firstName}!</h2>
          </div>
          <p className="text-xl text-white/90">
            {isTeacher ? "Let's inspire some students today!" : "Let's learn some math today!"}
          </p>
          {isTeacher && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
              <span>👨‍🏫</span>
              <span className="font-semibold">Teacher Account</span>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card 
            className="text-center cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push('/classes')}
          >
            <Card.Body>
              <div className="text-5xl mb-3">📚</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.classesCount}</div>
              <div className="text-gray-600 font-medium">Classes</div>
            </Card.Body>
          </Card>

          <Card 
            className="text-center cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push('/challenges')}
          >
            <Card.Body>
              <div className="text-5xl mb-3">🎯</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.challengesCount}</div>
              <div className="text-gray-600 font-medium">Challenges</div>
            </Card.Body>
          </Card>
        </div>

        {/* Join Requests - Teacher only */}
        {isTeacher && stats.pendingRequests > 0 && (
          <Card 
            className="mb-8 cursor-pointer hover:shadow-lg transition-shadow border-orange-200 bg-orange-50"
            onClick={() => router.push('/join-requests')}
          >
            <Card.Body>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">📋</span>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {stats.pendingRequests} Pending Join Request{stats.pendingRequests !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-gray-600">Students are waiting to join your classes</p>
                  </div>
                </div>
                <span className="text-gray-400">→</span>
              </div>
            </Card.Body>
          </Card>
        )}

        {/* Quick Actions - Hidden for now */}
        {false && (
        <Card className="mb-8">
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <span>⚡</span>
              Quick Actions
            </Card.Title>
          </Card.Header>
          <Card.Body>
            {isTeacher ? (
              // Teacher Quick Actions
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={() => router.push('/classes/new')}
                  className="h-20 text-lg"
                  fullWidth
                >
                  <span className="mr-2">➕</span>
                  Create Class
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => router.push('/challenges/new')}
                  className="h-20 text-lg"
                  fullWidth
                >
                  <span className="mr-2">🎯</span>
                  New Challenge
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => router.push('/materials/upload')}
                  className="h-20 text-lg"
                  fullWidth
                >
                  <span className="mr-2">📝</span>
                  Upload Material
                </Button>
              </div>
            ) : (
              // Student Quick Actions
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={() => router.push('/classes')}
                  className="h-20 text-lg"
                  fullWidth
                >
                  <span className="mr-2">📚</span>
                  My Classes
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => router.push('/challenges')}
                  className="h-20 text-lg"
                  fullWidth
                >
                  <span className="mr-2">🎯</span>
                  Today&apos;s Challenge
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => router.push('/materials')}
                  className="h-20 text-lg"
                  fullWidth
                >
                  <span className="mr-2">📖</span>
                  Study Materials
                </Button>
              </div>
            )}
          </Card.Body>
        </Card>
        )}

        {/* Featured: Explore Classes */}
        <Card 
          className="cursor-pointer mb-6 bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0 shadow-xl hover:shadow-2xl transition-all"
          onClick={() => router.push('/classes/explore')}
        >
          <Card.Body className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-4xl">🌍</span>
                  <h3 className="text-2xl font-bold">Explore Classes</h3>
                </div>
                <p className="text-white/90 text-lg">
                  Discover amazing learning opportunities from teachers around the world
                </p>
              </div>
              <div className="text-6xl opacity-20">
                →
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Main Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/classes')}>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <span className="text-2xl">📚</span>
                My Classes
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <p className="text-gray-600">
                View and manage your classes
              </p>
            </Card.Body>
            <Card.Footer>
              <span className="text-primary-600 hover:text-primary-700 font-semibold text-sm">
                View Classes →
              </span>
            </Card.Footer>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/challenges')}>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                Daily Challenge
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <p className="text-gray-600">
                Today&apos;s math challenge
              </p>
            </Card.Body>
            <Card.Footer>
              <span className="text-primary-600 hover:text-primary-700 font-semibold text-sm">
                View Challenge →
              </span>
            </Card.Footer>
          </Card>
        </div>
      </main>
    </div>
  )
}
