'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import NotificationBell from '@/components/NotificationBell'
import { localDateString } from '@/lib/utils/date'

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
    pendingRequests: 0,
    totalScore: 0
  })
  const [todayChallenges, setTodayChallenges] = useState<Array<{ id: string; title: string; challenge_date: string; submitted: boolean }>>([])
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
      setIsTeacher(hasTeacherRole || hasAdminRole)
      setIsAdmin(hasAdminRole)
    } else {
      setIsTeacher(false)
      setIsAdmin(false)
    }

    // Load stats - pass role directly since setState is async
    await loadStats(user.id, hasTeacherRole || hasAdminRole)
    await loadTodayChallenge(user.id, hasTeacherRole || hasAdminRole)

    setLoading(false)
  }

  async function loadStats(userId: string, teacherRole: boolean = false) {
    try {
      if (teacherRole) {
        // Teachers see all classes and all challenges
        const { count: classesCount } = await supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })

        const { count: challengesCount } = await supabase
          .from('daily_challenges')
          .select('*', { count: 'exact', head: true })

        // Count pending join requests across all classes
        const { count: pendingRequests } = await supabase
          .from('class_join_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')

        const newStats = {
          classesCount: classesCount || 0,
          challengesCount: challengesCount || 0,
          dayStreak: 0,
          pendingRequests: pendingRequests || 0,
          totalScore: 0
        }
        setStats(newStats)
        return
      }

      // Students: count only their classes and challenges
      const { count: memberCount } = await supabase
        .from('class_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      const { data: userClassIds } = await supabase
        .from('class_members')
        .select('class_id')
        .eq('user_id', userId)

      let challengesCount = 0
      if (userClassIds && userClassIds.length > 0) {
        const { data: assignmentData } = await supabase
          .from('challenge_assignments')
          .select('challenge_id')
          .in('class_id', userClassIds.map(m => m.class_id))
        const allChallengeIds = [...new Set(assignmentData?.map(a => a.challenge_id) || [])]
        if (allChallengeIds.length > 0) {
          const today = localDateString()
          const { data: visibleChallenges } = await supabase
            .from('daily_challenges')
            .select('id')
            .in('id', allChallengeIds)
            .lte('challenge_date', today)
          challengesCount = visibleChallenges?.length || 0
        }
      }
      // Calculate day streak from challenge submissions
      const { data: submissions } = await supabase
        .from('challenge_submissions')
        .select('submitted_at')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false })

      let dayStreak = 0
      if (submissions && submissions.length > 0) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const submissionDates = submissions.map(s => {
          const date = new Date(s.submitted_at)
          date.setHours(0, 0, 0, 0)
          return date.getTime()
        })
        
        const uniqueDates = [...new Set(submissionDates)].sort((a, b) => b - a)
        
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        
        let currentDate = today.getTime()
        const hasSubmissionToday = uniqueDates.includes(today.getTime())
        const hasSubmissionYesterday = uniqueDates.includes(yesterday.getTime())
        
        if (hasSubmissionToday || hasSubmissionYesterday) {
          if (!hasSubmissionToday) {
            currentDate = yesterday.getTime()
          }
          
          for (const dateTime of uniqueDates) {
            if (dateTime === currentDate) {
              dayStreak++
              currentDate -= 24 * 60 * 60 * 1000
            } else if (dateTime < currentDate) {
              break
            }
          }
        }
      }

      // Calculate total score from graded submissions (locked or not)
      const { data: gradedSubmissions } = await supabase
        .from('challenge_submissions')
        .select('points')
        .eq('user_id', userId)
        .not('points', 'is', null)

      const totalScore = gradedSubmissions?.reduce((sum, s) => sum + (s.points || 0), 0) || 0

      const newStats = {
        classesCount: memberCount || 0,
        challengesCount,
        dayStreak,
        pendingRequests: 0,
        totalScore
      }

      setStats(newStats)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function loadTodayChallenge(userId: string, teacherRole: boolean) {
    try {
      const today = localDateString()

      if (teacherRole) {
        const { data } = await supabase
          .from('daily_challenges')
          .select('id, title, challenge_date')
          .eq('challenge_date', today)
          .order('created_at', { ascending: false })
        setTodayChallenges((data || []).map((c: any) => ({ ...c, submitted: false })))
      } else {
        const { data: classIds } = await supabase
          .from('class_members')
          .select('class_id')
          .eq('user_id', userId)

        // Get class-assigned challenge IDs
        let classAssignedIds: string[] = []
        if (classIds && classIds.length > 0) {
          const { data: assignments } = await supabase
            .from('challenge_assignments')
            .select('challenge_id')
            .in('class_id', classIds.map((m: any) => m.class_id))
          classAssignedIds = assignments?.map((a: any) => a.challenge_id) || []
        }

        // Get individually assigned challenge IDs
        const { data: individualAssignments } = await supabase
          .from('challenge_student_assignments')
          .select('challenge_id')
          .eq('student_id', userId)
        const individualIds = individualAssignments?.map((a: any) => a.challenge_id) || []

        const challengeIds = [...new Set([...classAssignedIds, ...individualIds])]
        if (challengeIds.length === 0) return

        const { data: challenges } = await supabase
          .from('daily_challenges')
          .select('id, title, challenge_date')
          .in('id', challengeIds)
          .eq('challenge_date', today)
          .order('created_at', { ascending: false })

        if (!challenges || challenges.length === 0) return

        // Check submissions for all challenges
        const { data: submissions } = await supabase
          .from('challenge_submissions')
          .select('challenge_id')
          .in('challenge_id', challenges.map((c: any) => c.id))
          .eq('user_id', userId)

        const submittedIds = new Set(submissions?.map((s: any) => s.challenge_id) || [])
        setTodayChallenges(challenges.map((c: any) => ({ ...c, submitted: submittedIds.has(c.id) })))
      }
    } catch (err) {
      console.error('Failed to load today challenges:', err)
    }
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

  const firstName = profile?.nickname || profile?.first_name || 'there'

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-3">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 hidden sm:block">Henry&apos;s Math Classroom</h1>
              <h1 className="text-lg font-bold text-gray-900 sm:hidden">Math Class</h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-4">
              <NotificationBell />
              <button
                onClick={() => router.push('/settings')}
                className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Settings"
              >
                Settings
              </button>
              <span className="text-gray-600 font-medium hidden sm:inline">
                {profile?.nickname || profile?.first_name || user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="px-2 sm:px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium rounded-xl hover:bg-gray-100 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome + Today's Challenge — side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Left: Welcome */}
          <div className="bg-gradient-to-br from-primary-500 to-accent-blue rounded-3xl px-6 py-7 text-white shadow-lg flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">👋</span>
              <h2 className="text-2xl sm:text-3xl font-bold">Welcome back,<br />{firstName}!</h2>
            </div>
            <p className="text-white/80 text-sm mt-1">
              {isTeacher ? "Let's inspire some students today! 👨‍🏫" : "Let's have fun with math today! 🎉"}
            </p>
          </div>

          {/* Right: Today's Challenges */}
          {todayChallenges.length > 0 ? (
            <div className="flex flex-col gap-3">
              {todayChallenges.slice(0, 4).map(challenge => (
                <button
                  key={challenge.id}
                  onClick={() => router.push(`/challenges/${challenge.id}`)}
                  className="text-left bg-white rounded-2xl shadow border-2 border-primary-100 hover:border-primary-400 hover:shadow-md transition-all px-5 py-4 group flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-widest text-primary-500">🎯 Today</span>
                      {!isTeacher && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          challenge.submitted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {challenge.submitted ? '✓ Done' : '⏳ Pending'}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-gray-900 text-sm sm:text-base truncate group-hover:text-primary-600 transition-colors">
                      {challenge.title}
                    </p>
                  </div>
                  <span className="text-gray-400 group-hover:text-primary-500 ml-3 shrink-0">→</span>
                </button>
              ))}
              {todayChallenges.length > 4 && (
                <button
                  onClick={() => router.push('/challenges')}
                  className="text-xs text-primary-600 hover:text-primary-800 text-center py-1"
                >
                  +{todayChallenges.length - 4} more → View all
                </button>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 p-6 flex flex-col justify-center">
              <span className="text-3xl mb-2">🎯</span>
              <p className="font-semibold text-gray-600 text-sm">No challenge today</p>
              {isTeacher && (
                <button onClick={() => router.push('/challenges/new')} className="text-xs text-primary-600 hover:text-primary-800 mt-1 text-left">
                  Create one →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <Card 
            className="text-center cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push('/classes')}
          >
            <Card.Body>
              <div className="text-5xl mb-3 hidden sm:block">📚</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.classesCount}</div>
              <div className="text-gray-600 font-medium">Classes</div>
            </Card.Body>
          </Card>

          <Card 
            className="text-center cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push('/challenges')}
          >
            <Card.Body>
              <div className="text-5xl mb-3 hidden sm:block">🎯</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.challengesCount}</div>
              <div className="text-gray-600 font-medium">Challenges</div>
            </Card.Body>
          </Card>

          {!isTeacher && !isAdmin && (
            <Card className="text-center hover:shadow-lg transition-shadow">
              <Card.Body>
                <div className="text-5xl mb-3 hidden sm:block">⭐</div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalScore}</div>
                <div className="text-gray-600 font-medium">Total Score</div>
              </Card.Body>
            </Card>
          )}

          <Card 
            className="text-center cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push('/classes/explore')}
          >
            <Card.Body>
              <div className="text-5xl mb-3 hidden sm:block">🌍</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">Explore</div>
              <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">Classes</div>
            </Card.Body>
          </Card>

          {(isTeacher || isAdmin) && (
            <Card 
              className="text-center cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/admin/roles')}
            >
              <Card.Body>
                <div className="text-5xl mb-3 hidden sm:block">👥</div>
                <div className="text-3xl font-bold text-gray-900 mb-1">User Roles</div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">Manage</div>
              </Card.Body>
            </Card>
          )}

          {(isTeacher || isAdmin) && (
            <Card 
              className="text-center cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/admin/tags')}
            >
              <Card.Body>
                <div className="text-5xl mb-3 hidden sm:block">🏷️</div>
                <div className="text-3xl font-bold text-gray-900 mb-1">Tags</div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">Manage</div>
              </Card.Body>
            </Card>
          )}

          {(isTeacher || isAdmin) && (
            <Card 
              className="text-center cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/admin/schedules')}
            >
              <Card.Body>
                <div className="text-5xl mb-3 hidden sm:block">📅</div>
                <div className="text-3xl font-bold text-gray-900 mb-1">Scheduler</div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">Manage</div>
              </Card.Body>
            </Card>
          )}

          {(isTeacher || isAdmin) && (
            <Card 
              className="text-center cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/admin/challenge-bank')}
            >
              <Card.Body>
                <div className="text-5xl mb-3 hidden sm:block">🏦</div>
                <div className="text-3xl font-bold text-gray-900 mb-1">Challenge Bank</div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">Manage</div>
              </Card.Body>
            </Card>
          )}
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
                  <span className="text-3xl hidden sm:inline">📋</span>
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

      </main>
    </div>
  )
}
