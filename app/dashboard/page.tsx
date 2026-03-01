import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'

export default async function DashboardPage() {
  const supabase = createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">
                Welcome, {profile?.full_name || user.email}
              </span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <Card.Header>
              <Card.Title>My Classes</Card.Title>
            </Card.Header>
            <Card.Body>
              <p className="text-gray-600">
                View and manage your classes
              </p>
            </Card.Body>
            <Card.Footer>
              <a
                href="/classes"
                className="text-blue-600 hover:underline text-sm"
              >
                View Classes →
              </a>
            </Card.Footer>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Daily Challenge</Card.Title>
            </Card.Header>
            <Card.Body>
              <p className="text-gray-600">
                Today&apos;s math challenge
              </p>
            </Card.Body>
            <Card.Footer>
              <a
                href="/challenges"
                className="text-blue-600 hover:underline text-sm"
              >
                View Challenge →
              </a>
            </Card.Footer>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Materials</Card.Title>
            </Card.Header>
            <Card.Body>
              <p className="text-gray-600">
                Access class materials and resources
              </p>
            </Card.Body>
            <Card.Footer>
              <a
                href="/materials"
                className="text-blue-600 hover:underline text-sm"
              >
                View Materials →
              </a>
            </Card.Footer>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <Card.Header>
              <Card.Title>Getting Started</Card.Title>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                <p className="text-gray-600">
                  Welcome to Henry&apos;s Math Classroom! Here&apos;s what you can do:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li>Join or create classes</li>
                  <li>Participate in daily challenges</li>
                  <li>Access class materials and recordings</li>
                  <li>Track your progress</li>
                </ul>
              </div>
            </Card.Body>
          </Card>
        </div>
      </main>
    </div>
  )
}
