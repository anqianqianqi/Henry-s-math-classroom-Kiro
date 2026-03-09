'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatOccurrenceDisplay } from '@/lib/utils/occurrences'

interface Occurrence {
  id: string
  class_id: string
  occurrence_date: string
  start_time: string
  end_time: string
  session_number: number
  topic: string | null
  status: 'upcoming' | 'completed' | 'cancelled'
  notes: string | null
}

interface SessionsListProps {
  classId: string
  onSelectSession?: (sessionId: string) => void
}

export default function SessionsList({ classId, onSelectSession }: SessionsListProps) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadOccurrences()
  }, [classId])

  async function loadOccurrences() {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('class_occurrences')
        .select('*')
        .eq('class_id', classId)
        .order('occurrence_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (fetchError) throw fetchError

      setOccurrences(data || [])
    } catch (err) {
      console.error('Failed to load occurrences:', err)
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  
  const upcomingOccurrences = occurrences.filter(
    occ => occ.occurrence_date >= today && occ.status !== 'cancelled'
  )
  
  const pastOccurrences = occurrences.filter(
    occ => occ.occurrence_date < today
  ).reverse() // Most recent first

  const displayOccurrences = activeTab === 'upcoming' ? upcomingOccurrences : pastOccurrences

  if (loading) {
    return (
      <Card>
        <Card.Body>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </Card.Body>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <Card.Body>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">⚠️ {error}</p>
            <Button onClick={loadOccurrences} variant="secondary">
              Try Again
            </Button>
          </div>
        </Card.Body>
      </Card>
    )
  }

  return (
    <Card>
      <Card.Header>
        <div className="flex justify-between items-center">
          <Card.Title>Class Sessions</Card.Title>
          <div className="text-sm text-gray-500">
            {occurrences.length} total sessions
          </div>
        </div>
      </Card.Header>
      <Card.Body>
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'upcoming'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Upcoming ({upcomingOccurrences.length})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'past'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Past ({pastOccurrences.length})
          </button>
        </div>

        {/* Sessions List */}
        {displayOccurrences.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">
              {activeTab === 'upcoming' ? '📅' : '✅'}
            </div>
            <p className="text-gray-500 text-lg">
              {activeTab === 'upcoming'
                ? 'No upcoming sessions'
                : 'No past sessions yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayOccurrences.map((occurrence) => (
              <div
                key={occurrence.id}
                onClick={() => onSelectSession?.(occurrence.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  onSelectSession
                    ? 'cursor-pointer hover:border-blue-500 hover:shadow-md'
                    : ''
                } ${
                  occurrence.status === 'cancelled'
                    ? 'bg-gray-50 border-gray-200 opacity-60'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Session Number & Status */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-blue-600">
                        Session {occurrence.session_number}
                      </span>
                      {occurrence.status === 'completed' && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                          ✓ Completed
                        </span>
                      )}
                      {occurrence.status === 'cancelled' && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                          ✗ Cancelled
                        </span>
                      )}
                      {occurrence.status === 'upcoming' && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                          → Upcoming
                        </span>
                      )}
                    </div>

                    {/* Topic */}
                    {occurrence.topic && (
                      <h4 className="font-semibold text-gray-900 mb-1">
                        {occurrence.topic}
                      </h4>
                    )}

                    {/* Date & Time */}
                    <p className="text-sm text-gray-600">
                      {formatOccurrenceDisplay(occurrence)}
                    </p>

                    {/* Notes */}
                    {occurrence.notes && (
                      <p className="text-sm text-gray-500 mt-2 italic">
                        {occurrence.notes}
                      </p>
                    )}
                  </div>

                  {/* Arrow Icon (if clickable) */}
                  {onSelectSession && (
                    <div className="text-gray-400 ml-4">
                      →
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
