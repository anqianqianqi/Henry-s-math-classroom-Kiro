'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import NotificationBell from '@/components/NotificationBell'
import { AnnouncementButton } from '@/components/AnnouncementButton'
import { schoolDateString, convertOccurrence, zoneLabel, SCHOOL_TIMEZONE } from '@/lib/utils/timezone'
import { useViewerZone } from '@/components/ui/useViewerZone'
import dynamicImport from 'next/dynamic'
import StudentStudyCurve from '@/components/StudentStudyCurve'
import { WelcomeCard } from '@/components/dashboard/WelcomeCard'
import type { CalendarDay } from '@/components/dashboard/MonthCalendar'
import { ClassAssignmentModal } from '@/components/dashboard/ClassAssignmentModal'
import { DaySessionsModal } from '@/components/dashboard/DaySessionsModal'
import { TileHead } from '@/components/dashboard/TileHead'
import { DEFAULT_PALETTE_ID, paletteById } from '@/lib/ui/paperCard'
import { dashboardCardArt, dashboardCardFrame, type DashboardCardArt } from '@/lib/ui/dashboardCardArt'

// ── Study Curve section with lang toggle ────────────────────────────────────
function StudyCurveSection({ userId }: { userId: string }) {
  const [lang, setLang] = useState<'en' | 'zh'>('en')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('lang') as 'en' | 'zh' | null
      if (stored === 'en' || stored === 'zh') setLang(stored)
    } catch (_) {}
  }, [])

  function switchLang(next: 'en' | 'zh') {
    setLang(next)
    try { localStorage.setItem('lang', next) } catch (_) {}
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {lang === 'zh' ? '📊 我的学习曲线' : '📊 My Study Curve'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {lang === 'zh'
              ? '按主题查看得分与完成度 — 点击主题查看挑战题'
              : 'Score & completion breakdown by topic — click a topic to see challenges'}
          </p>
        </div>
        {/* Language toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => switchLang('en')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              lang === 'en' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => switchLang('zh')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              lang === 'zh' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            中文
          </button>
        </div>
      </div>
      <StudentStudyCurve userId={userId} lang={lang} />
    </div>
  )
}

const InlinePet = dynamicImport(() => import('@/components/desktop-pet/InlinePet'), { ssr: false })
const AnimatedRoomLayer = dynamicImport(() => import('@/components/pet-room/AnimatedRoomLayer'), { ssr: false })

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
    taScore: 0,
    taBalance: 0,
  })
  const [todayChallenges, setTodayChallenges] = useState<Array<{ id: string; title: string; challenge_date: string; submitted: boolean; submissionId?: string; hasNewTeacherComment?: boolean }>>([])

  /**
   * Questions this student asked that are still waiting.
   *
   * "Still waiting" is the bubble room's own definition, not a new one:
   * unresolved and not yet expired, exactly as MyBubblesPanel splits active
   * from completed and expired. A second definition living on the dashboard
   * would drift from the panel the first time either changed, and a student
   * would see a count that disagreed with the list it points at.
   *
   * Its own query rather than a ninth field on `stats`, which is built in two
   * places — one for teachers and one for students — and would need the same
   * count added to both.
   */
  const [openBubbles, setOpenBubbles] = useState(0)

  /*
    ── The welcome card's calendar ─────────────────────────────
    schoolToday rather than the browser's date: the outline has to agree with
    what the rest of the site calls today, which is the school's timezone.
  */
  const schoolToday = schoolDateString()
  const [paletteId, setPaletteId] = useState<string>(DEFAULT_PALETTE_ID)
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    () => new Date(Number(schoolToday.slice(0, 4)), Number(schoolToday.slice(5, 7)) - 1, 1),
  )
  const [calendarDays, setCalendarDays] = useState<Record<string, CalendarDay>>({})
  /*
    The challenge ids assigned to this student, hoisted out of loadTodayChallenge
    so the month query can reuse them. Resolving them costs four round trips —
    memberships, individual assignments, class assignments, roles — and they do
    not change while the reader steps back through months.

    null means "not resolved yet"; an empty array means "resolved, none".
  */
  const [assignedChallengeIds, setAssignedChallengeIds] = useState<string[] | null>(null)
  const palette = paletteById(paletteId)

  /*
    Authoring, teacher and admin only. `monthNonce` is bumped after any write so
    the month effect refetches — the alternative is threading a reload callback
    down through two components, and the effect already knows how to rebuild
    itself from scratch.
  */
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [editingDay, setEditingDay] = useState<string | null>(null)
  const [teacherClasses, setTeacherClasses] = useState<{ id: string; name: string }[]>([])
  const [monthNonce, setMonthNonce] = useState(0)
  const [petRoomBgUrl, setPetRoomBgUrl] = useState<string | null>(null)
  const [petRoomFrameUrl, setPetRoomFrameUrl] = useState<string | null>(null)
  const [petRoomFrameSlot, setPetRoomFrameSlot] = useState<{ x: number; y: number; w: number; h: number; rotate?: number; rotateY?: number; rotateX?: number } | null>(null)
  const [petRoomAnimZones, setPetRoomAnimZones] = useState<any[]>([])
  /**
   * The room picture's own width/height, e.g. 1.5 for a 1536x1024 room.
   *
   * Read from the file rather than stored, so a room uploaded at any shape is
   * shown at that shape without anyone recording its dimensions by hand. Null
   * until the image reports; see the note on #pet-area for why it matters.
   */
  const [petRoomAspect, setPetRoomAspect] = useState<number | null>(null)
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null) // latest blindbox image this user owns
  const router = useRouter()
  const supabase = createClient()
  const { t, language } = useLanguage()
  /*
    The painted background a tile wears, if it wears one.

    Bound here so each tile names only its picture: the palette rule and the
    reader's language are decided in one place, and a tile cannot get one of
    them right and the other wrong. Returns undefined for every palette but
    meadow, which is what leaves those cards exactly as they are today.
  */
  const cardArt = (art: DashboardCardArt) => dashboardCardArt(art, paletteId, language)
  /*
    The same painting with no word on it, shown while the card is pointed at.
    Which empty frame belongs to which card was measured, not guessed — see
    lib/ui/dashboardCardArt.ts.
  */
  const cardFrame = (art: DashboardCardArt) => dashboardCardFrame(art, paletteId)
  /*
    The reader's own clock, from their site setting.

    It does both jobs here. Sessions are shown converted into it, and anything
    a teacher schedules is stored as meaning it — so the time they type is the
    time they see, whichever class they are scheduling and wherever the teacher
    who owns that class happens to be.
  */
  const { timezone: viewerTimezone } = useViewerZone()

  useEffect(() => {
    loadUser()
  }, [])

  /*
    Counted with head:true, so the database returns the number and none of the
    rows — the tile needs a figure, not the questions themselves.

    `now` is read at query time rather than from a stored value: a bubble
    expires by the clock passing it, with nothing written to the row when it
    does, so anything cached would keep counting a question that has quietly
    gone stale.
  */
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function countOpenBubbles() {
      const { count } = await supabase
        .from('bubble_room_questions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('resolved_at', null)
        .gt('expires_at', new Date().toISOString())

      if (!cancelled) setOpenBubbles(count ?? 0)
    }

    // A missing count is a tile without a number, not an error worth showing.
    countOpenBubbles().catch(() => {})
    return () => { cancelled = true }
  }, [user?.id, supabase])

  async function loadUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      router.push('/login')
      return
    }

    setUser(user)

    // ── Parallel: profile + user_roles + card pigment ─────────────────────
    // The palette read is allowed to fail: add-dashboard-palette.sql may not
    // have been run yet, and a missing colour preference is a default, not an
    // error. Same shape as the other optional preference reads on this page.
    const [{ data: profile }, { data: userRoles, error: rolesError }, paletteResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('user_roles').select('role_id').eq('user_id', user.id).is('class_id', null),
      Promise.resolve(
        supabase.from('user_book_skin_preferences')
          .select('dashboard_palette').eq('user_id', user.id).maybeSingle(),
      ).catch(() => ({ data: null })),
    ])

    setProfile(profile)

    const storedPalette = (paletteResult as any)?.data?.dashboard_palette
    if (storedPalette) setPaletteId(storedPalette)

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

    // ── Show the page immediately — don't wait for stats/challenges/pet room ─
    // The page renders as soon as we have profile + role. Stats and challenges
    // populate in the background without blocking the initial paint.
    setLoading(false)

    // ── Parallel: stats + today's challenges + pet room (non-blocking) ────
    Promise.all([
      loadStats(user.id, hasTeacherRole || hasAdminRole),
      loadTodayChallenge(user.id, hasTeacherRole || hasAdminRole),
      loadPetRoom(user.id),
    ])
  }

  async function loadPetRoom(userId: string) {
    try {
      const { data: userRoom } = await supabase
        .from('user_pet_room')
        .select('background_id, selected_photo_url')
        .eq('user_id', userId)
        .maybeSingle()

      let bgId = userRoom?.background_id ?? null

      if (!bgId) {
        const { data: defaultRoom } = await supabase
          .from('pet_room_backgrounds')
          .select('id')
          .eq('is_default', true)
          .eq('is_active', true)
          .maybeSingle()
        bgId = defaultRoom?.id ?? null
      }

      if (bgId) {
        // Parallel: background data + animation zones
        const [{ data: bg }, { data: bgAnim }] = await Promise.all([
          supabase.from('pet_room_backgrounds')
            .select('image_url, is_active, frame_overlay_url, frame_slot')
            .eq('id', bgId).maybeSingle(),
          Promise.resolve(supabase.from('pet_room_backgrounds')
            .select('animation_zones')
            .eq('id', bgId).maybeSingle()).catch(() => ({ data: null })),
        ])
        if (bg?.image_url && bg.is_active) {
          setPetRoomBgUrl(bg.image_url)
          setPetRoomFrameUrl(bg.frame_overlay_url ?? null)
          setPetRoomFrameSlot(bg.frame_slot ?? null)
          setPetRoomAnimZones((bgAnim as any)?.animation_zones ?? [])
        }
      }

      if (userRoom?.selected_photo_url) {
        setUserPhotoUrl(userRoom.selected_photo_url)
      }
    } catch (_) {
      // pet_room_backgrounds table may not exist yet — ignore
    }
  }

  async function loadStats(userId: string, teacherRole: boolean = false) {
    try {
      if (teacherRole) {
        // Teachers see all classes and all challenges — run counts in parallel
        const [
          { count: classesCount },
          { count: challengesCount },
          { count: pendingRequests },
        ] = await Promise.all([
          supabase.from('classes').select('*', { count: 'exact', head: true }),
          supabase.from('daily_challenges').select('*', { count: 'exact', head: true }),
          supabase.from('class_join_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        ])

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
          taScore: 0,
          taBalance: 0,
        }
        setStats(newStats)
        return
      }

      // Students: count only their classes and challenges — run class membership + submissions + wallet in parallel
      const [
        { data: userClassMemberships },
        { data: submissionsForStreak },
        walletResult,
      ] = await Promise.all([
        supabase.from('class_members').select('class_id').eq('user_id', userId),
        supabase.from('challenge_submissions').select('submitted_at').eq('user_id', userId).order('submitted_at', { ascending: false }),
        Promise.resolve(supabase.from('student_wallets').select('total_earned, spendable_balance, ta_earned, ta_balance').eq('user_id', userId).single()).catch(() => ({ data: null })),
      ])

      const memberCount = userClassMemberships?.length ?? 0

      let challengesCount = 0
      if (userClassMemberships && userClassMemberships.length > 0) {
        const { data: assignmentData } = await supabase
          .from('challenge_assignments')
          .select('challenge_id')
          .in('class_id', userClassMemberships.map(m => m.class_id))
        const allChallengeIds = [...new Set(assignmentData?.map(a => a.challenge_id) || [])]
        if (allChallengeIds.length > 0) {
          const today = schoolDateString()
          const { data: visibleChallenges } = await supabase
            .from('daily_challenges')
            .select('id')
            .in('id', allChallengeIds)
            .lte('challenge_date', today)
          challengesCount = visibleChallenges?.length || 0
        }
      }

      // Calculate day streak from challenge submissions
      const submissions = submissionsForStreak

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

      // Read total score and spendable balance — already fetched in parallel above
      let totalScore = 0
      let spendableBalance = 0
      // Default 0 rather than undefined: before the migration runs these columns
      // do not exist, and the card should read 0 rather than blank.
      let taScore = 0
      let taBalance = 0
      try {
        const walletData = (walletResult as any)?.data
        if (walletData) {
          totalScore = walletData.total_earned ?? 0
          spendableBalance = walletData.spendable_balance ?? 0
          taScore = walletData.ta_earned ?? 0
          taBalance = walletData.ta_balance ?? 0
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
        taScore,
        taBalance,
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

  /**
   * Persist the chosen pigment, and keep the card responsive while it saves.
   *
   * The column is added by supabase/add-dashboard-palette.sql. Until that has
   * been run the write fails, and it is allowed to: the choice still applies for
   * this session, and a colour preference is not worth an error dialog. Same
   * shape as the other optional preference reads on this page.
   */
  async function handlePaletteChange(next: string) {
    setPaletteId(next)
    if (!user?.id) return
    try {
      await supabase.from('user_book_skin_preferences')
        .upsert({ user_id: user.id, dashboard_palette: next }, { onConflict: 'user_id' })
    } catch (_) { /* column not migrated yet — the choice still holds locally */ }
  }

  /*
    ── The visible month ───────────────────────────────────────
    Refetched when the reader steps back a month, and gated on the assignment
    ids being resolved so a student's first paint does not query `.in('id', [])`
    and then have to do it again.

    A teacher's calendar is a timetable and carries no problems, so their path
    skips the challenge queries entirely rather than fetching and discarding.
  */
  useEffect(() => {
    if (!user?.id) return
    if (!isTeacher && assignedChallengeIds === null) return

    let cancelled = false
    const y = calendarMonth.getFullYear()
    const m = calendarMonth.getMonth()
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    const from = `${y}-${pad(m + 1)}-01`
    const to = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`

    ;(async () => {
      const days: Record<string, CalendarDay> = {}
      const touch = (d: string) => (days[d] ||= { problems: [], classes: [] })

      // ── Classes ──────────────────────────────────────────
      // A student sees their own; a teacher sees every class running that day.
      let classIds: string[] | null = null
      if (!isTeacher) {
        const { data: memberships } = await supabase
          .from('class_members').select('class_id').eq('user_id', user.id)
        classIds = [...new Set((memberships || []).map((r: any) => r.class_id))]
      }

      if (classIds === null || classIds.length > 0) {
        // A teacher's rows carry what the day editor needs to write against;
        // a student's would never be read, but one query for both beats two
        // that differ by three columns.
        /*
          Fetched a day wider on each side than the month being shown.

          A session is stored on the date it happens in the zone it was written
          in, and the reader may be somewhere else: a 21:00 New York class is
          09:00 the NEXT morning in Shanghai. So the last session of the
          previous month can belong on the 1st for this reader, and the last of
          this month can leave it entirely. Fetching the exact month would drop
          the first of those and no one would notice from New York.
        */
        const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n))
        const asDate = (s: string, shift: number) => {
          const d = new Date(`${s}T12:00:00`)
          d.setDate(d.getDate() + shift)
          return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
        }

        let q = supabase
          .from('class_occurrences')
          .select('id, class_id, occurrence_date, status, series_id, start_time, end_time, timezone, classes:class_id(name, timezone)')
          .gte('occurrence_date', asDate(from, -1))
          .lte('occurrence_date', asDate(to, 1))
          .order('start_time', { ascending: true })
        if (classIds) q = q.in('class_id', classIds)
        const { data: occ } = await q

        for (const o of (occ || []) as any[]) {
          // The clock the time was written on. Falls back to the class's zone
          // for rows predating add-session-timezone.sql, then to the school's.
          const sourceZone = o.timezone ?? o.classes?.timezone ?? SCHOOL_TIMEZONE
          const local = convertOccurrence(
            o.occurrence_date, o.start_time, sourceZone, viewerTimezone,
          )
          // A conversion that fails leaves the session where it was stored
          // rather than dropping it — a class on a slightly wrong day beats a
          // class the reader never learns about.
          const onDate = local?.date ?? o.occurrence_date
          if (onDate < from || onDate > to) continue

          const localEnd = convertOccurrence(
            o.occurrence_date, o.end_time, sourceZone, viewerTimezone,
          )
          touch(onDate).classes.push({
            id: o.class_id,
            name: o.classes?.name ?? '',
            cancelled: o.status === 'cancelled',
            occurrenceId: o.id,
            seriesId: o.series_id ?? null,
            startTime: local?.time ?? o.start_time,
            endTime: localEnd?.time ?? o.end_time,
          })
        }
      }

      // ── Problems, students only ──────────────────────────
      if (!isTeacher && assignedChallengeIds && assignedChallengeIds.length > 0) {
        const { data: challenges } = await supabase
          .from('daily_challenges')
          .select('id, title, challenge_date, max_points')
          .in('id', assignedChallengeIds)
          .gte('challenge_date', from)
          .lte('challenge_date', to)

        const ids = (challenges || []).map((c: any) => c.id)
        // challenge_id → points. A key with a null value is submitted-but-
        // ungraded; an absent key is not submitted. The two are different
        // states and collapsing them into a boolean would lose the one a
        // student most wants to see.
        const marks = new Map<string, number | null>()
        if (ids.length > 0) {
          const { data: subs } = await supabase
            .from('challenge_submissions')
            .select('challenge_id, points')
            .eq('user_id', user.id)
            .in('challenge_id', ids)
          for (const s of (subs || []) as any[]) marks.set(s.challenge_id, s.points ?? null)
        }
        for (const c of (challenges || []) as any[]) {
          touch(c.challenge_date).problems.push({
            id: c.id,
            title: c.title ?? '',
            submitted: marks.has(c.id),
            points: marks.get(c.id) ?? null,
            maxPoints: c.max_points ?? null,
          })
        }
      }

      if (!cancelled) setCalendarDays(days)
    })()

    return () => { cancelled = true }
    // viewerTimezone is a dependency, not a detail: it decides which day each
    // session lands on, so the month has to be rebuilt when it resolves.
  }, [user?.id, isTeacher, assignedChallengeIds, calendarMonth, monthNonce, viewerTimezone])

  /*
    Ask the room picture how wide it is relative to its height.

    Decoding the header is enough for naturalWidth — the browser has usually
    already fetched the file for the background, so this is the cache rather
    than a second download. A failure leaves the ratio null and the box keeps
    its 400px floor, which is where it was before any of this.
  */
  useEffect(() => {
    if (!petRoomBgUrl) { setPetRoomAspect(null); return }
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setPetRoomAspect(img.naturalWidth / img.naturalHeight)
      }
    }
    img.onerror = () => { if (!cancelled) setPetRoomAspect(null) }
    img.src = petRoomBgUrl
    return () => { cancelled = true }
  }, [petRoomBgUrl])

  // The class list for the two authoring dropdowns. Teachers see every class,
  // matching /classes; loaded once rather than per modal open.
  useEffect(() => {
    if (!isTeacher || !user?.id) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('classes').select('id, name').order('name', { ascending: true })
      if (!cancelled) setTeacherClasses(data || [])
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher, user?.id])

  async function loadTodayChallenge(userId: string, teacherRole: boolean) {
    try {
      const today = schoolDateString()

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
      // Fetch class memberships, individual assignments, and teacher roles in parallel
      const [
        { data: classIds },
        { data: individualAssignments },
        teacherRoleResult,
      ] = await Promise.all([
        supabase.from('class_members').select('class_id').eq('user_id', userId),
        supabase.from('challenge_student_assignments').select('challenge_id').eq('student_id', userId),
        // Pre-fetch teacher role ids for comment badge calculation
        Promise.resolve(supabase.from('roles').select('id').in('name', ['teacher', 'administrator'])).catch(() => ({ data: null })),
      ])

      let classAssignedIds: string[] = []
      // Fetch class challenge assignments and user_roles lookup in parallel
      const [classAssignmentsResult, teacherUserIdsResult] = await Promise.all([
        classIds && classIds.length > 0
          ? supabase.from('challenge_assignments').select('challenge_id').in('class_id', classIds.map((m: any) => m.class_id))
          : Promise.resolve({ data: [] }),
        // Resolve teacher user IDs from pre-fetched role IDs
        (async () => {
          try {
            const teacherRoleIds = ((teacherRoleResult as any)?.data || []).map((r: any) => r.id)
            if (teacherRoleIds.length === 0) return []
            const { data: rows } = await supabase.from('user_roles').select('user_id').in('role_id', teacherRoleIds).is('class_id', null)
            return [...new Set((rows || []).map((r: any) => r.user_id))]
          } catch (_) { return [] }
        })(),
      ])
      classAssignedIds = (classAssignmentsResult as any).data?.map((a: any) => a.challenge_id) || []
      const teacherUserIds: string[] = teacherUserIdsResult as string[]

      const individualIds = individualAssignments?.map((a: any) => a.challenge_id) || []
      const allAssignedIds = [...new Set([...classAssignedIds, ...individualIds])]
      // Published before the early return below, so a student with nothing
      // assigned still resolves to "none" rather than leaving the calendar
      // waiting on an answer that never comes.
      setAssignedChallengeIds(allAssignedIds)
      if (allAssignedIds.length === 0) return

      // 1. Submissions + today's challenges in parallel (both depend only on allAssignedIds)
      const [submissionsResult, todayChallengesResult] = await Promise.all([
        supabase.from('challenge_submissions').select('id, challenge_id').in('challenge_id', allAssignedIds).eq('user_id', userId),
        supabase.from('daily_challenges').select('id, title, challenge_date').in('id', allAssignedIds).eq('challenge_date', today).order('created_at', { ascending: false }),
      ])
      const submissions = submissionsResult.data
      if (!submissions || submissions.length === 0) return

      const submittedMap = new Map((submissions).map((s: any) => [s.challenge_id, s.id]))
      const submissionIds = submissions.map((s: any) => s.id)
      const latestTeacherCommentAt: Record<string, string> = {}
      // Fetch teacher comments (today's challenges already fetched above in parallel with submissions)
      if (teacherUserIds.length > 0 && submissionIds.length > 0) {
        const { data: teacherComments } = await supabase.from('submission_comments').select('submission_id, created_at')
          .in('submission_id', submissionIds).in('user_id', teacherUserIds)
          .order('created_at', { ascending: false })
        for (const c of teacherComments || []) {
          if (!latestTeacherCommentAt[c.submission_id]) {
            latestTeacherCommentAt[c.submission_id] = c.created_at
          }
        }
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

      // 5. Use today's challenges from parallel fetch above
      const todayChallengesData = (todayChallengesResult as any).data || []

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
          <p className="text-gray-600">{t('status.loading')}</p>
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
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 hidden sm:block">{t('auth.appName')}</h1>
              <h1 className="text-lg font-bold text-gray-900 sm:hidden">{t('dash.mathClass')}</h1>
              {/* Renders nothing unless there is a live announcement. */}
              <AnnouncementButton />
            </div>
            <div className="flex items-center gap-1 sm:gap-4">
              <NotificationBell />
              <button
                onClick={() => router.push('/settings')}
                className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={t('nav.settings')}
              >
                {t('nav.settings')}
              </button>
              <span className="text-gray-600 font-medium hidden sm:inline">
                {profile?.nickname || profile?.first_name || user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="px-2 sm:px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium rounded-xl hover:bg-gray-100 transition-colors"
              >
                {t('nav.signOut')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* The welcome card.

            Its markup lives in components/dashboard/WelcomeCard, which is also
            where the paper treatment, the pigment picker and the 40/60 split
            are explained. What stays here is the data: this page already
            resolves the reader, their role and their assigned challenges, and
            the card should not go fetching any of it a second time. */}
        <WelcomeCard
          firstName={firstName}
          isTeacher={isTeacher}
          palette={palette}
          onPaletteChange={handlePaletteChange}
          challenges={todayChallenges}
          collapsedCount={CHALLENGES_COLLAPSED}
          expanded={expandedChallenges}
          onToggleExpanded={() => setExpandedChallenges(v => !v)}
          onOpenChallenge={c => {
            // Opening a challenge is also the moment its comment stops being new.
            if (c.submissionId) {
              try { localStorage.setItem(`comment_seen_${c.submissionId}`, new Date().toISOString()) } catch (_) {}
            }
            router.push(`/challenges/${c.id}`)
          }}
          onCreateChallenge={() => router.push('/challenges/new')}
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          days={calendarDays}
          today={schoolToday}
          viewerTimezone={viewerTimezone}
          /*
            No comment-seen bookkeeping here, unlike the left column. That badge
            only exists on the list, and the challenge page marks the comment
            read on load anyway — so a problem opened from the calendar settles
            itself.
          */
          onOpenProblem={id => router.push(`/challenges/${id}`)}
          onDayClick={isTeacher ? setEditingDay : undefined}
          onOpenAssignment={isTeacher ? () => setAssignmentOpen(true) : undefined}
        />

        {isTeacher && (
          <>
            <ClassAssignmentModal
              open={assignmentOpen}
              onClose={() => setAssignmentOpen(false)}
              today={schoolToday}
              authorTimezone={viewerTimezone}
              onChanged={() => setMonthNonce(n => n + 1)}
            />
            <DaySessionsModal
              date={editingDay}
              sessions={(calendarDays[editingDay ?? '']?.classes ?? [])
                // Only rows that came back with an occurrence id can be edited.
                .filter(c => c.occurrenceId)
                .map(c => ({
                  id: c.occurrenceId!,
                  classId: c.id,
                  className: c.name,
                  seriesId: c.seriesId ?? null,
                  startTime: c.startTime ?? '00:00:00',
                  endTime: c.endTime ?? '00:00:00',
                  cancelled: c.cancelled,
                }))}
              classes={teacherClasses}
              today={schoolToday}
              viewerTimezone={viewerTimezone}
              onClose={() => setEditingDay(null)}
              onChanged={() => setMonthNonce(n => n + 1)}
            />
          </>
        )}

        {/* Stats Cards.

            The pet room is one of them now — a 2×2 block with the day's tiles
            above it, the reader's own numbers down its right, and navigation
            beneath, so it is surrounded rather than parked beside the greeting.

            The order below is one sequence for both roles, which is what keeps
            the top row identical whoever is reading: a teacher opening the page
            should not find it rearranged. Compared against the alternatives in
            docs/dashboard-layout-preview.html. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 sm:auto-rows-fr mb-8">
          <Card 
            surfaceImage={cardArt('challenges')}
            surfaceFrame={cardFrame('challenges')}
            className="flex flex-col text-center cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push('/challenges')}
          >
            <Card.Body className="flex-1 flex flex-col items-center justify-start pt-7">
              <TileHead items={[{ icon: 'challenges', value: stats.challengesCount, alt: t('nav.challenges') }]} />
              <div className="text-gray-600 font-medium">{t('nav.challenges')}</div>
            </Card.Body>
          </Card>

          {/* Bubble Room — links to the user's first class bubble room, or /classes to pick */}
          <Card
            surfaceImage={cardArt('bubble-room')}
            surfaceFrame={cardFrame('bubble-room')}
            className="flex flex-col text-center cursor-pointer hover:shadow-lg transition-shadow"
            onClick={async () => {
              // Find the user's first enrolled class and navigate to its bubble room
              const supabaseClient = createClient()
              const { data: { user: u } } = await supabaseClient.auth.getUser()
              if (!u) { router.push('/classes'); return }
              router.push('/bubble-room')
            }}
          >
            <Card.Body className="flex-1 flex flex-col items-center justify-start pt-7">
              {/* The number only appears once there is something waiting —
                  a nought beside the icon reads as a problem rather than as
                  a quiet inbox. */}
              <TileHead
                items={[{
                  icon: 'bubble-room',
                  value: openBubbles > 0 ? openBubbles : undefined,
                  alt: t('nav.bubbleRoom'),
                }]}
              />
              <div className="text-2xl font-bold text-gray-900 mb-1">{t('nav.bubbleRoom')}</div>
              <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">Q&amp;A</div>
            </Card.Body>
          </Card>

          {/* Decorations hub — book skins, pet room, etc. */}
          <Card
            surfaceImage={cardArt('decorations')}
            surfaceFrame={cardFrame('decorations')}
            className="flex flex-col text-center cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push('/decorations')}
          >
            <Card.Body className="flex-1 flex flex-col items-center justify-start pt-7">
              <TileHead items={[{ icon: 'decorations', alt: t('nav.decorations') }]} />
              <div className="text-3xl font-bold text-gray-900 mb-1">{t('nav.decorations')}</div>
              <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">Book &amp; Room</div>
            </Card.Body>
          </Card>

          {/* Admin: Book Skins managed via Decorations hub */}

          <div
            id="pet-area"
            /*
              Three rows on a wide screen, two below it, and `self-start` in
              both cases.

              `self-start` is the half that is easy to drop. The rows are equal
              (auto-rows-fr) and sized by whatever the tiles need, so the room's
              share of them is very nearly its own height but never exactly. A
              stretched grid item has both dimensions decided for it, and a box
              whose width and height are both already decided ignores
              aspect-ratio entirely — which is the crop above, back again, this
              time with no image ratio to blame. Starting the room instead lets
              it take its width from the columns and its height from the ratio,
              and leaves the remainder as a few pixels of gap.
            */
            className="col-span-2 sm:row-span-2 xl:row-span-3 self-start rounded-3xl overflow-hidden relative"
            style={{
              /*
                ── The room is shown at its own shape, and that is load-bearing ──
                The background is painted with `cover`, but every overlay on top
                of it — the photo in the wall frame, and each animated zone — is
                positioned as a percentage of THIS BOX. Those two only agree when
                the box has the same aspect as the picture. `cover` on a wider box
                crops the top and bottom away and scales what is left, while the
                overlays go on stretching across the full box: the room loses its
                ceiling and its floor, and the animations drift off the things
                they animate.

                It matched by luck before. The old half-of-a-hero-row was about
                600x400 and pet-room-bg.png is 1536x1024 — both exactly 3:2 — so
                nothing was cropped and nothing drifted. Moving into the grid made
                the box 2:1 and broke both at once.

                Asking the image for its own ratio makes the agreement a rule
                rather than a coincidence, and it holds for any room a student
                picks, whatever shape it was drawn at.
              */
              aspectRatio: petRoomAspect ?? undefined,
              // Only until the image reports back. A fixed height after that
              // would fight the ratio and re-introduce the crop.
              minHeight: petRoomAspect ? undefined : '400px',
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
                  transform: [
                    (petRoomFrameSlot.rotateY || petRoomFrameSlot.rotateX) ? 'perspective(800px)' : '',
                    petRoomFrameSlot.rotateY ? `rotateY(${petRoomFrameSlot.rotateY}deg)` : '',
                    petRoomFrameSlot.rotateX ? `rotateX(${petRoomFrameSlot.rotateX}deg)` : '',
                    petRoomFrameSlot.rotate ? `rotate(${petRoomFrameSlot.rotate}deg)` : '',
                  ].filter(Boolean).join(' ') || undefined,
                  transformOrigin: 'center center',
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Animated zones — gentle ambient animation on specific objects */}
            {petRoomBgUrl && petRoomAnimZones.length > 0 && (
              <AnimatedRoomLayer imageUrl={petRoomBgUrl} zones={petRoomAnimZones} />
            )}

            <InlinePet />
          </div>

          {!isTeacher && !isAdmin && (
            <Card className="flex flex-col text-center hover:shadow-lg transition-shadow" surfaceImage={cardArt('total-score')} surfaceFrame={cardFrame('total-score')}>
              <Card.Body className="flex-1 flex flex-col items-center justify-start pt-7">
                <TileHead
                  items={[
                    { icon: 'problem-points', value: stats.totalScore, alt: t('dash.totalScore') },
                    { icon: 'ta-points', value: stats.taScore, alt: t('settings.taScore') },
                  ]}
                />
                <div className="text-gray-600 font-medium">
                  {t('dash.totalScore')} <span className="text-gray-300">/</span>{' '}
                  {t('settings.taScore')}
                </div>
              </Card.Body>
            </Card>
          )}

          {!isTeacher && !isAdmin && (
            <Card
              surfaceImage={cardArt('shop')}
              surfaceFrame={cardFrame('shop')}
              className="flex flex-col text-center cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/shop')}
            >
              <Card.Body className="flex-1 flex flex-col items-center justify-start pt-7">
                <TileHead
                  items={[
                    { icon: 'shop-points', value: stats.spendableBalance, alt: t('dash.shopBalance') },
                    { icon: 'shop-ta-points', value: stats.taBalance, alt: t('shop.taPoints') },
                  ]}
                />
                <div className="text-gray-600 font-medium">
                  {t('dash.shopBalance')} <span className="text-gray-300">/</span> {t('shop.taPoints')}
                </div>
              </Card.Body>
            </Card>
          )}

          {(isTeacher || isAdmin) && (
            <Card 
              surfaceImage={cardArt('grade')}
              surfaceFrame={cardFrame('grade')}
              className="flex flex-col text-center cursor-pointer hover:shadow-lg transition-shadow relative"
              onClick={() => router.push('/grading')}
            >
              <Card.Body className="flex-1 flex flex-col items-center justify-start pt-7">
                <TileHead items={[{ icon: 'grade', alt: t('dash.grade') }]} />
                <div className="text-3xl font-bold text-gray-900 mb-1">{t('dash.grade')}</div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">{t('dash.homework')}</div>
                {ungradedCount > 0 && (
                  <span className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {ungradedCount}
                  </span>
                )}
              </Card.Body>
            </Card>
          )}

          {(isTeacher || isAdmin) && (
            <Card 
              surfaceImage={cardArt('user-roles')}
              surfaceFrame={cardFrame('user-roles')}
              className="flex flex-col text-center cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/students')}
            >
              <Card.Body className="flex-1 flex flex-col items-center justify-start pt-7">
                <TileHead items={[{ icon: 'user', alt: t('dash.userHistory') }]} />
                <div className="text-3xl font-bold text-gray-900 mb-1">{t('dash.userHistory')}</div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">{t('dash.history')}</div>
              </Card.Body>
            </Card>
          )}

          <Card 
            surfaceImage={cardArt('classes')}
            surfaceFrame={cardFrame('classes')}
            className="flex flex-col text-center cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push('/classes')}
          >
            <Card.Body className="flex-1 flex flex-col items-center justify-start pt-7">
              <TileHead items={[{ icon: 'classes', value: stats.classesCount, alt: t('nav.classes') }]} />
              <div className="text-gray-600 font-medium">{t('nav.classes')}</div>
            </Card.Body>
          </Card>

          <Card 
            surfaceImage={cardArt('explore')}
            surfaceFrame={cardFrame('explore')}
            className="flex flex-col text-center cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push('/classes/explore')}
          >
            <Card.Body className="flex-1 flex flex-col items-center justify-start pt-7">
              <TileHead items={[{ icon: 'explore', alt: t('dash.explore') }]} />
              <div className="text-3xl font-bold text-gray-900 mb-1">{t('dash.explore')}</div>
              <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">{t('nav.classes')}</div>
            </Card.Body>
          </Card>

          {(isTeacher || isAdmin) && (
            <Card 
              surfaceImage={cardArt('bank')}
              surfaceFrame={cardFrame('bank')}
              className="flex flex-col text-center cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/admin/challenge-bank')}
            >
              <Card.Body className="flex-1 flex flex-col items-center justify-start pt-7">
                <TileHead items={[{ icon: 'bank', alt: t('dash.challengeBank') }]} />
                <div className="text-3xl font-bold text-gray-900 mb-1">{t('dash.challengeBank')}</div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">{t('dash.manage')}</div>
              </Card.Body>
            </Card>
          )}

          {(isTeacher || isAdmin) && (
            <Card 
              surfaceImage={cardArt('scheduler')}
              surfaceFrame={cardFrame('scheduler')}
              className="flex flex-col text-center cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/admin/schedules')}
            >
              <Card.Body className="flex-1 flex flex-col items-center justify-start pt-7">
                <TileHead items={[{ icon: 'scheduler', alt: t('dash.scheduler') }]} />
                <div className="text-3xl font-bold text-gray-900 mb-1">{t('dash.scheduler')}</div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">{t('dash.manage')}</div>
              </Card.Body>
            </Card>
          )}

          {(isTeacher || isAdmin) && (
            <Card 
              surfaceImage={cardArt('tags')}
              surfaceFrame={cardFrame('tags')}
              className="flex flex-col text-center cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/admin/tags')}
            >
              <Card.Body className="flex-1 flex flex-col items-center justify-start pt-7">
                <TileHead items={[{ icon: 'tags', alt: t('dash.tags') }]} />
                <div className="text-3xl font-bold text-gray-900 mb-1">{t('dash.tags')}</div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">{t('dash.manage')}</div>
              </Card.Body>
            </Card>
          )}

          {(isTeacher || isAdmin) && (
            <Card 
              surfaceImage={cardArt('shop')}
              surfaceFrame={cardFrame('shop')}
              className="flex flex-col text-center cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push('/admin/shop')}
            >
              <Card.Body className="flex-1 flex flex-col items-center justify-start pt-7">
                <TileHead items={[{ icon: 'shop-points', alt: t('nav.shop') }]} />
                <div className="text-3xl font-bold text-gray-900 mb-1">{t('nav.shop')}</div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">{t('dash.manage')}</div>
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

        {/* ── Study Curve — students only ─────────────────────────────── */}
        {!isTeacher && !isAdmin && user && (
          <StudyCurveSection userId={user.id} />
        )}

      </main>
    </div>
  )
}
