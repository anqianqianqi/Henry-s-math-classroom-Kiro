'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isTeacher, setIsTeacher] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
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

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setProfile(profile)

    // Check if user is a teacher - using RPC for reliable role check
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .is('class_id', null)

    console.log('User roles:', { userRoles, rolesError, userId: user.id })

    if (userRoles && userRoles.length > 0) {
      // Get role names
      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .in('id', userRoles.map((r: any) => r.role_id))

      console.log('Role names:', roleData)
      const hasTeacherRole = roleData?.some((r: any) => r.name === 'teacher')
      const hasAdminRole = roleData?.some((r: any) => r.name === 'administrator')
      console.log('Is teacher?', hasTeacherRole, 'Is admin?', hasAdminRole)
      setIsTeacher(hasTeacherRole || false)
      setIsAdmin(hasAdminRole || false)
    } else {
      setIsTeacher(false)
      setIsAdmin(false)
    }

    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📚</span>
              <h1 className="text-2xl font-bold text-gray-900">Henry's Math</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-600 font-medium">
                {profile?.full_name || user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium rounded-xl hover:bg-gray-100 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-primary-500 to-accent-blue rounded-3xl p-8 mb-8 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">👋</span>
            <h2 className="text-3xl font-bold">Welcome back, {firstName}!</h2>
          </div>
          <p className="text-xl text-white/90">
            {isTeacher ? "Let's inspire some students today!" : "Let's learn some math today!"}
          </p>
          {isTeacher && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
              <span>👨‍🏫</span>
              <span className="font-semibold">Teacher Account</span>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="text-center">
            <Card.Body>
              <div className="text-5xl mb-3">📚</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">0</div>
              <div className="text-gray-600 font-medium">Classes</div>
            </Card.Body>
          </Card>

          <Card className="text-center">
            <Card.Body>
              <div className="text-5xl mb-3">🎯</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">0</div>
              <div className="text-gray-600 font-medium">Challenges</div>
            </Card.Body>
          </Card>

          <Card className="text-center">
            <Card.Body>
              <div className="text-5xl mb-3">🔥</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">0</div>
              <div className="text-gray-600 font-medium">Day Streak</div>
            </Card.Body>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <span>⚡</span>
              Quick Actions
            </Card.Title>
          </Card.Header>
          <Card.Body>
            {isTeacher ? (
              // Teacher Quick Actions
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={() => router.push('/classes/new')}
                  className="h-20 text-lg"
                  fullWidth
                >
                  <span className="mr-2">➕</span>
                  Create Class
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => router.push('/challenges/new')}
                  className="h-20 text-lg"
                  fullWidth
                >
                  <span className="mr-2">🎯</span>
                  New Challenge
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => router.push('/materials/upload')}
                  className="h-20 text-lg"
                  fullWidth
                >
                  <span className="mr-2">📝</span>
                  Upload Material
                </Button>
              </div>
            ) : (
              // Student Quick Actions
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={() => router.push('/classes')}
                  className="h-20 text-lg"
                  fullWidth
                >
                  <span className="mr-2">📚</span>
                  My Classes
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => router.push('/challenges')}
                  className="h-20 text-lg"
                  fullWidth
                >
                  <span className="mr-2">🎯</span>
                  Today's Challenge
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => router.push('/materials')}
                  className="h-20 text-lg"
                  fullWidth
                >
                  <span className="mr-2">📖</span>
                  Study Materials
                </Button>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Main Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="cursor-pointer" onClick={() => router.push('/classes')}>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <span className="text-2xl">📚</span>
                My Classes
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <p className="text-gray-600">
                View and manage your classes
              </p>
            </Card.Body>
            <Card.Footer>
              <span className="text-primary-600 hover:text-primary-700 font-semibold text-sm">
                View Classes →
              </span>
            </Card.Footer>
          </Card>

          <Card className="cursor-pointer" onClick={() => router.push('/challenges')}>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                Daily Challenge
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <p className="text-gray-600">
                Today's math challenge
              </p>
            </Card.Body>
            <Card.Footer>
              <span className="text-primary-600 hover:text-primary-700 font-semibold text-sm">
                View Challenge →
              </span>
            </Card.Footer>
          </Card>

          <Card className="cursor-pointer" onClick={() => router.push('/materials')}>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <span className="text-2xl">📝</span>
                Materials
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <p className="text-gray-600">
                Access class materials and resources
              </p>
            </Card.Body>
            <Card.Footer>
              <span className="text-primary-600 hover:text-primary-700 font-semibold text-sm">
                View Materials →
              </span>
            </Card.Footer>
          </Card>
        </div>
      </main>
    </div>
  )
}
