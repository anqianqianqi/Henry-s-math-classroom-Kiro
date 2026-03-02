'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface ScheduleSlot {
  id: string
  day: string
  startTime: string
  endTime: string
}

export default function NewClassPage() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: ''
  })
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([
    { id: crypto.randomUUID(), day: '', startTime: '', endTime: '' }
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [validFields, setValidFields] = useState({
    name: false,
    schedule: false,
    start_date: false
  })
  const router = useRouter()
  const supabase = createClient()

  // Validate fields in real-time
  function validateField(field: string, value: string | ScheduleSlot[]) {
    if (field === 'name') {
      setValidFields(prev => ({ ...prev, name: (value as string).trim().length >= 3 }))
    } else if (field === 'schedule') {
      const slots = value as ScheduleSlot[]
      const hasValidSlot = slots.some(slot => slot.day && slot.startTime && slot.endTime)
      setValidFields(prev => ({ ...prev, schedule: hasValidSlot }))
    } else if (field === 'start_date') {
      setValidFields(prev => ({ ...prev, start_date: (value as string) !== '' }))
    }
  }

  function addScheduleSlot() {
    setScheduleSlots([...scheduleSlots, { id: crypto.randomUUID(), day: '', startTime: '', endTime: '' }])
  }

  function removeScheduleSlot(id: string) {
    if (scheduleSlots.length > 1) {
      const newSlots = scheduleSlots.filter(slot => slot.id !== id)
      setScheduleSlots(newSlots)
      validateField('schedule', newSlots)
    }
  }

  function updateScheduleSlot(id: string, field: 'day' | 'startTime' | 'endTime', value: string) {
    const newSlots = scheduleSlots.map(slot =>
      slot.id === id ? { ...slot, [field]: value } : slot
    )
    setScheduleSlots(newSlots)
    validateField('schedule', newSlots)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Filter out empty schedule slots and format them
      const validSlots = scheduleSlots
        .filter(slot => slot.day && slot.startTime && slot.endTime)
        .map(slot => ({
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime
        }))

      // Create class
      const { data: newClass, error: classError } = await supabase
        .from('classes')
        .insert({
          name: formData.name,
          description: formData.description || null,
          schedule: validSlots.length > 0 ? validSlots : null,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          created_by: user.id
        })
        .select()
        .single()

      if (classError) throw classError

      // Assign teacher role for this class
      const { data: teacherRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'teacher')
        .single()

      if (teacherRole) {
        await supabase
          .from('user_roles')
          .insert({
            user_id: user.id,
            role_id: teacherRole.id,
            class_id: newClass.id
          })
      }

      // Show success animation
      setShowSuccess(true)
      
      // Redirect after animation
      setTimeout(() => {
        router.push(`/classes/${newClass.id}`)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create class')
    } finally {
      setLoading(false)
    }
  }

  const isFormValid = validFields.name && validFields.schedule && validFields.start_date
  const descriptionLength = formData.description.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Success Animation */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 shadow-2xl animate-bounce">
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Class Created!
              </h2>
              <p className="text-gray-600">Redirecting to your new class...</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/classes')}
            >
              ← Back
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎓</span>
              <h1 className="text-2xl font-bold text-gray-900">Create Your Class</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Card className="shadow-xl">
          <Card.Body className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div className="flex-1">
                    <p className="font-semibold text-red-900">Oops!</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {/* Class Name */}
              <div>
                <label className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                  <span>✨</span>
                  <span>Class Name</span>
                  {validFields.name && <span className="text-primary-500">✅</span>}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    validateField('name', e.target.value)
                  }}
                  placeholder="e.g., Algebra 1 - Spring 2026"
                  className="w-full p-4 text-lg border-2 border-gray-200 rounded-2xl 
                           focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                           transition-all duration-200"
                  required
                />
                {formData.name && !validFields.name && (
                  <p className="mt-2 text-sm text-gray-500 flex items-center gap-2">
                    <span>💡</span>
                    <span>Class name should be at least 3 characters</span>
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                  <span>📝</span>
                  <span>Description</span>
                  <span className="text-sm font-normal text-gray-500">(optional)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of what students will learn..."
                  rows={4}
                  maxLength={500}
                  className="w-full p-4 text-lg border-2 border-gray-200 rounded-2xl 
                           focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                           resize-none transition-all duration-200"
                />
                <div className="mt-2 flex justify-between items-center">
                  <p className="text-sm text-gray-500">
                    💡 Help students know what to expect
                  </p>
                  <p className="text-sm text-gray-500">
                    {descriptionLength}/500
                  </p>
                </div>
              </div>

              {/* Schedule */}
              <div>
                <label className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                  <span>📅</span>
                  <span>Class Schedule</span>
                  {validFields.schedule && <span className="text-primary-500">✅</span>}
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
                            className="w-full p-3 border-2 border-gray-200 rounded-xl 
                                     focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                     transition-all duration-200 bg-white"
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
                              className="w-full p-3 border-2 border-gray-200 rounded-xl 
                                       focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                       transition-all duration-200"
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
                              className="w-full p-3 border-2 border-gray-200 rounded-xl 
                                       focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                       transition-all duration-200"
                            />
                          </div>
                        </div>
                      </div>
                      {scheduleSlots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeScheduleSlot(slot.id)}
                          className="mt-8 p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
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
                  className="mt-4 flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 
                           rounded-xl transition-colors font-medium"
                >
                  <span>➕</span>
                  <span>Add Another Meeting Time</span>
                </button>

                {!validFields.schedule && scheduleSlots.every(s => !s.day && !s.startTime && !s.endTime) && (
                  <p className="mt-2 text-sm text-gray-500 flex items-center gap-2">
                    <span>💡</span>
                    <span>Add at least one meeting time</span>
                  </p>
                )}
              </div>

              {/* Dates */}
              <div>
                <label className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                  <span>🗓️</span>
                  <span>Class Dates</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date {validFields.start_date && <span className="text-primary-500">✅</span>}
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => {
                        setFormData({ ...formData, start_date: e.target.value })
                        validateField('start_date', e.target.value)
                      }}
                      className="w-full p-4 border-2 border-gray-200 rounded-xl 
                               focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                               transition-all duration-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date (optional)
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      min={formData.start_date}
                      className="w-full p-4 border-2 border-gray-200 rounded-xl 
                               focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                               transition-all duration-200"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/classes')}
                  disabled={loading}
                  size="lg"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!isFormValid || loading}
                  isLoading={loading}
                  size="lg"
                  className="flex-1"
                >
                  <span className="mr-2">🚀</span>
                  Create Class
                </Button>
              </div>

              {!isFormValid && (formData.name || formData.start_date) && (
                <p className="text-center text-sm text-gray-500">
                  💡 Fill in the required fields to create your class
                </p>
              )}
            </form>
          </Card.Body>
        </Card>
      </main>
    </div>
  )
}
