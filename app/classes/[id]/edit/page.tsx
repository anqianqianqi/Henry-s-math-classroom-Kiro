'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'

export default function EditClassPage() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schedule: '',
    start_date: '',
    end_date: ''
  })
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
        schedule: data.schedule || '',
        start_date: data.start_date,
        end_date: data.end_date || ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load class')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('classes')
        .update({
          name: formData.name,
          description: formData.description || null,
          schedule: formData.schedule || null,
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

              <FormField label="Schedule">
                <Input
                  type="text"
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  placeholder="e.g., Mon/Wed/Fri 10:00 AM - 11:30 AM"
                />
              </FormField>

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
