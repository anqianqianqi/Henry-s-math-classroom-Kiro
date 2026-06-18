'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { runSchedulerForClass } from '@/lib/scheduler'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { localDateString, localDateOffset } from '@/lib/utils/date'

interface Challenge {
  id: string
  title: string
  description: string
  challenge_date: string
  created_at: string
  tag_ids?: string[]
  max_points?: number | null
  submission_count?: number
  total_students?: number
  completion_rate?: number
  class_names?: string[]
  // Student-specific
  my_points?: number | null
  my_is_locked?: boolean
  my_submitted?: boolean
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [filteredChallenges, setFilteredChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [isTeacher, setIsTeacher] = useState(false)
  const [classes, setClasses] = useState<Array<{id: string, name: string}>>([])
  
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('date-desc')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [availableTagsMap, setAvailableTagsMap] = useState<Record<string, string>>({}) // id → name
  const [allTagData, setAllTagData] = useState<any[]>([]) // raw tag data with all names
  const [tagLang, setTagLang] = useState<'en' | 'zh'>('en')
  const tagDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Rebuild tag map when language changes
  useEffect(() => {
    if (allTagData.length === 0) return
    const tagMap: Record<string, string> = {}
    allTagData.forEach((t: any) => {
      const name = t.challenge_tag_names?.find((n: any) => n.language === tagLang)?.name
        || t.challenge_tag_names?.find((n: any) => n.language === 'en')?.name
        || t.challenge_tag_names?.find((n: any) => n.language === 'zh')?.name
        || t.id.slice(0, 8)
      tagMap[t.id] = name
    })
    setAvailableTagsMap(tagMap)
  }, [tagLang, allTagData])
  
  // Pagination state
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [showAllPast, setShowAllPast] = useState(false)
  const ITEMS_PER_PAGE = 10

  // Week grid (teacher only) — map of classId → (dateStr → {id, title})
  const [weekGrid, setWeekGrid] = useState<Record<string, Record<string, {id: string, title: string}>>>({})
  const [weekGridClasses, setWeekGridClasses] = useState<Array<{id: string, name: string}>>([])
  const [weekDates, setWeekDates] = useState<string[]>([])

  // Assign-from-bank modal state
  const [pickTarget, setPickTarget] = useState<{ classId: string, className: string, date: string } | null>(null)
  const [bankChallenges, setBankChallenges] = useState<Array<{id: string, title: string, description: string, tag_ids: string[], image_url?: string | null}>>([])
  const [bankTagMap, setBankTagMap] = useState<Record<string, string>>({}) // tagId → name
  const [bankSearch, setBankSearch] = useState('')
  const [bankLoading, setBankLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)
  // Set of bank IDs that have been published to the target class with ≥2 submissions
  const [usedBankIds, setUsedBankIds] = useState<Set<string>>(new Set())
  const [showUsed, setShowUsed] = useState(false)
  // Two-step confirm: null = browse, non-null = confirm stage
  const [pendingChallenge, setPendingChallenge] = useState<{id: string, title: string, description: string, tag_ids: string[], image_url?: string | null} | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadChallenges()
  }, [])

  useEffect(() => {
    applyFiltersAndSort()
  }, [challenges, searchQuery, selectedClass, dateFilter, sortBy, selectedTags])

  async function loadChallenges() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    // Check if user is teacher or admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .is('class_id', null)

    let teacherRole = false
    let adminRole = false
    if (roles && roles.length > 0) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .in('id', roles.map((r: any) => r.role_id))

      teacherRole = roleData?.some((r: any) => r.name === 'teacher') || false
      adminRole = roleData?.some((r: any) => r.name === 'administrator') || false
    }
    
    const canSeeAll = teacherRole || adminRole
    setIsTeacher(canSeeAll)

    if (canSeeAll) {
      // Load all classes for filter
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      
      setClasses(classesData || [])

      // Load week grid for the schedule overview
      await loadWeekGrid()

      // Load tag names for filter
      const { data: tagsData } = await supabase
        .from('challenge_tags')
        .select('id, challenge_tag_names(language, name)')
        .order('created_at')
      setAllTagData(tagsData || [])
      const tagMap: Record<string, string> = {}
      tagsData?.forEach((t: any) => {
        const name = t.challenge_tag_names?.find((n: any) => n.language === tagLang)?.name
          || t.challenge_tag_names?.find((n: any) => n.language === 'en')?.name
          || t.challenge_tag_names?.find((n: any) => n.language === 'zh')?.name
          || t.id.slice(0, 8)
        tagMap[t.id] = name
      })
      setAvailableTagsMap(tagMap)

      // Teachers and admins see all published challenges (not pool/bank items)
      const { data: challengesData } = await supabase
        .from('daily_challenges')
        .select('*')
        .order('challenge_date', { ascending: false })

      if (challengesData) {
        // Load stats for each challenge
        const challengesWithStats = await Promise.all(
          challengesData.map(async (challenge) => {
            const stats = await loadChallengeStats(challenge.id)
            const classNames = await loadChallengeClasses(challenge.id)
            return {
              ...challenge,
              ...stats,
              class_names: classNames
            }
          })
        )
        setChallenges(challengesWithStats)
      }
    } else {
      // Students see challenges assigned to their classes
      const { data: classMembers } = await supabase
        .from('class_members')
        .select('class_id')
        .eq('user_id', user.id)

      const classIds = classMembers?.map(cm => cm.class_id) || []

      if (classIds.length === 0) {
        // Even without class memberships, check individual assignments
        const { data: individualOnly } = await supabase
          .from('challenge_student_assignments')
          .select('challenge_id')
          .eq('student_id', user.id)

        if (!individualOnly || individualOnly.length === 0) {
          setLoading(false)
          return
        }

        // Load individually assigned challenges
        const indivIds = [...new Set(individualOnly.map(a => a.challenge_id))]
        // Only show challenges from the past 10 days
        const tenDaysAgoStr = localDateOffset(-10)

        const { data: challengesData } = await supabase
          .from('daily_challenges')
          .select('*')
          .in('id', indivIds)
          .lte('challenge_date', localDateString())
          .gte('challenge_date', tenDaysAgoStr)
          .order('challenge_date', { ascending: false })

        setChallenges(challengesData || [])
        setLoading(false)
        return
      }

      // Run scheduler for each class (lazy execution)
      for (const classId of classIds) {
        await runSchedulerForClass(supabase, classId)
      }

      // Load class names for filter dropdown
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name')
        .in('id', classIds)
        .order('name')
      setClasses(classesData || [])

      // Load tag names for students too
      const { data: tagsData } = await supabase
        .from('challenge_tags')
        .select('id, challenge_tag_names(language, name)')
        .order('created_at')
      setAllTagData(tagsData || [])
      const tagMap: Record<string, string> = {}
      tagsData?.forEach((t: any) => {
        const name = t.challenge_tag_names?.find((n: any) => n.language === tagLang)?.name
          || t.challenge_tag_names?.find((n: any) => n.language === 'en')?.name
          || t.challenge_tag_names?.find((n: any) => n.language === 'zh')?.name
          || t.id.slice(0, 8)
        tagMap[t.id] = name
      })
      setAvailableTagsMap(tagMap)

      const { data: assignments } = await supabase
        .from('challenge_assignments')
        .select('challenge_id')
        .in('class_id', classIds)

      const classAssignedIds = assignments?.map(a => a.challenge_id) || []

      // Also check individual student assignments
      const { data: individualAssignments } = await supabase
        .from('challenge_student_assignments')
        .select('challenge_id')
        .eq('student_id', user.id)

      const individualIds = individualAssignments?.map(a => a.challenge_id) || []

      // Merge and deduplicate challenge IDs from both sources
      const challengeIds = [...new Set([...classAssignedIds, ...individualIds])]

      if (challengeIds.length === 0) {
        setLoading(false)
        return
      }

      // Only show challenges from the past 10 days for class assignments,
      // but individually assigned challenges should always show regardless of date
      const tenDaysAgoStr = localDateOffset(-10)

      // Fetch class-assigned challenges (10-day window)
      const classOnlyIds = classAssignedIds.filter(id => !individualIds.includes(id))
      const indivOnlyIds = individualIds.filter(id => !classAssignedIds.includes(id))
      const bothIds = classAssignedIds.filter(id => individualIds.includes(id))

      // All IDs that need the 10-day window (class-assigned or both)
      const windowIds = [...new Set([...classOnlyIds, ...bothIds])]
      // IDs that are individual-only (no date restriction)
      const noWindowIds = indivOnlyIds

      const [windowResult, noWindowResult] = await Promise.all([
        windowIds.length > 0
          ? supabase
              .from('daily_challenges')
              .select('*')
              .in('id', windowIds)
              .lte('challenge_date', localDateString())
              .gte('challenge_date', tenDaysAgoStr)
              .order('challenge_date', { ascending: false })
          : Promise.resolve({ data: [] }),
        noWindowIds.length > 0
          ? supabase
              .from('daily_challenges')
              .select('*')
              .in('id', noWindowIds)
              .lte('challenge_date', localDateString())
              .order('challenge_date', { ascending: false })
          : Promise.resolve({ data: [] }),
      ])

      const allFetched = [...(windowResult.data || []), ...(noWindowResult.data || [])]

      // Deduplicate challenges
      const uniqueChallenges = allFetched.filter(
        (c, i, arr) => arr.findIndex(x => x.id === c.id) === i
      )
      const challengesData = uniqueChallenges

      // Load class names and submission data for each challenge
      if (challengesData.length > 0) {
        // Load student's submissions for all challenges
        const { data: mySubmissions } = await supabase
          .from('challenge_submissions')
          .select('challenge_id, points, is_locked')
          .eq('user_id', user.id)
          .in('challenge_id', challengesData.map(c => c.id))

        const subMap = new Map(mySubmissions?.map(s => [s.challenge_id, s]) || [])

        // Also fetch challenges the student has submitted to but are no longer assigned
        // (e.g. teacher deleted or retired the assignment — student's history must be preserved)
        const assignedIds = new Set(challengesData.map(c => c.id))
        const { data: allMySubmissions } = await supabase
          .from('challenge_submissions')
          .select('challenge_id, points, is_locked')
          .eq('user_id', user.id)
        
        const submittedUnassignedIds = (allMySubmissions || [])
          .map(s => s.challenge_id)
          .filter(id => !assignedIds.has(id))

        let extraChallenges: any[] = []
        if (submittedUnassignedIds.length > 0) {
          const { data: extraData } = await supabase
            .from('daily_challenges')
            .select('*')
            .in('id', submittedUnassignedIds)
            .order('challenge_date', { ascending: false })
          extraChallenges = extraData || []
          // Add their submissions to the map
          for (const s of allMySubmissions || []) {
            if (!subMap.has(s.challenge_id)) subMap.set(s.challenge_id, s)
          }
        }

        const allChallenges = [
          ...challengesData,
          ...extraChallenges.filter(c => !assignedIds.has(c.id)),
        ]

        const withExtras = await Promise.all(
          allChallenges.map(async (c) => {
            const names = await loadChallengeClasses(c.id)
            const sub = subMap.get(c.id)
            return {
              ...c,
              class_names: names,
              my_submitted: !!sub,
              my_points: sub?.points ?? null,
              my_is_locked: sub?.is_locked ?? false,
            }
          })
        )
        setChallenges(withExtras)
      } else {
        setChallenges([])
      }
    }
    
    setLoading(false)
  }

  async function loadChallengeStats(challengeId: string) {
    // Get submission count
    const { count: submissionCount } = await supabase
      .from('challenge_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('challenge_id', challengeId)

    // Get total students: class-assigned + individually assigned (deduplicated)
    const { data: classAssignments } = await supabase
      .from('challenge_assignments')
      .select('class_id')
      .eq('challenge_id', challengeId)

    // Collect all student IDs from class assignments
    const classStudentIds = new Set<string>()
    if (classAssignments && classAssignments.length > 0) {
      const classIds = classAssignments.map(a => a.class_id)
      const { data: classMembers } = await supabase
        .from('class_members')
        .select('user_id')
        .in('class_id', classIds)
      for (const m of classMembers || []) classStudentIds.add(m.user_id)
    }

    // Collect individually assigned student IDs
    const { data: individualAssignments } = await supabase
      .from('challenge_student_assignments')
      .select('student_id')
      .eq('challenge_id', challengeId)
    for (const a of individualAssignments || []) classStudentIds.add(a.student_id)

    const totalStudents = classStudentIds.size

    const completionRate = totalStudents > 0
      ? Math.round(((submissionCount || 0) / totalStudents) * 100)
      : 0

    return {
      submission_count: submissionCount || 0,
      total_students: totalStudents,
      completion_rate: completionRate
    }
  }

  async function loadChallengeClasses(challengeId: string) {
    const { data: assignments } = await supabase
      .from('challenge_assignments')
      .select(`
        class_id,
        classes:class_id(name)
      `)
      .eq('challenge_id', challengeId)

    return assignments?.map((a: any) => a.classes?.name).filter(Boolean) || []
  }

  // ── Assign-from-bank modal ────────────────────────────────────────────────
  async function openPickModal(classId: string, className: string, date: string) {
    setPickTarget({ classId, className, date })
    setBankSearch('')
    setShowUsed(false)
    setPendingChallenge(null)
    setBankLoading(true)

    const [{ data: challenges }, { data: tagsData }] = await Promise.all([
      supabase
        .from('challenge_bank')
        .select('id, title, description, tag_ids, image_url')
        .order('created_at', { ascending: false }),
      supabase
        .from('challenge_tags')
        .select('id, challenge_tag_names(language, name)')
        .order('created_at'),
    ])
    setBankChallenges(
      (challenges || []).map((c: any) => ({ ...c, tag_ids: c.tag_ids || [] }))
    )

    // Build tag name map
    const tagMap: Record<string, string> = {}
    for (const t of tagsData || []) {
      const name =
        (t as any).challenge_tag_names?.find((n: any) => n.language === 'en')?.name ||
        (t as any).challenge_tag_names?.find((n: any) => n.language === 'zh')?.name ||
        (t as any).id.slice(0, 8)
      tagMap[(t as any).id] = name
    }
    setBankTagMap(tagMap)

    // Find bank items published to this class with ≥2 submissions
    // Step 1: daily_challenges assigned to this class that have a source_bank_id
    const { data: assignedChallenges } = await supabase
      .from('challenge_assignments')
      .select('challenge_id')
      .eq('class_id', classId)

    const assignedIds = (assignedChallenges || []).map((a: any) => a.challenge_id)

    const usedIds = new Set<string>()
    if (assignedIds.length > 0) {
      // Step 2: get source_bank_id for those challenges
      const { data: dcRows } = await supabase
        .from('daily_challenges')
        .select('id, source_bank_id')
        .in('id', assignedIds)
        .not('source_bank_id', 'is', null)

      if (dcRows && dcRows.length > 0) {
        // Step 3: count submissions for each
        const dcIds = dcRows.map((r: any) => r.id)
        const { data: subCounts } = await supabase
          .from('challenge_submissions')
          .select('challenge_id')
          .in('challenge_id', dcIds)

        // Count per challenge
        const countMap: Record<string, number> = {}
        for (const s of subCounts || []) {
          countMap[s.challenge_id] = (countMap[s.challenge_id] || 0) + 1
        }

        // Mark bank IDs whose published instance has ≥2 submissions
        for (const row of dcRows) {
          if ((countMap[row.id] || 0) >= 2 && row.source_bank_id) {
            usedIds.add(row.source_bank_id)
          }
        }
      }
    }
    setUsedBankIds(usedIds)
    setBankLoading(false)
  }

  async function handleAssignFromBank(bankChallenge: { id: string; title: string; description: string; tag_ids: string[] }) {
    if (!pickTarget) return
    setAssigning(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // ── Find previous instances of this bank item assigned to this class ──
      // 1. All daily_challenges with same source_bank_id assigned to this class
      const { data: prevAssignments } = await supabase
        .from('challenge_assignments')
        .select('challenge_id')
        .eq('class_id', pickTarget.classId)

      const prevChallengeIds = (prevAssignments || []).map((a: any) => a.challenge_id)

      let oldChallengeIds: string[] = []
      if (prevChallengeIds.length > 0) {
        const { data: oldDcs } = await supabase
          .from('daily_challenges')
          .select('id')
          .in('id', prevChallengeIds)
          .eq('source_bank_id', bankChallenge.id)
        oldChallengeIds = (oldDcs || []).map((r: any) => r.id)
      }

      // Create new daily_challenge instance
      const { data: newChallenge, error: insertErr } = await supabase
        .from('daily_challenges')
        .insert({
          title: bankChallenge.title,
          description: bankChallenge.description,
          challenge_date: pickTarget.date,
          created_by: user.id,
          source_bank_id: bankChallenge.id,
        })
        .select('id')
        .single()

      if (insertErr || !newChallenge) throw insertErr || new Error('Insert failed')

      // Assign new challenge to the class
      await supabase.from('challenge_assignments').insert({
        challenge_id: newChallenge.id,
        class_id: pickTarget.classId,
        assigned_by: user.id,
      })

      // ── Retire old instances ──
      if (oldChallengeIds.length > 0) {
        // Get all submissions for old instances
        const { data: oldSubs } = await supabase
          .from('challenge_submissions')
          .select('id, user_id, content, image_url, points, is_locked')
          .in('challenge_id', oldChallengeIds)

        const submittedUserIds = new Set((oldSubs || []).map((s: any) => s.user_id))

        for (const oldId of oldChallengeIds) {
          const subsForOld = (oldSubs || []).filter((s: any) => s.challenge_id === oldId)

          if (subsForOld.length > 0) {
            // Copy each submission to the new challenge instance (if not already there)
            const { data: existingNewSubs } = await supabase
              .from('challenge_submissions')
              .select('user_id')
              .eq('challenge_id', newChallenge.id)
              .in('user_id', subsForOld.map((s: any) => s.user_id))

            const alreadyCopied = new Set((existingNewSubs || []).map((s: any) => s.user_id))

            const toInsert = subsForOld
              .filter((s: any) => !alreadyCopied.has(s.user_id))
              .map((s: any) => ({
                challenge_id: newChallenge.id,
                user_id: s.user_id,
                content: s.content,
                image_url: s.image_url ?? null,
                points: s.points ?? null,
                is_locked: s.is_locked ?? false,
              }))

            if (toInsert.length > 0) {
              await supabase.from('challenge_submissions').insert(toInsert)
            }
          }

          // Remove old class assignment so it disappears from student challenge pages
          // (keep the challenge row itself and any submissions for record keeping)
          await supabase
            .from('challenge_assignments')
            .delete()
            .eq('challenge_id', oldId)
            .eq('class_id', pickTarget.classId)
        }
      }

      // Update the local grid immediately
      setWeekGrid(prev => ({
        ...prev,
        [pickTarget.classId]: {
          ...(prev[pickTarget.classId] || {}),
          [pickTarget.date]: { id: newChallenge.id, title: bankChallenge.title },
        },
      }))

      setPickTarget(null)
    } catch (err: any) {
      alert('Failed to assign: ' + (err?.message || err))
    } finally {
      setAssigning(false)
    }
  }

  // ── Week schedule grid (teacher only) ────────────────────────────────────
  async function loadWeekGrid() {
    // Build date columns: today + next 7 days
    const dates: string[] = []
    for (let i = 0; i <= 7; i++) {
      dates.push(localDateOffset(i))
    }
    setWeekDates(dates)

    // Fetch all active classes
    const { data: allClasses } = await supabase
      .from('classes')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    const classList = allClasses || []
    setWeekGridClasses(classList)

    if (classList.length === 0) return

    // Fetch all challenge_assignments for these classes in the date range
    const { data: assignments } = await supabase
      .from('challenge_assignments')
      .select('class_id, challenge_id')
      .in('class_id', classList.map(c => c.id))

    if (!assignments || assignments.length === 0) return

    // Fetch challenges in the date range
    const challengeIds = [...new Set(assignments.map(a => a.challenge_id))]
    const { data: challengesInRange } = await supabase
      .from('daily_challenges')
      .select('id, title, challenge_date')
      .in('id', challengeIds)
      .gte('challenge_date', dates[0])
      .lte('challenge_date', dates[dates.length - 1])

    // Build lookup: challengeId → {title, challenge_date}
    const challengeMap = new Map(
      (challengesInRange || []).map(c => [c.id, c])
    )

    // Build grid: classId → dateStr → {id, title}
    const grid: Record<string, Record<string, {id: string, title: string}>> = {}
    for (const cls of classList) {
      grid[cls.id] = {}
    }
    for (const a of assignments) {
      const ch = challengeMap.get(a.challenge_id)
      if (ch && grid[a.class_id] !== undefined) {
        grid[a.class_id][ch.challenge_date] = { id: ch.id, title: ch.title }
      }
    }
    setWeekGrid(grid)
  }

  function applyFiltersAndSort() {
    let filtered = [...challenges]

    // Apply search filter (matches title, description, and tag names)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.tag_ids?.some(id => (availableTagsMap[id] || '').toLowerCase().includes(query))
      )
    }

    // Apply class filter
    if (selectedClass !== 'all') {
      filtered = filtered.filter(c => 
        c.class_names?.some(name => name === selectedClass)
      )
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(c => selectedTags.every(t => c.tag_ids?.includes(t)))
    }

    // Apply date filter
    const today = localDateString()
    if (dateFilter === 'today') {
      filtered = filtered.filter(c => c.challenge_date === today)
    } else if (dateFilter === 'upcoming') {
      filtered = filtered.filter(c => c.challenge_date && c.challenge_date > today)
    } else if (dateFilter === 'past') {
      filtered = filtered.filter(c => c.challenge_date && c.challenge_date < today)
    } else if (dateFilter === 'this-week') {
      const weekFromNowStr = localDateOffset(7)
      filtered = filtered.filter(c => 
        c.challenge_date && c.challenge_date >= today && c.challenge_date <= weekFromNowStr
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return (b.challenge_date || '').localeCompare(a.challenge_date || '')
        case 'date-asc':
          return (a.challenge_date || '').localeCompare(b.challenge_date || '')
        case 'submissions-desc':
          return (b.submission_count || 0) - (a.submission_count || 0)
        case 'submissions-asc':
          return (a.submission_count || 0) - (b.submission_count || 0)
        case 'completion-desc':
          return (b.completion_rate || 0) - (a.completion_rate || 0)
        case 'completion-asc':
          return (a.completion_rate || 0) - (b.completion_rate || 0)
        default:
          return 0
      }
    })

    setFilteredChallenges(filtered)
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

  const today = localDateString()
  const displayChallenges = filteredChallenges.length > 0 ? filteredChallenges : challenges
  const todayChallenges = displayChallenges.filter(c => c.challenge_date === today)
  const upcomingChallenges = displayChallenges.filter(c => c.challenge_date && c.challenge_date > today)
  const pastChallenges = displayChallenges.filter(c => c.challenge_date && c.challenge_date < today)

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <PageHeader
        breadcrumbs={[{ label: 'Challenges' }]}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={tagLang}
              onChange={e => setTagLang(e.target.value as 'en' | 'zh')}
              className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white"
            >
              <option value="en">EN</option>
              <option value="zh">CN</option>
            </select>
            {isTeacher && (
              <>
                <Button size="sm" onClick={() => router.push('/challenges/new')}>
                  + New
                </Button>
                <Button size="sm" onClick={() => router.push('/admin/generative-templates')} variant="secondary">
                  Templates
                </Button>
                <Button size="sm" onClick={() => router.push('/admin/schedules')} variant="secondary">
                  Scheduler
                </Button>
              </>
            )}
          </div>
        }
      />

      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters and Search */}
        {challenges.length > 0 && (
          <Card className="mb-6">
            <Card.Body>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔍 Search
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title or description..."
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl 
                             focus:border-primary-500 focus:ring-2 focus:ring-primary-100
                             transition-all"
                  />
                </div>

                {/* Class Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📚 Class
                  </label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl 
                             focus:border-primary-500 focus:ring-2 focus:ring-primary-100
                             transition-all bg-white"
                  >
                    <option value="all">All Classes</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.name}>{cls.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 Date
                  </label>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl 
                             focus:border-primary-500 focus:ring-2 focus:ring-primary-100
                             transition-all bg-white"
                  >
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="this-week">This Week</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="past">Past</option>
                  </select>
                </div>
              </div>

              {/* Tag filter row */}
              {(() => {
                const allTagIds = [...new Set(challenges.flatMap(c => c.tag_ids || []))]
                const tagsWithNames = allTagIds.map(id => ({ id, name: availableTagsMap[id] || id.slice(0, 8) })).sort((a, b) => a.name.localeCompare(b.name))
                return tagsWithNames.length > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="text-sm font-medium text-gray-700 shrink-0">Tags:</label>
                    <div className="relative" ref={tagDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setTagDropdownOpen(o => !o)}
                        className="flex items-center gap-2 px-4 py-2 border-2 border-gray-200 rounded-xl 
                                   bg-white text-sm hover:border-primary-400 transition-colors min-w-[160px]"
                      >
                        <span className="flex-1 text-left">
                          {selectedTags.length === 0
                            ? 'All Tags'
                            : `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''} selected`}
                        </span>
                        <span className="text-gray-400">{tagDropdownOpen ? '▲' : '▼'}</span>
                      </button>

                      {tagDropdownOpen && (
                        <div className="absolute z-20 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
                          {tagsWithNames.map(tag => (
                            <label
                              key={tag.id}
                              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedTags.includes(tag.id)}
                                onChange={() =>
                                  setSelectedTags(prev =>
                                    prev.includes(tag.id)
                                      ? prev.filter(t => t !== tag.id)
                                      : [...prev, tag.id]
                                  )
                                }
                                className="w-4 h-4 text-primary-600 rounded"
                              />
                              <span className="text-sm text-gray-700">{tag.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected tag pills */}
                    {selectedTags.map(tagId => (
                      <span
                        key={tagId}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium"
                      >
                        {availableTagsMap[tagId] || tagId.slice(0, 8)}
                        <button
                          onClick={() => setSelectedTags(prev => prev.filter(t => t !== tagId))}
                          className="ml-1 text-primary-500 hover:text-primary-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}

                    {selectedTags.length > 0 && (
                      <button
                        onClick={() => setSelectedTags([])}
                        className="text-sm text-gray-400 hover:text-gray-600"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                ) : null
              })()}

              {/* Sort */}
              <div className="mt-4 flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">
                  Sort by:
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border-2 border-gray-200 rounded-xl 
                           focus:border-primary-500 focus:ring-2 focus:ring-primary-100
                           transition-all bg-white text-sm"
                >
                  <option value="date-desc">Date (Newest First)</option>
                  <option value="date-asc">Date (Oldest First)</option>
                  <option value="submissions-desc">Most Submissions</option>
                  <option value="submissions-asc">Least Submissions</option>
                  <option value="completion-desc">Highest Completion</option>
                  <option value="completion-asc">Lowest Completion</option>
                </select>

                {/* Results count */}
                <span className="text-sm text-gray-500 ml-auto">
                  {filteredChallenges.length} of {challenges.length} challenges
                </span>
              </div>
            </Card.Body>
          </Card>
        )}

        {/* ── Week Schedule Grid (teacher/admin only) ── */}
        {isTeacher && weekDates.length > 0 && weekGridClasses.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              📅 Weekly Schedule
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {/* Class column header */}
                    <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-600 min-w-[140px] border-r border-gray-200">
                      Class
                    </th>
                    {weekDates.map((d, i) => {
                      const dateObj = new Date(d + 'T12:00:00')
                      const isToday = d === localDateString()
                      const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
                      const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      return (
                        <th
                          key={d}
                          className={`px-3 py-3 text-center font-semibold min-w-[120px] ${
                            isToday
                              ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-400'
                              : 'text-gray-600'
                          }`}
                        >
                          <div className="text-xs font-bold uppercase tracking-wide">{dayLabel}</div>
                          <div className={`text-sm ${isToday ? 'font-bold' : 'font-normal'}`}>{dateLabel}</div>
                          {isToday && <div className="text-xs text-primary-500 font-medium">Today</div>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {weekGridClasses.map((cls, rowIdx) => (
                    <tr key={cls.id} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      {/* Class name */}
                      <td className="sticky left-0 z-10 px-4 py-3 font-semibold text-gray-800 border-r border-gray-200 bg-inherit">
                        {cls.name}
                      </td>
                      {weekDates.map(d => {
                        const isToday = d === localDateString()
                        const entry = weekGrid[cls.id]?.[d]
                        return (
                          <td
                            key={d}
                            className={`px-2 py-2 text-center align-middle ${isToday ? 'bg-primary-50/40' : ''}`}
                          >
                            {entry ? (
                              <a
                                href={`/challenges/${entry.id}`}
                                className="inline-block w-full px-2 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs font-medium hover:bg-green-100 hover:border-green-400 transition-colors leading-tight"
                                title={entry.title}
                              >
                                <span className="line-clamp-2">{entry.title}</span>
                              </a>
                            ) : (
                              <button
                                onClick={() => openPickModal(cls.id, cls.name, d)}
                                className="inline-flex items-center justify-center gap-1 w-full px-2 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-400 text-xs hover:border-primary-400 hover:text-primary-500 hover:bg-primary-50 transition-colors"
                              >
                                <span>+</span>
                                <span>Add</span>
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Today's Challenge */}
        {todayChallenges.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="hidden sm:inline">🔥</span>
              Today&apos;s Challenges ({todayChallenges.length})
            </h2>
            <div className="space-y-4">
              {todayChallenges.map(challenge => (
                <Card key={challenge.id} className="border-2 border-primary-500">
                  <Card.Header>
                    <div className="flex items-center justify-between">
                      <Card.Title className="flex items-center gap-2">
                        <span className="hidden sm:inline">🔥</span>
                        {challenge.title}
                      </Card.Title>
                      <span className="text-sm text-primary-600 font-semibold">
                        Active Now
                      </span>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {challenge.description}
                    </p>
                    
                    {/* Stats for teachers */}
                    {isTeacher && challenge.submission_count !== undefined && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            📊 {challenge.submission_count} / {challenge.total_students} submitted
                          </span>
                          <span className="text-sm font-semibold text-primary-600">
                            {challenge.completion_rate}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary-500 h-2 rounded-full transition-all"
                            style={{ width: `${challenge.completion_rate}%` }}
                          />
                        </div>
                        {challenge.class_names && challenge.class_names.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            Classes: {challenge.class_names.join(', ')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Grade for students */}
                    {!isTeacher && (
                      <div className="mb-4 flex items-center gap-2 text-sm">
                        {challenge.my_submitted ? (
                          <>
                            <span className="text-green-600">✅ Submitted</span>
                            {challenge.my_points != null ? (
                              <span className="px-2 py-0.5 rounded-full font-bold bg-primary-100 text-primary-700">
                                {challenge.my_points}/{challenge.max_points || 100}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                ⏳ Pending
                              </span>
                            )}
                            {challenge.my_is_locked && <span className="text-gray-400">🔒</span>}
                          </>
                        ) : (
                          <span className="text-orange-500">⏳ Not submitted</span>
                        )}
                      </div>
                    )}
                    
                    <Button
                      onClick={() => router.push(`/challenges/${challenge.id}`)}
                      fullWidth
                    >
                      <span className="mr-2">🚀</span>
                      View Challenge
                    </Button>
                  </Card.Body>
                </Card>
              ))}
            </div>
          </div>
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
        {(upcomingChallenges.length > 0 || pastChallenges.length > 0) && (
          <>
            {/* Upcoming Challenges */}
            {upcomingChallenges.length > 0 && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="hidden sm:inline">📅</span>
                  Upcoming Challenges ({upcomingChallenges.length})
                </h2>
                <div className="space-y-4 mb-8">
                  {upcomingChallenges.slice(0, showAllUpcoming ? undefined : ITEMS_PER_PAGE).map(challenge => (
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
                            <p className="text-xs text-gray-500 mb-2">
                              {new Date(challenge.challenge_date + 'T12:00:00').toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </p>
                            
                            {/* Stats for teachers */}
                            {isTeacher && challenge.submission_count !== undefined && (
                              <div className="flex items-center gap-4 text-xs text-gray-600">
                                <span>📊 {challenge.submission_count}/{challenge.total_students}</span>
                                <span className="text-primary-600 font-semibold">{challenge.completion_rate}%</span>
                                {challenge.class_names && challenge.class_names.length > 0 && (
                                  <span className="text-gray-500">
                                    {challenge.class_names.join(', ')}
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Grade for students */}
                            {!isTeacher && challenge.my_submitted && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-green-600">✅ Submitted</span>
                                {challenge.my_points != null ? (
                                  <span className="px-2 py-0.5 rounded-full font-bold bg-primary-100 text-primary-700">
                                    {challenge.my_points}/{challenge.max_points || 100}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">
                                    ⏳ Pending
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <span className="text-2xl ml-4">→</span>
                        </div>
                      </Card.Body>
                    </Card>
                  ))}
                  
                  {/* Show More Button */}
                  {upcomingChallenges.length > ITEMS_PER_PAGE && !showAllUpcoming && (
                    <Button
                      variant="outline"
                      onClick={() => setShowAllUpcoming(true)}
                      fullWidth
                    >
                      Show More ({upcomingChallenges.length - ITEMS_PER_PAGE} more)
                    </Button>
                  )}
                </div>
              </>
            )}

            {/* Past Challenges */}
            {pastChallenges.length > 0 && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="hidden sm:inline">📚</span>
                  Past Challenges ({pastChallenges.length})
                </h2>
                <div className="space-y-4">
                  {pastChallenges.slice(0, showAllPast ? undefined : ITEMS_PER_PAGE).map(challenge => (
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
                            <p className="text-xs text-gray-500 mb-2">
                              {new Date(challenge.challenge_date + 'T12:00:00').toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </p>
                            
                            {/* Stats for teachers */}
                            {isTeacher && challenge.submission_count !== undefined && (
                              <div className="flex items-center gap-4 text-xs text-gray-600">
                                <span>📊 {challenge.submission_count}/{challenge.total_students}</span>
                                <span className="text-primary-600 font-semibold">{challenge.completion_rate}%</span>
                                {challenge.class_names && challenge.class_names.length > 0 && (
                                  <span className="text-gray-500">
                                    {challenge.class_names.join(', ')}
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Grade for students */}
                            {!isTeacher && (
                              <div className="flex items-center gap-2 text-xs">
                                {challenge.my_submitted ? (
                                  <>
                                    <span className="text-green-600">✅ Submitted</span>
                                    {challenge.my_points != null ? (
                                      <span className="px-2 py-0.5 rounded-full font-bold bg-primary-100 text-primary-700">
                                        {challenge.my_points}/{challenge.max_points || 100}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">
                                        ⏳ Pending
                                      </span>
                                    )}
                                    {challenge.my_is_locked && <span className="text-gray-400">🔒</span>}
                                  </>
                                ) : (
                                  <span className="text-orange-500">⏳ Not submitted</span>
                                )}
                              </div>
                            )}
                            {/* Tags */}
                            {challenge.tag_ids && challenge.tag_ids.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {challenge.tag_ids.map(tagId => (
                                  <span key={tagId} className="px-2 py-0.5 bg-primary-50 text-primary-600 rounded-full text-xs font-medium">
                                    {availableTagsMap[tagId] || tagId.slice(0, 8)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-2xl ml-4">→</span>
                        </div>
                      </Card.Body>
                    </Card>
                  ))}
                  
                  {/* Show More Button */}
                  {pastChallenges.length > ITEMS_PER_PAGE && !showAllPast && (
                    <Button
                      variant="outline"
                      onClick={() => setShowAllPast(true)}
                      fullWidth
                    >
                      Show More ({pastChallenges.length - ITEMS_PER_PAGE} more)
                    </Button>
                  )}
                </div>
              </>
            )}
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

      {/* ── Assign-from-bank modal ── */}
      {pickTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Assign from Challenge Bank</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="font-medium text-gray-700">{pickTarget.className}</span>
                  {' · '}
                  {new Date(pickTarget.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setPickTarget(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5"
              >
                ×
              </button>
            </div>

            {/* Search — hidden in confirm stage */}
            {!pendingChallenge && (
            <div className="px-6 py-3 border-b border-gray-100 shrink-0">
              <input
                type="text"
                value={bankSearch}
                onChange={e => setBankSearch(e.target.value)}
                placeholder="Search by title, description or tag…"
                autoFocus
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
              />
              {usedBankIds.size > 0 && (
                <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showUsed}
                    onChange={e => setShowUsed(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-primary-600"
                  />
                  <span className="text-xs text-gray-500">
                    Show {usedBankIds.size} already-used problem{usedBankIds.size !== 1 ? 's' : ''} (≥2 submissions from this class)
                  </span>
                </label>
              )}
            </div>
            )}

            {/* Challenge list — or confirm panel */}
            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
              {pendingChallenge ? (
                /* ── Confirm stage ── */
                <div className="space-y-4 py-2">
                  <div className="p-4 rounded-xl bg-primary-50 border border-primary-200">
                    <p className="text-xs font-semibold text-primary-500 uppercase tracking-wide mb-1">Selected challenge</p>
                    <p className="font-bold text-gray-900">{pendingChallenge.title}</p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-4">{pendingChallenge.description}</p>
                    {pendingChallenge.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pendingChallenge.image_url}
                        alt="Challenge"
                        className="mt-3 w-full rounded-lg object-contain max-h-48 bg-white border border-primary-100"
                      />
                    )}
                    {pendingChallenge.tag_ids.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {pendingChallenge.tag_ids.map(tid => bankTagMap[tid] ? (
                          <span key={tid} className="px-2 py-0.5 bg-white text-primary-600 rounded-full text-xs border border-primary-200">
                            {bankTagMap[tid]}
                          </span>
                        ) : null)}
                      </div>
                    )}
                  </div>
                  {usedBankIds.has(pendingChallenge.id) && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                      ⚠️ This problem has been assigned to this class before with ≥2 submissions. The old assignment will be retired and prior submissions carried over.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPendingChallenge(null)}
                      className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => handleAssignFromBank(pendingChallenge)}
                      disabled={assigning}
                      className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
                    >
                      {assigning ? 'Publishing…' : '✓ Confirm & Publish'}
                    </button>
                  </div>
                </div>
              ) : bankLoading ? (
                <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>
              ) : bankChallenges.filter(c => {
                  const q = bankSearch.trim().toLowerCase()
                  const matchesSearch = !q ||
                    c.title.toLowerCase().includes(q) ||
                    c.description.toLowerCase().includes(q) ||
                    c.tag_ids.some(tid => (bankTagMap[tid] || '').toLowerCase().includes(q))
                  const notHidden = showUsed || !usedBankIds.has(c.id)
                  return matchesSearch && notHidden
                }).length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">No challenges found</p>
              ) : (
                bankChallenges
                  .filter(c => {
                    const q = bankSearch.trim().toLowerCase()
                    const matchesSearch = !q ||
                      c.title.toLowerCase().includes(q) ||
                      c.description.toLowerCase().includes(q) ||
                      c.tag_ids.some(tid => (bankTagMap[tid] || '').toLowerCase().includes(q))
                    const notHidden = showUsed || !usedBankIds.has(c.id)
                    return matchesSearch && notHidden
                  })
                  .map(c => (
                    <div
                      key={c.id}
                      className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-primary-300 hover:bg-primary-50/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{c.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>
                        {c.tag_ids.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {c.tag_ids.map(tid => bankTagMap[tid] ? (
                              <span key={tid} className="px-2 py-0.5 bg-primary-50 text-primary-600 rounded-full text-xs">
                                {bankTagMap[tid]}
                              </span>
                            ) : null)}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setPendingChallenge(c)}
                        className="shrink-0 px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        {assigning ? '…' : 'Select →'}
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 shrink-0">
              <button
                onClick={() => setPickTarget(null)}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
