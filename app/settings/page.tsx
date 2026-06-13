'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Card } from '@/components/ui/Card'
import NotificationPreferences from '@/components/NotificationPreferences'
import { PageHeader } from '@/components/ui/PageHeader'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [nickname, setNickname] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [isTeacher, setIsTeacher] = useState(false)
  const [scoreStats, setScoreStats] = useState<{
    totalScore: number
    gradedCount: number
    submittedCount: number
    recentGrades: { title: string; points: number; date: string }[]
  } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      router.push('/login')
      return
    }

    setUser(user)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name, email, avatar_url')
      .eq('id', user.id)
      .single()

    if (profile) {
      setProfile(profile)
      setFirstName(profile.first_name || '')
      setLastName(profile.last_name || '')
      const { data: nicknameData } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .single()
      setNickname((nicknameData as any)?.nickname || '')
    }

    // Check role
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .is('class_id', null)

    let teacher = false
    if (userRoles && userRoles.length > 0) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .in('id', userRoles.map((r: any) => r.role_id))
      teacher = roleData?.some((r: any) => r.name === 'teacher' || r.name === 'administrator') || false
    }
    setIsTeacher(teacher)

    // Load score stats for students only
    if (!teacher) {
      const { data: submissions } = await supabase
        .from('challenge_submissions')
        .select('id, points, is_locked, submitted_at, challenge_id, daily_challenges(title)')
        .eq('user_id', user.id)
        .order('submitted_at', { ascending: false })

      if (submissions) {
        const graded = submissions.filter(s => s.points != null && s.is_locked)
        const totalScore = graded.reduce((sum, s) => sum + (s.points || 0), 0)
        const recentGrades = graded.slice(0, 5).map((s: any) => ({
          title: s.daily_challenges?.title || 'Challenge',
          points: s.points,
          date: s.submitted_at
        }))
        setScoreStats({
          totalScore,
          gradedCount: graded.length,
          submittedCount: submissions.length,
          recentGrades
        })
      }
    }

    setLoading(false)
  }

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    setSaveMsg('')

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim() || '',
        last_name: lastName.trim() || '',
        nickname: nickname.trim() || null
      })
      .eq('id', user.id)

    setSaving(false)
    if (error) {
      setSaveMsg('Failed to save')
      console.error('Profile save error:', error)
    } else {
      const newFullName = `${firstName.trim()} ${lastName.trim()}`.trim()
      setSaveMsg('Saved!')
      setProfile({ ...profile, first_name: firstName.trim(), last_name: lastName.trim(), full_name: newFullName })
    }
    setTimeout(() => setSaveMsg(''), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚙️</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <PageHeader breadcrumbs={[{ label: 'Settings' }]} maxWidth="max-w-4xl" />

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Profile Card */}
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold"><span className="hidden sm:inline">👤 </span>Profile</h2>
          </Card.Header>
          <Card.Body>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="First Name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                />
                <FormField
                  label="Last Name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Email</p>
                <p className="text-gray-900">{profile?.email}</p>
              </div>
              <FormField
                label="Nickname (shown to classmates)"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Johnny"
                helperText="Optional — displayed instead of your full name to other students"
              />
              <div className="flex items-center gap-3">
                <Button onClick={saveProfile} isLoading={saving} size="sm">
                  Save Profile
                </Button>
                {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Score Card — students only */}
        {!isTeacher && scoreStats && (
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold"><span className="hidden sm:inline">⭐ </span>My Score</h2>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-primary-50 rounded-xl p-4">
                    <div className="text-3xl font-bold text-primary-700">{scoreStats.totalScore}</div>
                    <div className="text-sm text-gray-600 mt-1">Total Points</div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4">
                    <div className="text-3xl font-bold text-green-700">{scoreStats.gradedCount}</div>
                    <div className="text-sm text-gray-600 mt-1">Graded</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4">
                    <div className="text-3xl font-bold text-blue-700">{scoreStats.submittedCount}</div>
                    <div className="text-sm text-gray-600 mt-1">Submitted</div>
                  </div>
                </div>

                {/* Recent grades */}
                {scoreStats.recentGrades.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Recent Grades</p>
                    <div className="space-y-2">
                      {scoreStats.recentGrades.map((g, i) => (
                        <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-800 truncate flex-1">{g.title}</span>
                          <div className="flex items-center gap-3 ml-3 shrink-0">
                            <span className="text-sm font-bold text-primary-700">{g.points}/100</span>
                            <span className="text-xs text-gray-400">
                              {new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {scoreStats.gradedCount === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">No graded challenges yet</p>
                )}
              </div>
            </Card.Body>
          </Card>
        )}

        {/* Notification preferences hidden - defaulting to in-app only */}
        {false && <NotificationPreferences />}
      </main>
    </div>
  )
}
