'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

interface ClassData {
  id: string
  name: string
  description: string
  cover_image_url: string | null
  age_range: string | null
  skill_level: string | null
  price: number | null
  location: string | null
  max_students: number | null
  current_students: number
  schedule: Array<{ day: string; startTime: string; endTime: string }> | null
  created_by: string
  teacher_name: string
  target_audience: string | null
}

export default function ExploreClassesPage() {
  const [classes, setClasses] = useState<ClassData[]>([])
  const [filteredClasses, setFilteredClasses] = useState<ClassData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGrade, setSelectedGrade] = useState<string>('all')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadPublicClasses()
  }, [])

  useEffect(() => {
    filterClasses()
  }, [searchQuery, selectedGrade, classes])

  async function loadPublicClasses() {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          description,
          cover_image_url,
          age_range,
          skill_level,
          price,
          location,
          max_students,
          current_students,
          schedule,
          created_by,
          target_audience,
          profiles!classes_created_by_fkey(full_name)
        `)
        .eq('is_public', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      const classesWithTeacher = data.map((cls: any) => ({
        ...cls,
        teacher_name: cls.profiles?.full_name || 'Unknown Teacher'
      }))

      setClasses(classesWithTeacher)
      setFilteredClasses(classesWithTeacher)
    } catch (err) {
      console.error('Failed to load classes:', err)
    } finally {
      setLoading(false)
    }
  }

  function filterClasses() {
    let filtered = [...classes]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(cls =>
        cls.name.toLowerCase().includes(query) ||
        cls.description?.toLowerCase().includes(query) ||
        cls.teacher_name.toLowerCase().includes(query) ||
        cls.target_audience?.toLowerCase().includes(query)
      )
    }

    // Grade filter
    if (selectedGrade !== 'all') {
      filtered = filtered.filter(cls => {
        if (!cls.age_range) return false
        // Match if the age_range contains the selected grade
        return cls.age_range.toLowerCase().includes(selectedGrade.toLowerCase())
      })
    }

    setFilteredClasses(filtered)
  }

  function formatSchedule(schedule: any) {
    if (!schedule || !Array.isArray(schedule) || schedule.length === 0) {
      return 'Schedule TBA'
    }
    const first = schedule[0]
    if (schedule.length === 1) {
      return `${first.day}s ${first.startTime}`
    }
    return `${schedule.length} sessions/week`
  }

  function getSpotsAvailable(cls: ClassData) {
    if (!cls.max_students) return null
    const available = cls.max_students - (cls.current_students || 0)
    return available
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-12 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                  <div className="h-64 bg-gray-200"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-6 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.push('/dashboard')}
              >
                ← Home
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Explore Classes</h1>
                <p className="text-gray-600 mt-1">Discover amazing learning opportunities</p>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search classes, teachers, topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-12 border-2 border-gray-200 rounded-xl 
                         focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
            </div>

            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl 
                       focus:border-blue-500 focus:ring-4 focus:ring-blue-100 
                       bg-white transition-all"
            >
              <option value="all">All Grades</option>
              <option value="K">Kindergarten</option>
              <option value="1">Grade 1</option>
              <option value="2">Grade 2</option>
              <option value="3">Grade 3</option>
              <option value="4">Grade 4</option>
              <option value="5">Grade 5</option>
              <option value="6">Grade 6</option>
              <option value="7">Grade 7</option>
              <option value="8">Grade 8</option>
              <option value="9">Grade 9</option>
              <option value="10">Grade 10</option>
              <option value="11">Grade 11</option>
              <option value="12">Grade 12</option>
            </select>
          </div>

          {/* Results count */}
          <div className="mt-4 text-sm text-gray-600">
            {filteredClasses.length} {filteredClasses.length === 1 ? 'class' : 'classes'} found
          </div>
        </div>
      </header>

      {/* Classes Grid */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {filteredClasses.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No classes found</h2>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClasses.map((cls) => {
              const spotsAvailable = getSpotsAvailable(cls)
              const isAlmostFull = spotsAvailable !== null && spotsAvailable <= 3 && spotsAvailable > 0

              return (
                <div
                  key={cls.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl 
                           transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                  onClick={() => router.push(`/classes/${cls.id}`)}
                >
                  {/* Cover Image */}
                  <div className="relative h-64 bg-gradient-to-br from-blue-400 to-purple-500 overflow-hidden">
                    {cls.cover_image_url ? (
                      <img
                        src={cls.cover_image_url}
                        alt={cls.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-8xl">📚</span>
                      </div>
                    )}
                    
                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                      {cls.skill_level && (
                        <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full 
                                       text-xs font-semibold text-gray-800 capitalize">
                          {cls.skill_level}
                        </span>
                      )}
                      {isAlmostFull && (
                        <span className="px-3 py-1 bg-orange-500/90 backdrop-blur-sm rounded-full 
                                       text-xs font-semibold text-white">
                          🔥 Almost Full
                        </span>
                      )}
                    </div>

                    {/* Price */}
                    {cls.price !== null && (
                      <div className="absolute top-3 right-3">
                        <span className="px-3 py-1 bg-green-500/90 backdrop-blur-sm rounded-full 
                                       text-sm font-bold text-white">
                          ${cls.price}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    {/* Class Name */}
                    <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                      {cls.name}
                    </h3>

                    {/* Teacher */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm text-gray-600">👨‍🏫</span>
                      <span className="text-sm font-medium text-gray-700">{cls.teacher_name}</span>
                    </div>

                    {/* Description */}
                    {cls.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {cls.description}
                      </p>
                    )}

                    {/* Meta Info */}
                    <div className="space-y-2 mb-4">
                      {cls.age_range && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>🎯</span>
                          <span>{cls.age_range}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>📅</span>
                        <span>{formatSchedule(cls.schedule)}</span>
                      </div>

                      {cls.location && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>📍</span>
                          <span>{cls.location}</span>
                        </div>
                      )}

                      {spotsAvailable !== null && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>👥</span>
                          <span>
                            {spotsAvailable > 0 
                              ? `${spotsAvailable} spot${spotsAvailable !== 1 ? 's' : ''} left`
                              : 'Class full'
                            }
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div
                      className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 
                               text-white font-semibold rounded-xl text-center
                               transition-all duration-200"
                    >
                      View Details →
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
