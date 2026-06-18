'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'

interface User {
  id: string
  email: string
  full_name: string
  roles: string[]
}

// ─── Create User modal state ───────────────────────────────────────────────
interface CreateUserForm {
  firstName: string
  lastName: string
  email: string
  password: string
  role: string
  classId: string
}

export default function AdminRolesPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Create user modal state
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)
  const [form, setForm] = useState<CreateUserForm>({
    firstName: '', lastName: '', email: '', password: '', role: 'student', classId: '',
  })
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])

  async function loadClasses() {
    const { data } = await supabase
      .from('classes')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true })
    setClasses(data ?? [])
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    setCreateSuccess(null)

    try {
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
        setCreateError(data.error ?? 'Failed to create user')
      } else {
        setCreateSuccess(`✅ ${data.fullName} (${data.email}) created successfully!`)
        setForm({ firstName: '', lastName: '', email: '', password: '', role: 'student', classId: '' })
        await loadUsers()
        setTimeout(() => {
          setShowCreate(false)
          setCreateSuccess(null)
        }, 2500)
      }
    } catch {
      setCreateError('Network error — please try again')
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    try {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')

      if (profilesError) throw profilesError

      // Get all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles!inner(name)
        `)
        .is('class_id', null)

      if (rolesError) throw rolesError

      // Combine data
      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        roles: userRoles
          ?.filter(ur => ur.user_id === profile.id)
          .map(ur => (ur.roles as any).name) || []
      })) || []

      setUsers(usersWithRoles)
    } catch (err) {
      console.error('Error loading users:', err)
    } finally {
      setLoading(false)
    }
  }

  async function assignRole(userId: string, roleName: string) {
    try {
      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .single()

      if (!role) throw new Error('Role not found')

      await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: role.id,
          class_id: null
        })

      loadUsers()
    } catch (err) {
      console.error('Error assigning role:', err)
      alert('Failed to assign role')
    }
  }

  async function removeRole(userId: string, roleName: string) {
    try {
      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .single()

      if (!role) throw new Error('Role not found')

      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', role.id)
        .is('class_id', null)

      loadUsers()
    } catch (err) {
      console.error('Error removing role:', err)
      alert('Failed to remove role')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 p-4 sm:p-8">
      <PageHeader breadcrumbs={[{ label: 'Admin' }, { label: 'User Roles' }]} />
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''} total</p>
          <Button size="sm" onClick={() => { setShowCreate(true); setCreateError(null); setCreateSuccess(null); loadClasses() }}>
            + Create User
          </Button>
        </div>
        <Card>
          <Card.Body>
            <div className="space-y-4">
              {users.map(user => (
                <div
                  key={user.id}
                  className="p-4 bg-gray-50 rounded-xl space-y-3"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{user.full_name}</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <div className="flex gap-2 mt-2">
                      {user.roles.length === 0 && (
                        <Badge variant="warning">No role</Badge>
                      )}
                      {user.roles.map(role => (
                        <Badge
                          key={role}
                          variant={role === 'teacher' ? 'purple' : role === 'administrator' ? 'error' : 'info'}
                        >
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!user.roles.includes('teacher') ? (
                      <Button
                        size="sm"
                        onClick={() => assignRole(user.id, 'teacher')}
                      >
                        Make Teacher
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => removeRole(user.id, 'teacher')}
                      >
                        Remove Teacher
                      </Button>
                    )}
                    {!user.roles.includes('student') ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => assignRole(user.id, 'student')}
                      >
                        Make Student
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => removeRole(user.id, 'student')}
                      >
                        Remove Student
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-center text-gray-500 py-8">No users found</p>
              )}
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* ── Create User Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Create New User</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >✕</button>
            </div>

            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {createError}
              </div>
            )}
            {createSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                {createSuccess}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last name <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
                  placeholder="jane@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
                  placeholder="At least 6 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:border-primary-500 outline-none"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="administrator">Administrator</option>
                  <option value="">No role</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to class <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={form.classId}
                  onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:border-primary-500 outline-none"
                >
                  <option value="">— No class —</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {classes.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No active classes found</p>
                )}
              </div>

              <p className="text-xs text-gray-500">
                The account will be immediately active — no email confirmation needed. The user can log in right away with these credentials.
              </p>

              <div className="flex gap-3 pt-1">
                <Button type="submit" disabled={creating} isLoading={creating} fullWidth>
                  {creating ? 'Creating…' : 'Create User'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)} fullWidth>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
