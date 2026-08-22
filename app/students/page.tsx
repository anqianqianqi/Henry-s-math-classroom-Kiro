'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'

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

/** What a user can be set to. Ordered least to most powerful. */
const ROLES = ['student', 'teacher', 'administrator'] as const
type RoleName = (typeof ROLES)[number]

interface CreateUserForm {
  firstName: string
  lastName: string
  email: string
  password: string
  role: RoleName
  classId: string
}

const EMPTY_FORM: CreateUserForm = {
  firstName: '', lastName: '', email: '', password: '', role: 'student', classId: '',
}

export default function StudentsPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = createClient()

  const [allUsers, setAllUsers] = useState<UserEntry[]>([])
  const [filtered, setFiltered] = useState<UserEntry[]>([])
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true)

  /*
    ── Managing users, absorbed from the old roles page ─────────
    Gated on administrator rather than teacher, because that is what
    /api/admin/create-user enforces: a teacher shown the button would only
    ever get a 403 back. Role writes are gated the same way in the UI, and
    RLS remains the real enforcement.
  */
  const [isAdmin, setIsAdmin] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)
  const [form, setForm] = useState<CreateUserForm>(EMPTY_FORM)
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [changingRole, setChangingRole] = useState<string | null>(null)

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

    const admin = (myRoles || []).some((r: any) => r.roles?.name === 'administrator')
    setIsAdmin(admin)
    if (admin) loadClasses()

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

  async function loadClasses() {
    const { data } = await supabase
      .from('classes')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true })
    setClasses(data ?? [])
  }

  async function handleCreateUser(event: React.FormEvent) {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)
    setCreateSuccess(null)

    try {
      // Server-side, because creating an auth user needs the service role key
      // and that must never reach the browser.
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          role: form.role,
          classId: form.classId || null,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setCreateError(data.error ?? t('students.createFailed'))
        return
      }
      setCreateSuccess(t('students.created', { name: data.fullName ?? form.email.trim() }))
      setForm(EMPTY_FORM)
      await loadUsers()
    } catch {
      setCreateError(t('students.networkError'))
    } finally {
      setCreating(false)
    }
  }

  /**
   * Make someone a student, a teacher or an administrator.
   *
   * The new role is inserted BEFORE the old ones are removed. The two writes
   * cannot share a transaction over PostgREST, so one of them has to fail
   * first — and a user briefly holding two roles is recoverable, while a user
   * left holding none has lost their access.
   */
  async function changeRole(userId: string, roleName: RoleName, name: string) {
    const label = roleName === 'teacher' ? t('students.roleTeacher')
      : roleName === 'administrator' ? t('students.roleAdmin')
      : t('students.roleStudent')
    if (!window.confirm(t('students.confirmRole', { name, role: label }))) return

    setChangingRole(userId)
    try {
      const { data: role } = await supabase.from('roles').select('id').eq('name', roleName).single()
      if (!role) throw new Error('role missing')

      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role_id: role.id, class_id: null })
      // A duplicate means they already had it, which is not a failure here.
      if (insertError && insertError.code !== '23505') throw insertError

      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .is('class_id', null)
        .neq('role_id', role.id)

      await loadUsers()
    } catch (err) {
      console.error('Error changing role:', err)
      alert(t('students.roleChangeFailed'))
    } finally {
      setChangingRole(null)
    }
  }

  const studentCount = allUsers.filter(u => u.role === 'student').length
  const displayCount = showAll ? allUsers.length : studentCount

  const roleLabel = (role?: string) => {
    if (role === 'teacher') return <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{t('students.roleTeacher')}</span>
    if (role === 'administrator') return <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">{t('students.roleAdmin')}</span>
    if (role === 'none') return <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{t('students.roleNone')}</span>
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-gray-600">{t('status.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <PageHeader
        breadcrumbs={[{ label: t('students.pageTitle') }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAll(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                showAll
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
              }`}
            >
              {showAll ? t('students.allUsers') : t('students.studentsOnly')}
            </button>
            {isAdmin && (
              <Button size="sm" onClick={() => { setShowCreate(true); setCreateError(null); setCreateSuccess(null) }}>
                {t('students.addUser')}
              </Button>
            )}
          </div>
        }
        maxWidth="max-w-4xl"
      />

      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
        {/* Search + count */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            {/* One key per sentence. The old version built "3 students total"
                by concatenating a plural "s", which has no counterpart in
                Chinese and left the phrase half-English. */}
            <span className="text-sm text-gray-500">
              {search
                ? t('students.countShown', { shown: filtered.length, total: displayCount })
                : showAll
                  ? t('students.countTotalUsers', { count: displayCount })
                  : t('students.countTotalStudents', { count: displayCount })}
            </span>
          </div>
          <input
            type="text"
            placeholder={t('students.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all bg-white"
          />
        </div>

        {filtered.length === 0 ? (
          <Card className="text-center py-16">
            <div className="text-5xl mb-4">👥</div>
            <h3 className="text-lg font-semibold text-gray-700">
              {search ? t('students.noneFound') : showAll ? t('students.noUsers') : t('students.noStudents')}
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
                    {/* Role control. stopPropagation because the row itself
                        opens the user's history — changing what someone is
                        should not also navigate away from the list. */}
                    {isAdmin && (
                      <select
                        aria-label={t('students.changeRole')}
                        title={t('students.changeRole')}
                        value={ROLES.includes(u.role as RoleName) ? u.role : ''}
                        disabled={changingRole === u.id}
                        onClick={event => event.stopPropagation()}
                        onChange={event => {
                          event.stopPropagation()
                          const next = event.target.value as RoleName
                          if (next && next !== u.role) changeRole(u.id, next, name)
                        }}
                        className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-600
                                   hover:border-gray-400 disabled:opacity-50"
                      >
                        {!ROLES.includes(u.role as RoleName) && <option value="">{t('students.roleNone')}</option>}
                        <option value="student">{t('students.roleStudent')}</option>
                        <option value="teacher">{t('students.roleTeacher')}</option>
                        <option value="administrator">{t('students.roleAdmin')}</option>
                      </select>
                    )}
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary-600">{u.submission_count}</div>
                      <div className="text-xs text-gray-400">{t('students.submissionsLabel')}</div>
                    </div>
                    <span className="text-gray-300 text-lg">→</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* New user. Admin-only, matching what the endpoint enforces. */}
      {showCreate && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => !creating && setShowCreate(false)}
        >
          <form
            onSubmit={handleCreateUser}
            onClick={event => event.stopPropagation()}
            className="mt-12 w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2 className="text-lg font-bold text-gray-900">{t('students.newUser')}</h2>

            {createError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</p>
            )}
            {createSuccess && (
              <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{createSuccess}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <input
                required
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                placeholder={t('students.firstName')}
                className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-primary-500"
              />
              <input
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                placeholder={t('students.lastName')}
                className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-primary-500"
              />
            </div>

            <input
              required
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder={t('students.email')}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-primary-500"
            />

            <div>
              <input
                required
                type="password"
                minLength={6}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={t('students.password')}
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-primary-500"
              />
              <p className="mt-1 text-xs text-gray-400">{t('students.passwordHint')}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select
                aria-label={t('students.role')}
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as RoleName }))}
                className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-primary-500"
              >
                <option value="student">{t('students.roleStudent')}</option>
                <option value="teacher">{t('students.roleTeacher')}</option>
                <option value="administrator">{t('students.roleAdmin')}</option>
              </select>
              <select
                aria-label={t('students.classOptional')}
                value={form.classId}
                onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}
                className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-primary-500"
              >
                <option value="">{t('students.noClass')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" disabled={creating} onClick={() => setShowCreate(false)}>
                {t('action.cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={creating}>
                {creating ? t('students.creating') : t('students.create')}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
