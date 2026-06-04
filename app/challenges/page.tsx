'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { runSchedulerForClass } from '@/lib/scheduler'
import { Button } from '@/components/ui/Button'
import { HomeButton } from '@/components/ui/HomeButton'
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

        const withExtras = await Promise.all(
          challengesData.map(async (c) => {
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
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
                ← Back
              </Button>
              <HomeButton />
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Challenges</h1>
                <select
                  value={tagLang}
                  onChange={e => setTagLang(e.target.value as 'en' | 'zh')}
                  className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white"
                >
                  <option value="en">EN</option>
                  <option value="zh">CN</option>
                </select>
              </div>
            </div>
            {isTeacher && (
              <div className="flex gap-1 sm:gap-2">
                <Button size="sm" onClick={() => router.push('/challenges/new')}>
                  + New
                </Button>
                <Button size="sm" onClick={() => router.push('/admin/generative-templates')} variant="secondary">
                  Templates
                </Button>
                <Button size="sm" onClick={() => router.push('/admin/schedules')} variant="secondary">
                  Scheduler
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

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
    </div>
  )
}
