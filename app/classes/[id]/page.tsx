'use client'
import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import SessionsList from '@/components/SessionsList'
import SessionDetail from '@/components/SessionDetail'
import EnrollmentManager from '@/components/EnrollmentManager'
import JoinRequestManager from '@/components/JoinRequestManager'
import { HomeButton } from '@/components/ui/HomeButton'

interface Class {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string | null
  created_at: string
  created_by: string
  teacher_name: string
  teacher_email: string
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
  const { t } = useLanguage()
  const [classData, setClassData] = useState<Class | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'teacher' | 'student' | 'observer'>('student')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [joinRequestStatus, setJoinRequestStatus] = useState<'none' | 'pending' | 'approved' | 'denied'>('none')
  const [requestingJoin, setRequestingJoin] = useState(false)
  const [publishedChallenges, setPublishedChallenges] = useState<Array<{
    id: string; title: string; challenge_date: string; max_points: number | null
  }>>([])
  const [showAllChallenges, setShowAllChallenges] = useState(false)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const classId = params.id as string

  useEffect(() => {
    loadClassData()
    loadMembers()
    loadUserRole()
    checkEnrollmentStatus()
    loadPublishedChallenges()
  }, [classId])

  async function loadPublishedChallenges() {
    try {
      // Get challenge IDs assigned to this class
      const { data: assignments } = await supabase
        .from('challenge_assignments')
        .select('challenge_id')
        .eq('class_id', classId)

      if (!assignments || assignments.length === 0) return

      const challengeIds = assignments.map((a: any) => a.challenge_id)

      const { data: challenges } = await supabase
        .from('daily_challenges')
        .select('id, title, challenge_date, max_points')
        .in('id', challengeIds)
        .order('challenge_date', { ascending: false })

      setPublishedChallenges(challenges || [])
    } catch { /* ignore */ }
  }

  async function loadClassData() {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*, profiles:created_by(full_name, email)')
        .eq('id', classId)
        .single()

      if (error) throw error
      setClassData({
        ...data,
        teacher_name: (data.profiles as any)?.full_name || t('class.unknownTeacher'),
        teacher_email: (data.profiles as any)?.email || ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('class.loadOneFailed'))
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
        alert(t('class.loginToJoin'))
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
        alert(t('class.joinRequestFailed'))
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
      setError(err instanceof Error ? err.message : t('class.deleteFailed'))
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
            {error || t('class.notFound')}
          </div>
          <Button onClick={() => router.push('/classes')} className="mt-4">
            {t('class.backToClasses')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/classes')}
          >
            ← Back
          </Button>
          <HomeButton />
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{classData.name}</h1>
          </div>
          <div className="flex gap-2">
            {/* Bubble Room button — accessible to teachers and enrolled students */}
            {(userRole === 'teacher' || isEnrolled) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push(`/bubble-room`)}
                className="bg-purple-100 hover:bg-purple-200 text-purple-700 border-purple-200"
              >
                💬 Bubble Room
              </Button>
            )}
            {userRole === 'teacher' ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(`/classes/${classId}/edit`)}
                >
                  <span className="hidden sm:inline">✏️ </span>Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                >
                  <span className="hidden sm:inline">🗑️ </span>Delete
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
                    {requestingJoin ? t('class.sending') : <><span className="hidden sm:inline">📝 </span>{t('class.requestToJoin')}</>}
                  </Button>
                )}
                {joinRequestStatus === 'pending' && (
                  <div className="px-4 py-2 bg-orange-100 text-orange-800 rounded-lg font-medium">
                    <span className="hidden sm:inline">⏳ </span>Request Pending
                  </div>
                )}
                {joinRequestStatus === 'approved' && (
                  <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                    ✓ Enrolled
                  </div>
                )}
                {joinRequestStatus === 'denied' && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                    <p className="text-sm text-red-800">✗ Join request not approved</p>
                    <button
                      onClick={handleRequestJoin}
                      className="w-full px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                    >
                      {t('class.submitNewRequest')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <Card.Header>
              <Card.Title>{t('class.information')}</Card.Title>
            </Card.Header>
            <Card.Body>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t('class.teacher')}</dt>
                  <dd className="mt-1 text-gray-900 font-medium">{classData.teacher_name}</dd>
                  <dd className="text-sm text-gray-500">{classData.teacher_email}</dd>
                </div>
                {classData.description && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">{t('class.description')}</dt>
                    <dd className="mt-1 text-gray-900">{classData.description}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t('class.startDate')}</dt>
                  <dd className="mt-1 text-gray-900">
                    {new Date(classData.start_date).toLocaleDateString()}
                  </dd>
                </div>
                {classData.end_date && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">{t('class.endDate')}</dt>
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
                  <p className="text-gray-500 text-center py-8">{t('class.noMembers')}</p>
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

          {/* Published Challenges — Teachers only */}
          {userRole === 'teacher' && (
            <Card>
              <Card.Header>
                <Card.Title>Published Challenges ({publishedChallenges.length})</Card.Title>
              </Card.Header>
              <Card.Body>
                {publishedChallenges.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">{t('class.noChallenges')}</p>
                ) : (
                  <>
                    <div className="divide-y divide-gray-100">
                      {(showAllChallenges ? publishedChallenges : publishedChallenges.slice(0, 10)).map(c => (
                        <div
                          key={c.id}
                          className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 -mx-4 px-4 rounded transition-colors"
                          onClick={() => router.push(`/challenges/${c.id}?classId=${params.id}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{c.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(c.challenge_date + 'T12:00:00').toLocaleDateString(undefined, {
                                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                              })}
                            </p>
                          </div>
                          <div className="shrink-0 flex items-center gap-3">
                            {c.max_points !== null && (
                              <span className="text-xs font-medium text-gray-500">{c.max_points} pts</span>
                            )}
                            <span className="text-gray-300 text-sm">→</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {publishedChallenges.length > 10 && (
                      <button
                        onClick={() => setShowAllChallenges(v => !v)}
                        className="mt-3 w-full py-2 text-sm text-primary-600 hover:text-primary-700 font-medium border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
                      >
                        {showAllChallenges
                          ? t('class.showLess')
                          : `Show all ${publishedChallenges.length} challenges`}
                      </button>
                    )}
                  </>
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
