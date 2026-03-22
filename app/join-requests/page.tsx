'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface JoinRequest {
  id: string
  class_id: string
  user_id: string
  message: string | null
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  class_name: string
  profiles: { full_name: string; email: string }
}

export default function JoinRequestsDashboard() {
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { loadRequests() }, [])

  async function loadRequests() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Get teacher's classes
      const { data: classes } = await supabase
        .from('classes')
        .select('id, name')
        .eq('created_by', user.id)

      if (!classes || classes.length === 0) { setLoading(false); return }

      const classMap = Object.fromEntries(classes.map(c => [c.id, c.name]))
      const classIds = classes.map(c => c.id)

      // Get all join requests for teacher's classes
      const { data, error } = await supabase
        .from('class_join_requests')
        .select('id, class_id, user_id, message, status, created_at, profiles:user_id(full_name, email)')
        .in('class_id', classIds)
        .order('created_at', { ascending: false })

      if (error) throw error

      setRequests((data || []).map((d: any) => ({
        ...d,
        class_name: classMap[d.class_id] || 'Unknown Class',
        profiles: Array.isArray(d.profiles) ? d.profiles[0] : d.profiles
      })))
    } catch (err) {
      console.error('Failed to load requests:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(requestId: string, status: 'approved' | 'denied') {
    setProcessing(requestId)
    try {
      const { error } = await supabase
        .from('class_join_requests')
        .update({ status })
        .eq('id', requestId)

      if (error) throw error
      await loadRequests()
    } catch (err) {
      console.error('Failed to update request:', err)
      alert('Failed to update request')
    } finally {
      setProcessing(null)
    }
  }

  const pending = requests.filter(r => r.status === 'pending')
  const processed = requests.filter(r => r.status !== 'pending')

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push('/dashboard')} variant="ghost" size="sm">
              ← Back
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-3xl">📋</span>
              <h1 className="text-2xl font-bold text-gray-900">Join Requests</h1>
              {pending.length > 0 && (
                <span className="px-2 py-1 bg-orange-500 text-white text-sm rounded-full">
                  {pending.length} pending
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Pending */}
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold">⏳ Pending Requests</h2>
          </Card.Header>
          <Card.Body>
            {pending.length === 0 ? (
              <p className="text-center text-gray-500 py-6">No pending requests 🎉</p>
            ) : (
              <div className="space-y-3">
                {pending.map(req => (
                  <div key={req.id} className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-gray-900">{req.profiles.full_name}</p>
                        <p className="text-sm text-gray-600">{req.profiles.email}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Wants to join <span className="font-medium">{req.class_name}</span>
                          {' · '}{new Date(req.created_at).toLocaleDateString()}
                        </p>
                        {req.message && (
                          <p className="text-sm text-gray-700 mt-2 italic">"{req.message}"</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAction(req.id, 'approved')}
                          disabled={processing === req.id}
                          className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                        >
                          {processing === req.id ? '...' : '✓ Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleAction(req.id, 'denied')}
                          disabled={processing === req.id}
                          className="flex-1 sm:flex-none"
                        >
                          ✗ Deny
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>

        {/* History */}
        {processed.length > 0 && (
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold">📜 History</h2>
            </Card.Header>
            <Card.Body>
              <div className="space-y-2">
                {processed.map(req => (
                  <div key={req.id} className={`p-3 rounded-xl border flex items-center justify-between ${
                    req.status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div>
                      <p className="font-medium text-gray-900">{req.profiles.full_name}</p>
                      <p className="text-xs text-gray-500">
                        {req.class_name} · {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-3 py-1 text-sm rounded-full ${
                      req.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {req.status === 'approved' ? '✓ Approved' : '✗ Denied'}
                    </span>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        )}
      </main>
    </div>
  )
}
