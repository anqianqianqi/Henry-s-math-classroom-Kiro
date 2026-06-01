'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Student {
  id: string
  full_name: string
  first_name?: string | null
  last_name?: string | null
  nickname?: string | null
  email?: string
  submission_count?: number
}

export default function StudentsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [students, setStudents] = useState<Student[]>([])
  const [filtered, setFiltered] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStudents()
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      students.filter(s =>
        (s.full_name || '').toLowerCase().includes(q) ||
        (s.first_name || '').toLowerCase().includes(q) ||
        (s.last_name || '').toLowerCase().includes(q) ||
        (s.nickname || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      )
    )
  }, [search, students])

  async function loadStudents() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Verify teacher/admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_id, roles!inner(name)')
      .eq('user_id', user.id)
      .is('class_id', null)

    const isTeacher = (roles || []).some((r: any) =>
      r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
    )
    if (!isTeacher) { router.push('/dashboard'); return }

    // Get all student user IDs (exclude teachers/admins)
    const { data: teacherRoles } = await supabase
      .from('user_roles')
      .select('user_id, roles!inner(name)')
      .is('class_id', null)

    const teacherIds = new Set(
      (teacherRoles || [])
        .filter((r: any) => r.roles?.name === 'teacher' || r.roles?.name === 'administrator')
        .map((r: any) => r.user_id)
    )

    // Get all profiles that are not teachers
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name, nickname, email')
      .order('full_name')

    const studentProfiles = (profiles || []).filter(p => !teacherIds.has(p.id))

    // Get submission counts per student
    const studentIds = studentProfiles.map(p => p.id)
    let submissionCounts: Record<string, number> = {}

    if (studentIds.length > 0) {
      const { data: subs } = await supabase
        .from('challenge_submissions')
        .select('user_id')
        .in('user_id', studentIds)

      for (const s of subs || []) {
        submissionCounts[s.user_id] = (submissionCounts[s.user_id] || 0) + 1
      }
    }

    const result: Student[] = studentProfiles.map(p => ({
      ...p,
      submission_count: submissionCounts[p.id] || 0,
    }))

    setStudents(result)
    setFiltered(result)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-gray-600">Loading students...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Student History</h1>
              <p className="text-sm text-gray-500">{students.length} students</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
        {/* Search */}
        <div className="mb-5">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all bg-white"
          />
        </div>

        {filtered.length === 0 ? (
          <Card className="text-center py-16">
            <div className="text-5xl mb-4">👥</div>
            <h3 className="text-lg font-semibold text-gray-700">
              {search ? 'No students found' : 'No students yet'}
            </h3>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(student => {
              const name = [student.first_name, student.last_name].filter(Boolean).join(' ')
                || student.full_name
                || student.nickname
                || 'Unknown'
              return (
                <div
                  key={student.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-200 transition-all cursor-pointer p-4 flex items-center justify-between"
                  onClick={() => router.push(`/students/${student.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm flex-shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{name}</div>
                      {student.email && (
                        <div className="text-sm text-gray-500">{student.email}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary-600">{student.submission_count}</div>
                      <div className="text-xs text-gray-400">submissions</div>
                    </div>
                    <span className="text-gray-300 text-lg">→</span>
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
