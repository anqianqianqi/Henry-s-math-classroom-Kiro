'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface Class {
  id: string
  name: string
  description: string | null
  schedule: Array<{ day: string; startTime: string; endTime: string }> | null
  start_date: string
  end_date: string | null
  created_at: string
  created_by: string
  creator?: {
    full_name: string
    email: string
  }
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadClasses()
  }, [])

  async function loadClasses() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check if user is a teacher
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', user.id)
        .is('class_id', null)

      let isTeacher = false
      if (userRoles && userRoles.length > 0) {
        const { data: roleData } = await supabase
          .from('roles')
          .select('name')
          .in('id', userRoles.map((r: any) => r.role_id))
        isTeacher = roleData?.some((r: any) => 
          r.name === 'teacher' || r.name === 'administrator' || r.name === 'admin'
        ) || false
        console.log('Classes page - roles:', roleData, 'isTeacher:', isTeacher)
      } else {
        console.log('Classes page - no roles found for user, userRoles:', userRoles)
      }

      if (isTeacher) {
        // Teachers see all classes
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) throw error
        setClasses(data || [])
      } else {
        // Students see only enrolled classes
        const { data: memberships } = await supabase
          .from('class_members')
          .select('class_id')
          .eq('user_id', user.id)

        if (memberships && memberships.length > 0) {
          const { data, error } = await supabase
            .from('classes')
            .select('*')
            .in('id', memberships.map(m => m.class_id))
            .order('created_at', { ascending: false })
          if (error) throw error
          setClasses(data || [])
        }
      }
    } catch (err) {
      console.error('Load classes error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load classes')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard')}
            >
              ←
            </Button>
            <h1 className="text-lg sm:text-3xl font-bold text-gray-900">My Classes</h1>
          </div>
          <Button size="sm" onClick={() => router.push('/classes/new')}>
            <span className="sm:hidden">➕</span>
            <span className="hidden sm:inline">Create New Class</span>
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {classes.length === 0 ? (
          <Card>
            <Card.Body>
              <div className="text-center py-12">
                <p className="text-gray-600 mb-4">No classes yet</p>
                <Button onClick={() => router.push('/classes/new')}>
                  Create Your First Class
                </Button>
              </div>
            </Card.Body>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classes.map(cls => (
              <Card key={cls.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <Card.Header>
                  <Card.Title>{cls.name}</Card.Title>
                </Card.Header>
                <Card.Body>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {cls.description || 'No description'}
                  </p>
                  <div className="space-y-2 text-sm">
                    {cls.schedule && cls.schedule.length > 0 && (
                      <div className="text-gray-500">
                        <span className="font-medium">Schedule:</span>
                        <div className="mt-1 space-y-1">
                          {cls.schedule.map((slot, index) => (
                            <div key={index} className="text-xs">
                              {slot.day}s {slot.startTime} - {slot.endTime}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-gray-500">
                      <span className="font-medium">Starts:</span>{' '}
                      {new Date(cls.start_date).toLocaleDateString()}
                    </p>
                  </div>
                </Card.Body>
                <Card.Footer>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/classes/${cls.id}`)}
                    className="w-full"
                  >
                    View Class
                  </Button>
                </Card.Footer>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
