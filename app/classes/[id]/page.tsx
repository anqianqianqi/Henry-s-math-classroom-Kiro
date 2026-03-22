'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import SessionsList from '@/components/SessionsList'
import SessionDetail from '@/components/SessionDetail'
import EnrollmentManager from '@/components/EnrollmentManager'
import JoinRequestManager from '@/components/JoinRequestManager'

interface Class {
  id: string
  name: string
  description: string | null
  schedule: Array<{ day: string; startTime: string; endTime: string }> | null
  start_date: string
  end_date: string | null
  created_at: string
}

interface Member {
  id: string
  user_id: string
  role_name: string
  profiles: {
    full_name: string
    email: string
  }
}

export default function ClassDetailPage() {
  const [classData, setClassData] = useState<Class | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'teacher' | 'student' | 'observer'>('student')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [joinRequestStatus, setJoinRequestStatus] = useState<'none' | 'pending' | 'approved' | 'denied'>('none')
  const [requestingJoin, setRequestingJoin] = useState(false)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const classId = params.id as string

  useEffect(() => {
    loadClassData()
    loadMembers()
    loadUserRole()
    checkEnrollmentStatus()
  }, [classId])

  async function loadClassData() {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single()

      if (error) throw error
      setClassData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load class')
    } finally {
      setLoading(false)
    }
  }

  async function loadMembers() {
    try {
      console.log('Loading members for class:', classId)
      
      const { data, error } = await supabase
        .from('class_members')
        .select(`
          user_id,
          joined_at,
          profiles:user_id(full_name, email)
        `)
        .eq('class_id', classId)

      console.log('Members query result:', { data, error })

      if (error) throw error
      
      const formattedMembers = data?.map(item => ({
        id: item.user_id,
        user_id: item.user_id,
        role_name: 'student',
        profiles: {
          full_name: (item.profiles as any).full_name,
          email: (item.profiles as any).email
        }
      })) || []

      console.log('Formatted members:', formattedMembers)
      setMembers(formattedMembers)
    } catch (err) {
      console.error('Failed to load members:', err)
    }
  }

  async function loadUserRole() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check user's global roles
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role_id, roles(name)')
        .eq('user_id', user.id)
        .is('class_id', null)

      const hasTeacherRole = userRoles?.some((ur: any) => 
        ur.roles?.name === 'teacher' || ur.roles?.name === 'admin' || ur.roles?.name === 'administrator'
      )
      
      if (hasTeacherRole) {
        setUserRole('teacher')
        return
      }

      // Otherwise assume student
      setUserRole('student')
    } catch (err) {
      console.error('Failed to load user role:', err)
    }
  }

  async function checkEnrollmentStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check if enrolled
      const { data: enrollment } = await supabase
        .from('class_members')
        .select('id')
        .eq('class_id', classId)
        .eq('user_id', user.id)
        .maybeSingle()

      setIsEnrolled(!!enrollment)

      // Check join request status
      const { data: joinRequest } = await supabase
        .from('class_join_requests')
        .select('status')
        .eq('class_id', classId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (joinRequest) {
        setJoinRequestStatus(joinRequest.status as any)
      }
    } catch (err) {
      console.error('Failed to check enrollment status:', err)
    }
  }

  async function handleRequestJoin() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please log in to request to join this class')
        return
      }

      setRequestingJoin(true)

      const { error } = await supabase
        .from('class_join_requests')
        .insert({
          class_id: classId,
          user_id: user.id,
          message: null
        })

      if (error) {
        // Check if there's an existing request that was denied - delete and retry
        if (error.code === '23505') {
          const { data: existing } = await supabase
            .from('class_join_requests')
            .select('status')
            .eq('class_id', classId)
            .eq('user_id', user.id)
            .single()

          if (existing?.status === 'denied') {
            // Remove denied request and re-submit
            await supabase
              .from('class_join_requests')
              .delete()
              .eq('class_id', classId)
              .eq('user_id', user.id)

            const { error: retryError } = await supabase
              .from('class_join_requests')
              .insert({
                class_id: classId,
                user_id: user.id,
                message: null
              })

            if (retryError) throw retryError
          } else {
            alert('You already have a pending join request for this class.')
            return
          }
        } else {
          throw error
        }
      }

      setJoinRequestStatus('pending')
      alert('Join request sent! The teacher will review your request.')
    } catch (err: any) {
      console.error('Failed to request join:', err)
      if (err?.code === 'PGRST205' || err?.code === '42P01') {
        alert('Join requests are not yet set up. Please ask the teacher to add you directly.')
      } else {
        alert('Failed to send join request. Please try again.')
      }
    } finally {
      setRequestingJoin(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this class? This cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId)

      if (error) throw error
      router.push('/classes')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete class')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !classData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || 'Class not found'}
          </div>
          <Button onClick={() => router.push('/classes')} className="mt-4">
            Back to Classes
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/classes')}
          className="mb-4"
        >
          ← Back
        </Button>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{classData.name}</h1>
            {classData.schedule && classData.schedule.length > 0 && (
              <div className="text-gray-600 space-y-1">
                {classData.schedule.map((slot, index) => (
                  <p key={index} className="flex items-center gap-2">
                    <span>📅</span>
                    <span>{slot.day}s {slot.startTime} - {slot.endTime}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {userRole === 'teacher' ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(`/classes/${classId}/edit`)}
                >
                  ✏️ Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                >
                  🗑️ Delete
                </Button>
              </>
            ) : (
              <>
                {!isEnrolled && joinRequestStatus === 'none' && (
                  <Button
                    onClick={handleRequestJoin}
                    disabled={requestingJoin}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {requestingJoin ? 'Sending...' : '📝 Request to Join'}
                  </Button>
                )}
                {joinRequestStatus === 'pending' && (
                  <div className="px-4 py-2 bg-orange-100 text-orange-800 rounded-lg font-medium">
                    ⏳ Request Pending
                  </div>
                )}
                {joinRequestStatus === 'approved' && (
                  <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                    ✓ Enrolled
                  </div>
                )}
                {joinRequestStatus === 'denied' && (
                  <div className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg font-medium">
                    Request Denied
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <Card.Header>
              <Card.Title>Class Information</Card.Title>
            </Card.Header>
            <Card.Body>
              <dl className="space-y-4">
                {classData.description && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Description</dt>
                    <dd className="mt-1 text-gray-900">{classData.description}</dd>
                  </div>
                )}
                {classData.schedule && classData.schedule.length > 0 && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Meeting Times</dt>
                    <dd className="mt-1 space-y-2">
                      {classData.schedule.map((slot, index) => (
                        <div key={index} className="flex items-center gap-2 text-gray-900">
                          <span>📅</span>
                          <span className="font-medium">{slot.day}s</span>
                          <span className="text-gray-500">•</span>
                          <span>{slot.startTime} - {slot.endTime}</span>
                        </div>
                      ))}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Start Date</dt>
                  <dd className="mt-1 text-gray-900">
                    {new Date(classData.start_date).toLocaleDateString()}
                  </dd>
                </div>
                {classData.end_date && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">End Date</dt>
                    <dd className="mt-1 text-gray-900">
                      {new Date(classData.end_date).toLocaleDateString()}
                    </dd>
                  </div>
                )}
              </dl>
            </Card.Body>
          </Card>

          {/* Join Requests - Teachers only */}
          {userRole === 'teacher' && (
            <JoinRequestManager classId={classId} />
          )}

          {/* Members Section - Use EnrollmentManager for teachers */}
          {userRole === 'teacher' ? (
            <EnrollmentManager
              classId={classId}
              members={members}
              onMembersUpdate={loadMembers}
            />
          ) : (
            <Card>
              <Card.Header>
                <Card.Title>Members ({members.length})</Card.Title>
              </Card.Header>
              <Card.Body>
                {members.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No members yet</p>
                ) : (
                  <div className="space-y-3">
                    {members.map(member => (
                      <div
                        key={member.id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {member.profiles.full_name}
                          </p>
                          <p className="text-sm text-gray-500">{member.profiles.email}</p>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                          {member.role_name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Class Sessions */}
          {selectedSessionId ? (
            <SessionDetail
              occurrenceId={selectedSessionId}
              userRole={userRole}
              onClose={() => setSelectedSessionId(null)}
            />
          ) : (
            <SessionsList
              classId={classId}
              onSelectSession={(sessionId) => setSelectedSessionId(sessionId)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
