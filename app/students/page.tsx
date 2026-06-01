'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface UserEntry {
  id: string
  full_name: string
  first_name?: string | null
  last_name?: string | null
  nickname?: string | null
  email?: string
  submission_count?: number
  role?: string  // 'student' | 'teacher' | 'administrator' | 'none'
}

export default function StudentsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [allUsers, setAllUsers] = useState<UserEntry[]>([])
  const [filtered, setFiltered] = useState<UserEntry[]>([])
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadUsers() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    const base = showAll ? allUsers : allUsers.filter(u => u.role === 'student')
    setFiltered(
      base.filter(s =>
        (s.full_name || '').toLowerCase().includes(q) ||
        (s.first_name || '').toLowerCase().includes(q) ||
        (s.last_name || '').toLowerCase().includes(q) ||
        (s.nickname || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      )
    )
  }, [search, showAll, allUsers])

  async function loadUsers() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Verify teacher/admin
    const { data: myRoles } = await supabase
      .from('user_roles')
      .select('role_id, roles!inner(name)')
      .eq('user_id', user.id)
      .is('class_id', null)

    const isTeacher = (myRoles || []).some((r: any) =>
      r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
    )
    if (!isTeacher) { router.push('/dashboard'); return }

    // Get all global roles (class_id IS NULL)
    const { data: allRoles } = await supabase
      .from('user_roles')
      .select('user_id, roles!inner(name)')
      .is('class_id', null)

    // Build a map: user_id → highest role
    const roleMap: Record<string, string> = {}
    for (const r of allRoles || []) {
      const name = (r as any).roles?.name
      if (!name) continue
      // Priority: administrator > teacher > student
      const current = roleMap[r.user_id]
      if (!current || name === 'administrator' || (name === 'teacher' && current === 'student')) {
        roleMap[r.user_id] = name
      }
    }

    // Get all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name, nickname, email')
      .order('full_name')

    const allIds = (profiles || []).map(p => p.id)

    // Get submission counts
    let submissionCounts: Record<string, number> = {}
    if (allIds.length > 0) {
      const { data: subs } = await supabase
        .from('challenge_submissions')
        .select('user_id')
        .in('user_id', allIds)
      for (const s of subs || []) {
        submissionCounts[s.user_id] = (submissionCounts[s.user_id] || 0) + 1
      }
    }

    const result: UserEntry[] = (profiles || []).map(p => ({
      ...p,
      submission_count: submissionCounts[p.id] || 0,
      role: roleMap[p.id] || 'none',
    }))

    setAllUsers(result)
    setLoading(false)
  }

  const studentCount = allUsers.filter(u => u.role === 'student').length
  const displayCount = showAll ? allUsers.length : studentCount

  const roleLabel = (role?: string) => {
    if (role === 'teacher') return <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Teacher</span>
    if (role === 'administrator') return <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">Admin</span>
    if (role === 'none') return <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">No role</span>
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Student History</h1>
                <p className="text-sm text-gray-500">{displayCount} {showAll ? 'users' : 'students'}</p>
              </div>
            </div>
            {/* Toggle */}
            <button
              onClick={() => setShowAll(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                showAll
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
              }`}
            >
              {showAll ? '👥 All users' : '🎓 Students only'}
            </button>
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
              {search ? 'No users found' : showAll ? 'No users yet' : 'No students yet'}
            </h3>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(u => {
              const name = [u.first_name, u.last_name].filter(Boolean).join(' ')
                || u.full_name || u.nickname || 'Unknown'
              return (
                <div
                  key={u.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-200 transition-all cursor-pointer p-4 flex items-center justify-between"
                  onClick={() => router.push(`/students/${u.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm flex-shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{name}</span>
                        {showAll && roleLabel(u.role)}
                      </div>
                      {u.email && (
                        <div className="text-sm text-gray-500">{u.email}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary-600">{u.submission_count}</div>
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
