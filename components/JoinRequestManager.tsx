'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface JoinRequest {
  id: string
  user_id: string
  message: string | null
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  profiles: {
    full_name: string
    email: string
  }
}

interface JoinRequestManagerProps {
  classId: string
}

export default function JoinRequestManager({ classId }: JoinRequestManagerProps) {
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [responseText, setResponseText] = useState<{ [key: string]: string }>({})
  const supabase = createClient()

  useEffect(() => {
    loadRequests()
  }, [classId])

  async function loadRequests() {
    try {
      const { data, error } = await supabase
        .from('class_join_requests')
        .select(`
          id,
          user_id,
          message,
          status,
          created_at,
          profiles:user_id(full_name, email)
        `)
        .eq('class_id', classId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRequests(data || [])
    } catch (err) {
      console.error('Failed to load join requests:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(requestId: string) {
    setProcessing(requestId)
    try {
      const { error } = await supabase
        .from('class_join_requests')
        .update({ 
          status: 'approved',
          teacher_response: responseText[requestId] || null
        })
        .eq('id', requestId)

      if (error) throw error
      await loadRequests()
      setResponseText(prev => {
        const next = { ...prev }
        delete next[requestId]
        return next
      })
    } catch (err) {
      console.error('Failed to approve request:', err)
      alert('Failed to approve request')
    } finally {
      setProcessing(null)
    }
  }

  async function handleDeny(requestId: string) {
    const response = responseText[requestId]
    if (!response?.trim()) {
      alert('Please provide a reason for denying the request')
      return
    }

    setProcessing(requestId)
    try {
      const { error } = await supabase
        .from('class_join_requests')
        .update({ 
          status: 'denied',
          teacher_response: response
        })
        .eq('id', requestId)

      if (error) throw error
      await loadRequests()
      setResponseText(prev => {
        const next = { ...prev }
        delete next[requestId]
        return next
      })
    } catch (err) {
      console.error('Failed to deny request:', err)
      alert('Failed to deny request')
    } finally {
      setProcessing(null)
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const processedRequests = requests.filter(r => r.status !== 'pending')

  if (loading) {
    return (
      <Card>
        <Card.Header>
          <Card.Title>Join Requests</Card.Title>
        </Card.Header>
        <Card.Body>
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </Card.Body>
      </Card>
    )
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>
          Join Requests
          {pendingRequests.length > 0 && (
            <span className="ml-2 px-2 py-1 bg-orange-500 text-white text-sm rounded-full">
              {pendingRequests.length} pending
            </span>
          )}
        </Card.Title>
      </Card.Header>
      <Card.Body>
        <div className="space-y-6">
          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Pending Requests</h4>
              <div className="space-y-3">
                {pendingRequests.map(request => (
                  <div
                    key={request.id}
                    className="p-4 bg-orange-50 border border-orange-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {request.profiles.full_name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {request.profiles.email}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Requested {new Date(request.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {request.message && (
                      <div className="mb-3 p-3 bg-white rounded border border-orange-200">
                        <div className="text-xs text-gray-500 mb-1">Message:</div>
                        <div className="text-sm text-gray-700">{request.message}</div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <textarea
                        placeholder="Optional: Add a message to the student..."
                        value={responseText[request.id] || ''}
                        onChange={(e) => setResponseText(prev => ({
                          ...prev,
                          [request.id]: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                                 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApprove(request.id)}
                          disabled={processing === request.id}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          {processing === request.id ? 'Approving...' : '✓ Approve'}
                        </Button>
                        <Button
                          onClick={() => handleDeny(request.id)}
                          disabled={processing === request.id}
                          variant="danger"
                          className="flex-1"
                        >
                          {processing === request.id ? 'Denying...' : '✗ Deny'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processed Requests */}
          {processedRequests.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Previous Requests</h4>
              <div className="space-y-2">
                {processedRequests.map(request => (
                  <div
                    key={request.id}
                    className={`p-3 rounded-lg border ${
                      request.status === 'approved'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {request.profiles.full_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(request.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <span className={`px-3 py-1 text-sm rounded-full ${
                        request.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {request.status === 'approved' ? '✓ Approved' : '✗ Denied'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {requests.length === 0 && (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📬</div>
              <p className="text-gray-500">No join requests yet</p>
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  )
}
