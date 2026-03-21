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

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(cls =>
        cls.name.toLowerCase().includes(query) ||
        cls.description?.toLowerCase().includes(query) ||
        cls.teacher_name.toLowerCase().includes(query) ||
        cls.target_audience?.toLowerCase().includes(query)
      )
    }

    if (selectedGrade !== 'all') {
      filtered = filtered.filter(cls => {
        if (!cls.age_range) return false
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

  function getClassTags(cls: ClassData) {
    const tags: Array<{ label: string; color: string; bgColor: string }> = []
    const nameAndDesc = `${cls.name} ${cls.description || ''}`.toLowerCase()
    
    // Competition Prep Tags - AMC, MATHCOUNTS, etc.
    if (nameAndDesc.includes('amc8') || nameAndDesc.includes('amc 8')) {
      tags.push({ label: 'AMC 8', color: 'text-yellow-800', bgColor: 'bg-yellow-100' })
    }
    if (nameAndDesc.includes('amc10') || nameAndDesc.includes('amc 10')) {
      tags.push({ label: 'AMC 10', color: 'text-yellow-800', bgColor: 'bg-yellow-100' })
    }
    if (nameAndDesc.includes('amc12') || nameAndDesc.includes('amc 12')) {
      tags.push({ label: 'AMC 12', color: 'text-yellow-800', bgColor: 'bg-yellow-100' })
    }
    if (nameAndDesc.includes('mathcounts')) {
      tags.push({ label: 'MATHCOUNTS', color: 'text-yellow-800', bgColor: 'bg-yellow-100' })
    }
    if (nameAndDesc.includes('usaco')) {
      tags.push({ label: 'USACO', color: 'text-blue-800', bgColor: 'bg-blue-100' })
    }
    
    // Game-Based Learning
    if (nameAndDesc.includes('game') || nameAndDesc.includes('gaming') || 
        nameAndDesc.includes('minecraft') || nameAndDesc.includes('roblox')) {
      tags.push({ label: 'GAME', color: 'text-purple-800', bgColor: 'bg-purple-100' })
    }
    
    // Fun & Interactive
    if (nameAndDesc.includes('fun') || nameAndDesc.includes('exciting') || 
        nameAndDesc.includes('adventure')) {
      tags.push({ label: 'FUN', color: 'text-pink-800', bgColor: 'bg-pink-100' })
    }
    
    // Early Education (K-3)
    if (cls.age_range?.match(/K|kindergarten|grade [1-3]|ages [3-8]/i) ||
        nameAndDesc.includes('early') || nameAndDesc.includes('beginner') ||
        nameAndDesc.includes('starter')) {
      tags.push({ label: 'EARLY EDUCATION', color: 'text-green-800', bgColor: 'bg-green-100' })
    }
    
    // Advanced/Gifted
    if (nameAndDesc.includes('advanced') || nameAndDesc.includes('gifted') || 
        nameAndDesc.includes('honors') || nameAndDesc.includes('accelerated')) {
      tags.push({ label: 'ADVANCED', color: 'text-red-800', bgColor: 'bg-red-100' })
    }
    
    // Coding/Programming
    if (nameAndDesc.includes('coding') || nameAndDesc.includes('programming') || 
        nameAndDesc.includes('python') || nameAndDesc.includes('javascript')) {
      tags.push({ label: 'CODING', color: 'text-indigo-800', bgColor: 'bg-indigo-100' })
    }
    
    // STEM
    if (nameAndDesc.includes('stem') || nameAndDesc.includes('science') || 
        nameAndDesc.includes('engineering') || nameAndDesc.includes('robotics')) {
      tags.push({ label: 'STEM', color: 'text-cyan-800', bgColor: 'bg-cyan-100' })
    }
    
    // Math specific
    if (nameAndDesc.includes('math') || nameAndDesc.includes('algebra') || 
        nameAndDesc.includes('geometry') || nameAndDesc.includes('calculus')) {
      tags.push({ label: 'MATH', color: 'text-blue-800', bgColor: 'bg-blue-100' })
    }
    
    // Art & Creative
    if (nameAndDesc.includes('art') || nameAndDesc.includes('creative') || 
        nameAndDesc.includes('drawing') || nameAndDesc.includes('painting')) {
      tags.push({ label: 'CREATIVE', color: 'text-pink-800', bgColor: 'bg-pink-100' })
    }
    
    // Small Class Size
    if (cls.max_students && cls.max_students <= 10) {
      tags.push({ label: 'SMALL CLASS', color: 'text-teal-800', bgColor: 'bg-teal-100' })
    }
    
    // Popular (high enrollment)
    const enrollmentRate = cls.max_students ? (cls.current_students / cls.max_students) : 0
    if (enrollmentRate > 0.6 && cls.current_students >= 3) {
      tags.push({ label: 'POPULAR', color: 'text-orange-800', bgColor: 'bg-orange-100' })
    }
    
    // If no specific tags matched, add a general one
    if (tags.length === 0) {
      tags.push({ label: 'FEATURED', color: 'text-purple-800', bgColor: 'bg-purple-100' })
    }
    
    // Limit to 3 tags for clean display
    return tags.slice(0, 3)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-32 bg-gradient-to-r from-indigo-200 to-purple-200 rounded-3xl"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-lg">
                  <div className="h-56 bg-gradient-to-br from-gray-200 to-gray-300"></div>
                  <div className="p-6 space-y-3">
                    <div className="h-6 bg-gray-200 rounded-lg"></div>
                    <div className="h-4 bg-gray-200 rounded-lg w-2/3"></div>
                    <div className="flex gap-2">
                      <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
                      <div className="h-6 w-24 bg-gray-200 rounded-full"></div>
                    </div>
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section - Modern with subtle accent */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard')}
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 mb-6 transition-all"
          >
            ← Back to Dashboard
          </Button>
          
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-transparent">
              Explore Classes
            </h1>
            <p className="text-xl text-slate-600">
              Find the perfect class for your learning journey
            </p>
          </div>

          {/* Search and Filters - Modern with subtle shadow */}
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative group">
                <input
                  type="text"
                  placeholder="Search by class name, teacher, or topic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-6 py-4 pl-14 text-slate-900 bg-white rounded-xl 
                           border border-slate-200 focus:border-indigo-400 focus:ring-4 
                           focus:ring-indigo-50 transition-all placeholder:text-slate-400 text-lg
                           shadow-sm hover:shadow-md"
                />
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 
                             w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="px-6 py-4 text-slate-900 bg-white rounded-xl border border-slate-200
                         focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all 
                         text-lg font-medium cursor-pointer shadow-sm hover:shadow-md"
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
            <div className="mt-5 text-center">
              <span className="inline-block px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
                {filteredClasses.length} {filteredClasses.length === 1 ? 'class' : 'classes'} available
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Classes Grid */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {filteredClasses.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-7xl mb-6">🔍</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">No classes found</h2>
            <p className="text-lg text-gray-600 mb-6">Try adjusting your search or filters</p>
            <Button onClick={() => { setSearchQuery(''); setSelectedGrade('all') }}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredClasses.map((cls) => {
              const spotsAvailable = getSpotsAvailable(cls)
              const isAlmostFull = spotsAvailable !== null && spotsAvailable <= 3 && spotsAvailable > 0
              const classTags = getClassTags(cls)

              return (
                <div
                  key={cls.id}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg 
                           transition-all duration-300 cursor-pointer border border-gray-200
                           hover:border-indigo-200"
                  onClick={() => router.push(`/classes/${cls.id}`)}
                >
                  {/* Cover Image */}
                  <div className="relative h-56 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                    {cls.cover_image_url ? (
                      <img
                        src={cls.cover_image_url}
                        alt={cls.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                        <span className="text-7xl group-hover:scale-110 transition-transform duration-300">📚</span>
                      </div>
                    )}
                    
                    {/* Skill Level Badge */}
                    <div className="absolute top-4 left-4">
                      {cls.skill_level && (
                        <span className="px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-lg 
                                       text-xs font-bold text-gray-800 capitalize shadow-sm border border-gray-200">
                          {cls.skill_level}
                        </span>
                      )}
                    </div>

                    {/* Price */}
                    {cls.price !== null && (
                      <div className="absolute top-4 right-4">
                        <span className="px-4 py-1.5 bg-green-500 rounded-lg 
                                       text-sm font-bold text-white shadow-sm">
                          ${cls.price}
                        </span>
                      </div>
                    )}

                    {/* Almost Full Badge */}
                    {isAlmostFull && (
                      <div className="absolute bottom-4 right-4">
                        <span className="px-3 py-1.5 bg-orange-500 rounded-lg 
                                       text-xs font-bold text-white shadow-sm">
                          🔥 Almost Full
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    {/* Class Name */}
                    <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                      {cls.name}
                    </h3>

                    {/* Colorful Tags - Always visible */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {classTags.map((tag, index) => (
                        <span
                          key={index}
                          className={`px-3 py-1 rounded-lg text-xs font-bold ${tag.bgColor} ${tag.color} border border-current/20`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>

                    {/* Teacher */}
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 
                                    flex items-center justify-center text-white text-sm font-bold">
                        {cls.teacher_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{cls.teacher_name}</span>
                    </div>

                    {/* Description */}
                    {cls.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                        {cls.description}
                      </p>
                    )}

                    {/* Meta Info */}
                    <div className="space-y-2.5 mb-5">
                      {cls.age_range && (
                        <div className="flex items-center gap-2.5 text-sm text-gray-600">
                          <span className="text-base">🎯</span>
                          <span className="font-medium">{cls.age_range}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2.5 text-sm text-gray-600">
                        <span className="text-base">📅</span>
                        <span className="font-medium">{formatSchedule(cls.schedule)}</span>
                      </div>

                      {cls.location && (
                        <div className="flex items-center gap-2.5 text-sm text-gray-600">
                          <span className="text-base">📍</span>
                          <span className="font-medium">{cls.location}</span>
                        </div>
                      )}

                      {spotsAvailable !== null && (
                        <div className="flex items-center gap-2.5 text-sm">
                          <span className="text-base">👥</span>
                          <span className={`font-semibold ${
                            spotsAvailable === 0 ? 'text-red-600' : 
                            spotsAvailable <= 3 ? 'text-orange-600' : 
                            'text-green-600'
                          }`}>
                            {spotsAvailable > 0 
                              ? `${spotsAvailable} spot${spotsAvailable !== 1 ? 's' : ''} left`
                              : 'Class full'
                            }
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <button
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700
                               text-white font-semibold rounded-xl text-center
                               transition-all duration-200 group-hover:shadow-md"
                    >
                      View Details →
                    </button>
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
