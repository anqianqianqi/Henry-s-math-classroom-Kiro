'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import NotificationBell from '@/components/NotificationBell'
import { localDateString } from '@/lib/utils/date'
import dynamicImport from 'next/dynamic'

const InlinePet = dynamicImport(() => import('@/components/desktop-pet/InlinePet'), { ssr: false })

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isTeacher, setIsTeacher] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [ungradedCount, setUngradedCount] = useState(0)
  const [stats, setStats] = useState({
    classesCount: 0,
    challengesCount: 0,
    dayStreak: 0,
    pendingRequests: 0,
    totalScore: 0,
    spendableBalance: 0,
  })
  const [todayChallenges, setTodayChallenges] = useState<Array<{ id: string; title: string; challenge_date: string; submitted: boolean; submissionId?: string; hasNewTeacherComment?: boolean }>>([])
  const [petRoomBgUrl, setPetRoomBgUrl] = useState<string | null>(null)
  const [petRoomFrameUrl, setPetRoomFrameUrl] = useState<string | null>(null)
  const [petRoomFrameSlot, setPetRoomFrameSlot] = useState<{ x: number; y: number; w: number; h: number; rotate?: number } | null>(null)
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null) // latest blindbox image this user owns
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

    // Load pet room background
    try {
      const { data: userRoom } = await supabase
        .from('user_pet_room')
        .select('background_id')
        .eq('user_id', user.id)
        .maybeSingle()

      let bgId = userRoom?.background_id ?? null

      if (!bgId) {
        // Fall back to the default room
        const { data: defaultRoom } = await supabase
          .from('pet_room_backgrounds')
          .select('id')
          .eq('is_default', true)
          .eq('is_active', true)
          .maybeSingle()
        bgId = defaultRoom?.id ?? null
      }

      if (bgId) {
        const { data: bg } = await supabase
          .from('pet_room_backgrounds')
          .select('image_url, is_active, frame_overlay_url, frame_slot')
          .eq('id', bgId)
          .maybeSingle()
        // Only show if the room is still active — deactivated rooms are hidden even for owners
        if (bg?.image_url && bg.is_active) {
          setPetRoomBgUrl(bg.image_url)
          setPetRoomFrameUrl(bg.frame_overlay_url ?? null)
          setPetRoomFrameSlot(bg.frame_slot ?? null)
        }
      }

      // Load user's most recent blindbox image for the wall frame
      try {
        const { data: latestBlindbox } = await supabase
          .from('redemptions')
          .select('blindbox_image_url:item_id(image_url)')
          .eq('user_id', user.id)
          .is('refunded_at', null)
          .not('blindbox_image_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        // Also check blindbox_draws for the actual drawn image
        const { data: latestDraw } = await supabase
          .from('redemptions')
          .select('id, item_id, created_at')
          .eq('user_id', user.id)
          .is('refunded_at', null)
          .order('created_at', { ascending: false })
          .limit(5)
        // Find latest redemption with a blindbox image
        if (latestDraw && latestDraw.length > 0) {
          const redemptionIds = latestDraw.map((r: any) => r.id)
          const { data: draws } = await supabase
            .from('blindbox_draws')
            .select('image_url')
            .in('redemption_id', redemptionIds)
            .order('drawn_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if ((draws as any)?.image_url) setUserPhotoUrl((draws as any).image_url)
        }
      } catch (_) {
        // blindbox_draws may not exist — ignore
      }
    } catch (_) {
      // pet_room_backgrounds table may not exist yet — ignore
    }

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

        // Count ungraded homework submissions for teacher's assignments
        try {
          const { data: teacherAssignments } = await supabase
            .from('homework_assignments')
            .select('id')
            .eq('created_by', userId)

          if (teacherAssignments && teacherAssignments.length > 0) {
            const assignmentIds = teacherAssignments.map((a: any) => a.id)
            const { data: submissions } = await supabase
              .from('homework_submissions')
              .select('id')
              .in('assignment_id', assignmentIds)

            if (submissions && submissions.length > 0) {
              const subIds = submissions.map((s: any) => s.id)
              const { data: gradedIds } = await supabase
                .from('homework_grades')
                .select('submission_id')
                .in('submission_id', subIds)
                .eq('status', 'published')
              const gradedSet = new Set((gradedIds || []).map((g: any) => g.submission_id))
              setUngradedCount(subIds.filter((id: string) => !gradedSet.has(id)).length)
            }
          }
        } catch { /* ignore — homework tables may not exist */ }

        const newStats = {
          classesCount: classesCount || 0,
          challengesCount: challengesCount || 0,
          dayStreak: 0,
          pendingRequests: pendingRequests || 0,
          totalScore: 0,
          spendableBalance: 0,
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

      // Read total score and spendable balance from student_wallets (single row read)
      let totalScore = 0
      let spendableBalance = 0
      try {
        const { data: walletData } = await supabase
          .from('student_wallets')
          .select('total_earned, spendable_balance')
          .eq('user_id', userId)
          .single()

        if (walletData) {
          totalScore = walletData.total_earned ?? 0
          spendableBalance = walletData.spendable_balance ?? 0
        } else {
          // Fallback: wallet not yet created, compute on the fly
          const { data: gradedSubmissions } = await supabase
            .from('challenge_submissions')
            .select('points')
            .eq('user_id', userId)
            .not('points', 'is', null)
          totalScore = gradedSubmissions?.reduce((sum: number, s: any) => sum + (s.points || 0), 0) || 0
          spendableBalance = totalScore
        }
      } catch {
        // If wallet table doesn't exist yet, fall back to submission sum
        const { data: gradedSubmissions } = await supabase
          .from('challenge_submissions')
          .select('points')
          .eq('user_id', userId)
          .not('points', 'is', null)
        totalScore = gradedSubmissions?.reduce((sum: number, s: any) => sum + (s.points || 0), 0) || 0
        spendableBalance = totalScore
      }

      const newStats = {
        classesCount: memberCount || 0,
        challengesCount,
        dayStreak,
        pendingRequests: 0,
        totalScore,
        spendableBalance,
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

  const [expandedChallenges, setExpandedChallenges] = useState(false)
  const CHALLENGES_COLLAPSED = 3

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
        return
      }

      // ── Student path ──
      const { data: classIds } = await supabase
        .from('class_members')
        .select('class_id')
        .eq('user_id', userId)

      let classAssignedIds: string[] = []
      if (classIds && classIds.length > 0) {
        const { data: assignments } = await supabase
          .from('challenge_assignments')
          .select('challenge_id')
          .in('class_id', classIds.map((m: any) => m.class_id))
        classAssignedIds = assignments?.map((a: any) => a.challenge_id) || []
      }

      const { data: individualAssignments } = await supabase
        .from('challenge_student_assignments')
        .select('challenge_id')
        .eq('student_id', userId)
      const individualIds = individualAssignments?.map((a: any) => a.challenge_id) || []

      const allAssignedIds = [...new Set([...classAssignedIds, ...individualIds])]
      if (allAssignedIds.length === 0) return

      // 1. All submissions by this student for their assigned challenges
      const { data: submissions } = await supabase
        .from('challenge_submissions')
        .select('id, challenge_id')
        .in('challenge_id', allAssignedIds)
        .eq('user_id', userId)
      if (!submissions || submissions.length === 0) return

      const submittedMap = new Map((submissions).map((s: any) => [s.challenge_id, s.id]))
      const submissionIds = submissions.map((s: any) => s.id)

      // 2. Find teacher/admin user IDs
      let teacherUserIds: string[] = []
      try {
        const { data: teacherRoleRows } = await supabase
          .from('roles').select('id').in('name', ['teacher', 'administrator'])
        const teacherRoleIds = (teacherRoleRows || []).map((r: any) => r.id)
        if (teacherRoleIds.length > 0) {
          const { data: teacherUserRows } = await supabase
            .from('user_roles').select('user_id')
            .in('role_id', teacherRoleIds).is('class_id', null)
          teacherUserIds = [...new Set((teacherUserRows || []).map((r: any) => r.user_id))]
        }
      } catch (_) {}

      // 3. Get latest teacher comment per submission
      const latestTeacherCommentAt: Record<string, string> = {} // submissionId → ISO timestamp
      if (teacherUserIds.length > 0 && submissionIds.length > 0) {
        try {
          const { data: teacherComments } = await supabase
            .from('submission_comments')
            .select('submission_id, created_at')
            .in('submission_id', submissionIds)
            .in('user_id', teacherUserIds)
            .order('created_at', { ascending: false })
          for (const c of teacherComments || []) {
            if (!latestTeacherCommentAt[c.submission_id]) {
              latestTeacherCommentAt[c.submission_id] = c.created_at
            }
          }
        } catch (_) {}
      }

      // 4. Use localStorage to check if student has seen the comment
      //    Key: `comment_seen_${submissionId}` → ISO timestamp of last visit
      function isCommentUnread(submissionId: string): boolean {
        const commentAt = latestTeacherCommentAt[submissionId]
        if (!commentAt) return false
        try {
          const seenAt = localStorage.getItem(`comment_seen_${submissionId}`)
          if (!seenAt) return true
          return new Date(commentAt) > new Date(seenAt)
        } catch (_) { return true }
      }

      // 5. Load today's challenges
      const { data: todayChallengesData } = await supabase
        .from('daily_challenges')
        .select('id, title, challenge_date')
        .in('id', allAssignedIds)
        .eq('challenge_date', today)
        .order('created_at', { ascending: false })

      // 6. Load past challenges that have an unread teacher comment
      //    (submitted + has comment that was posted after student last viewed)
      const submittedChallengeIds = submissions.map((s: any) => s.challenge_id)
      const submissionsWithUnreadComment = submissions.filter(
        (s: any) => isCommentUnread(s.id)
      )
      const pastChallengeIdsWithComment = submissionsWithUnreadComment
        .map((s: any) => s.challenge_id)
        .filter((id: string) => !(todayChallengesData || []).find((c: any) => c.id === id))

      let pastChallenges: any[] = []
      if (pastChallengeIdsWithComment.length > 0) {
        const { data: pastData } = await supabase
          .from('daily_challenges')
          .select('id, title, challenge_date')
          .in('id', pastChallengeIdsWithComment)
          .order('challenge_date', { ascending: false })
          .limit(10)
        pastChallenges = pastData || []
      }

      const allChallenges = [
        ...(todayChallengesData || []),
        ...pastChallenges,
      ]

      setTodayChallenges(allChallenges.map((c: any) => {
        const submissionId = submittedMap.get(c.id)
        return {
          ...c,
          submitted: submittedMap.has(c.id),
          submissionId,
          hasNewTeacherComment: submissionId ? isCommentUnread(submissionId) : false,
        }
      }))
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
        {/* Hero row: Welcome + Today's Challenges on left half, pet area on right half */}
        <div className="flex gap-4 mb-8">
          {/* Left half: combined welcome + challenges card */}
          <div className="flex-1 min-w-0 bg-gradient-to-br from-primary-500 to-accent-blue rounded-3xl shadow-lg overflow-hidden">
            <div className="flex flex-col px-6 py-5 h-full">
              {/* Welcome text — centered at top */}
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-2xl">👋</span>
                  <h2 className="text-xl font-bold text-white">Welcome back, {firstName}!</h2>
                </div>
                <p className="text-white/75 text-sm">
                  {isTeacher ? "Let's inspire some students today! 👨‍🏫" : "Let's have fun with math today! 🎉"}
                </p>
              </div>

              {/* Today's challenges — full width within outer padding */}
              <div className="flex flex-col gap-2">
                {todayChallenges.length > 0 ? (
                  <>
                    {(expandedChallenges ? todayChallenges : todayChallenges.slice(0, CHALLENGES_COLLAPSED)).map(challenge => (
                      <button
                        key={challenge.id}
                        onClick={() => {
                          // Mark comment as seen
                          if (challenge.submissionId) {
                            try { localStorage.setItem(`comment_seen_${challenge.submissionId}`, new Date().toISOString()) } catch (_) {}
                          }
                          router.push(`/challenges/${challenge.id}`)
                        }}
                        className="text-left bg-white/15 hover:bg-white/25 rounded-xl px-4 py-2.5 group flex items-center justify-between transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                              {challenge.challenge_date === new Date().toISOString().split('T')[0] ? '🎯 Today' : `📅 ${challenge.challenge_date}`}
                            </span>
                            {!isTeacher && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                challenge.submitted ? 'bg-green-400/30 text-green-100' : 'bg-yellow-400/30 text-yellow-100'
                              }`}>
                                {challenge.submitted ? '✓ Done' : '⏳'}
                              </span>
                            )}
                            {!isTeacher && challenge.hasNewTeacherComment && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-blue-400/40 text-blue-100">
                                💬 New comment
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-white text-sm truncate">
                            {challenge.title}
                          </p>
                        </div>
                        <span className="text-white/50 group-hover:text-white ml-2 shrink-0 transition-colors">→</span>
                      </button>
                    ))}
                    {todayChallenges.length > CHALLENGES_COLLAPSED && (
                      <button
                        onClick={() => setExpandedChallenges(v => !v)}
                        className="text-[11px] text-white/60 hover:text-white text-left pl-1 transition-colors"
                      >
                        {expandedChallenges
                          ? '▲ Show less'
                          : `▼ +${todayChallenges.length - CHALLENGES_COLLAPSED} more`}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-white/60 text-sm pl-1">
                    <span className="text-2xl block mb-1">🎯</span>
                    No challenge today
                    {isTeacher && (
                      <button onClick={() => router.push('/challenges/new')} className="block text-xs text-white/80 hover:text-white mt-1 underline">
                        Create one →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right half: pet area — room+frame baked into background, user photo in frame_slot */}
          <div
            id="pet-area"
            className="flex-1 min-w-0 self-start rounded-3xl overflow-hidden relative"
            style={{
              minHeight: '400px',
              backgroundImage: petRoomBgUrl ? `url(${petRoomBgUrl})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center bottom',
            }}
          >
            {/* User's blindbox photo — clipped to the frame_slot area, rotated to match frame perspective */}
            {userPhotoUrl && petRoomFrameSlot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userPhotoUrl}
                alt="Wall photo"
                className="absolute object-cover"
                style={{
                  left: `${petRoomFrameSlot.x}%`,
                  top: `${petRoomFrameSlot.y}%`,
                  width: `${petRoomFrameSlot.w}%`,
                  height: `${petRoomFrameSlot.h}%`,
                  transform: petRoomFrameSlot.rotate ? `rotate(${petRoomFrameSlot.rotate}deg)` : undefined,
                  transformOrigin: 'center center',
                  pointerEvents: 'none',
                }}
              />
            )}

            <InlinePet />
          </div>
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

          {!isTeacher && !isAdmin && (
            <Card
              className="text-center cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/shop')}
            >
              <Card.Body>
                <div className="text-5xl mb-3 hidden sm:block">🛍️</div>
                <div className="text-3xl font-bold text-primary-600 mb-1">
                  {stats.spendableBalance}
                </div>
                <div className="text-gray-600 font-medium">Shop Balance</div>
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

          {/* Decorations hub — book skins, pet room, etc. */}
          <Card
            className="text-center cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push('/decorations')}
          >
            <Card.Body>
              <div className="text-5xl mb-3 hidden sm:block">🎨</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">Decorations</div>
              <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">Book &amp; Room</div>
            </Card.Body>
          </Card>
          {(isTeacher || isAdmin) && (
            <Card 
              className="text-center cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/admin/shop')}
            >
              <Card.Body>
                <div className="text-5xl mb-3 hidden sm:block">🛍️</div>
                <div className="text-3xl font-bold text-gray-900 mb-1">Shop</div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">Manage</div>
              </Card.Body>
            </Card>
          )}

          {/* Admin: Book Skins managed via Decorations hub */}

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

          {(isTeacher || isAdmin) && (
            <Card 
              className="text-center cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/students')}
            >
              <Card.Body>
                <div className="text-5xl mb-3 hidden sm:block">📊</div>
                <div className="text-3xl font-bold text-gray-900 mb-1">Students</div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">History</div>
              </Card.Body>
            </Card>
          )}

          {(isTeacher || isAdmin) && (
            <Card 
              className="text-center cursor-pointer hover:shadow-lg transition-shadow relative"
              onClick={() => router.push('/grading')}
            >
              <Card.Body>
                <div className="text-5xl mb-3 hidden sm:block">📝</div>
                <div className="text-3xl font-bold text-gray-900 mb-1">Grade</div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">Homework</div>
                {ungradedCount > 0 && (
                  <span className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {ungradedCount}
                  </span>
                )}
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
