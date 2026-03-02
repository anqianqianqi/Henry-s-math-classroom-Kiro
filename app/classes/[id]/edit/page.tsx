'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'

interface ScheduleSlot {
  id: string
  day: string
  startTime: string
  endTime: string
}

export default function EditClassPage() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: ''
  })
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([
    { id: crypto.randomUUID(), day: '', startTime: '', endTime: '' }
  ])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const classId = params.id as string

  useEffect(() => {
    loadClass()
  }, [classId])

  async function loadClass() {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single()

      if (error) throw error

      setFormData({
        name: data.name,
        description: data.description || '',
        start_date: data.start_date,
        end_date: data.end_date || ''
      })

      // Load schedule slots from JSONB
      if (data.schedule && Array.isArray(data.schedule) && data.schedule.length > 0) {
        setScheduleSlots(
          data.schedule.map((slot: any) => ({
            id: crypto.randomUUID(),
            day: slot.day || '',
            startTime: slot.startTime || '',
            endTime: slot.endTime || ''
          }))
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load class')
    } finally {
      setLoading(false)
    }
  }

  function addScheduleSlot() {
    setScheduleSlots([...scheduleSlots, { id: crypto.randomUUID(), day: '', startTime: '', endTime: '' }])
  }

  function removeScheduleSlot(id: string) {
    if (scheduleSlots.length > 1) {
      setScheduleSlots(scheduleSlots.filter(slot => slot.id !== id))
    }
  }

  function updateScheduleSlot(id: string, field: 'day' | 'startTime' | 'endTime', value: string) {
    setScheduleSlots(scheduleSlots.map(slot =>
      slot.id === id ? { ...slot, [field]: value } : slot
    ))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      // Filter out empty schedule slots and format them
      const validSlots = scheduleSlots
        .filter(slot => slot.day && slot.startTime && slot.endTime)
        .map(slot => ({
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime
        }))

      const { error } = await supabase
        .from('classes')
        .update({
          name: formData.name,
          description: formData.description || null,
          schedule: validSlots.length > 0 ? validSlots : null,
          start_date: formData.start_date,
          end_date: formData.end_date || null
        })
        .eq('id', classId)

      if (error) throw error
      router.push(`/classes/${classId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update class')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push(`/classes/${classId}`)}
            className="mb-4"
          >
            ← Back to Class
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Edit Class</h1>
        </div>

        <Card>
          <Card.Body>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <FormField label="Class Name" required>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Algebra 1 - Spring 2026"
                  required
                />
              </FormField>

              <FormField label="Description">
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the class..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </FormField>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Class Schedule
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Add one or more meeting times for your class
                </p>
                
                <div className="space-y-3">
                  {scheduleSlots.map((slot, index) => (
                    <div key={slot.id} className="flex gap-3 items-start">
                      <div className="flex-1 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Day of Week
                          </label>
                          <select
                            value={slot.day}
                            onChange={(e) => updateScheduleSlot(slot.id, 'day', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Select day...</option>
                            <option value="Monday">Monday</option>
                            <option value="Tuesday">Tuesday</option>
                            <option value="Wednesday">Wednesday</option>
                            <option value="Thursday">Thursday</option>
                            <option value="Friday">Friday</option>
                            <option value="Saturday">Saturday</option>
                            <option value="Sunday">Sunday</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Start Time
                            </label>
                            <input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) => updateScheduleSlot(slot.id, 'startTime', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              End Time
                            </label>
                            <input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) => updateScheduleSlot(slot.id, 'endTime', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                      {scheduleSlots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeScheduleSlot(slot.id)}
                          className="mt-8 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove this time slot"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addScheduleSlot}
                  className="mt-4 flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 
                           rounded-lg transition-colors font-medium text-sm"
                >
                  <span>➕</span>
                  <span>Add Another Meeting Time</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Start Date" required>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </FormField>

                <FormField label="End Date">
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    min={formData.start_date}
                  />
                </FormField>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push(`/classes/${classId}`)}
                  disabled={saving}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={saving}
                  className="flex-1"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </Card.Body>
        </Card>
      </div>
    </div>
  )
}
