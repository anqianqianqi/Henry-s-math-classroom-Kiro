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
  submission_count?: number
  total_students?: number
  completion_rate?: number
  class_names?: string[]
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
  }, [challenges, searchQuery, selectedClass, dateFilter, sortBy])

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

    console.log('🔍 Admin Debug - User roles query:', { roles, userId: user.id })

    let teacherRole = false
    let adminRole = false
    if (roles && roles.length > 0) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .in('id', roles.map((r: any) => r.role_id))

      console.log('🔍 Admin Debug - Role names:', roleData)
      teacherRole = roleData?.some((r: any) => r.name === 'teacher') || false
      adminRole = roleData?.some((r: any) => r.name === 'administrator') || false
      console.log('🔍 Admin Debug - Is teacher?', teacherRole, 'Is admin?', adminRole)
    }
    
    // Treat admin as teacher for UI purposes
    const canSeeAll = teacherRole || adminRole
    console.log('🔍 Admin Debug - Can see all challenges?', canSeeAll)
    setIsTeacher(canSeeAll)

    if (canSeeAll) {
      // Load all classes for filter
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      
      setClasses(classesData || [])

      // Teachers and admins see ALL challenges
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

      console.log('Class members:', classMembers)

      const classIds = classMembers?.map(cm => cm.class_id) || []

      if (classIds.length === 0) {
        setLoading(false)
        return
      }

      const { data: assignments } = await supabase
        .from('challenge_assignments')
        .select('challenge_id')
        .in('class_id', classIds)

      console.log('Assignments:', assignments)

      const challengeIds = assignments?.map(a => a.challenge_id) || []

      if (challengeIds.length === 0) {
        setLoading(false)
        return
      }

      const { data: challengesData } = await supabase
        .from('daily_challenges')
        .select('*')
        .in('id', challengeIds)
        .order('challenge_date', { ascending: false })

      console.log('Challenges:', challengesData)

      setChallenges(challengesData || [])
    }
    
    setLoading(false)
  }

  async function loadChallengeStats(challengeId: string) {
    // Get submission count
    const { count: submissionCount } = await supabase
      .from('challenge_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('challenge_id', challengeId)

    // Get total students in assigned classes
    const { data: assignments } = await supabase
      .from('challenge_assignments')
      .select('class_id')
      .eq('challenge_id', challengeId)

    let totalStudents = 0
    if (assignments && assignments.length > 0) {
      const classIds = assignments.map(a => a.class_id)
      const { count } = await supabase
        .from('class_members')
        .select('*', { count: 'exact', head: true })
        .in('class_id', classIds)
      
      totalStudents = count || 0
    }

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

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query)
      )
    }

    // Apply class filter
    if (selectedClass !== 'all') {
      filtered = filtered.filter(c => 
        c.class_names?.some(name => name === selectedClass)
      )
    }

    // Apply date filter
    const today = new Date().toISOString().split('T')[0]
    if (dateFilter === 'today') {
      filtered = filtered.filter(c => c.challenge_date === today)
    } else if (dateFilter === 'upcoming') {
      filtered = filtered.filter(c => c.challenge_date > today)
    } else if (dateFilter === 'past') {
      filtered = filtered.filter(c => c.challenge_date < today)
    } else if (dateFilter === 'this-week') {
      const weekFromNow = new Date()
      weekFromNow.setDate(weekFromNow.getDate() + 7)
      const weekFromNowStr = weekFromNow.toISOString().split('T')[0]
      filtered = filtered.filter(c => 
        c.challenge_date >= today && c.challenge_date <= weekFromNowStr
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return b.challenge_date.localeCompare(a.challenge_date)
        case 'date-asc':
          return a.challenge_date.localeCompare(b.challenge_date)
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

  const today = new Date().toISOString().split('T')[0]
  const displayChallenges = filteredChallenges.length > 0 ? filteredChallenges : challenges
  const todayChallenges = displayChallenges.filter(c => c.challenge_date === today)
  const upcomingChallenges = displayChallenges.filter(c => c.challenge_date > today)
  const pastChallenges = displayChallenges.filter(c => c.challenge_date < today)

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
              >
                ← Home
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎯</span>
                <h1 className="text-2xl font-bold text-gray-900">Daily Challenges</h1>
              </div>
            </div>
            {isTeacher && (
              <div className="flex gap-2">
                <Button onClick={() => router.push('/challenges/new')}>
                  <span className="mr-2">➕</span>
                  Create Challenge
                </Button>
                <Button onClick={() => router.push('/challenges/templates')} variant="secondary">
                  <span className="mr-2">📝</span>
                  Templates
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters and Search - Teacher Only */}
        {isTeacher && challenges.length > 0 && (
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
              <span>🔥</span>
              Today&apos;s Challenges ({todayChallenges.length})
            </h2>
            <div className="space-y-4">
              {todayChallenges.map(challenge => (
                <Card key={challenge.id} className="border-2 border-primary-500">
                  <Card.Header>
                    <div className="flex items-center justify-between">
                      <Card.Title className="flex items-center gap-2">
                        <span>🔥</span>
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
                  <span>📅</span>
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
                              {new Date(challenge.challenge_date).toLocaleDateString('en-US', {
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
                  <span>📚</span>
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
                              {new Date(challenge.challenge_date).toLocaleDateString('en-US', {
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
