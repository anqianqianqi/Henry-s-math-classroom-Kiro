'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface User {
  id: string
  email: string
  full_name: string
  roles: string[]
}

export default function AdminRolesPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

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
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => window.history.back()}
            className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-block"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">👥 User Roles</h1>
          <p className="text-gray-600">Assign teacher or student roles to users</p>
        </div>

        <Card>
          <Card.Body>
            <div className="space-y-4">
              {users.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                >
                  <div className="flex-1">
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
                  <div className="flex gap-2">
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
    </div>
  )
}
