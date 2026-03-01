'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'

export default function NewClassPage() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schedule: '',
    start_date: '',
    end_date: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create class
      const { data: newClass, error: classError } = await supabase
        .from('classes')
        .insert({
          name: formData.name,
          description: formData.description || null,
          schedule: formData.schedule || null,
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

      router.push(`/classes/${newClass.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create class')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/classes')}
            className="mb-4"
          >
            ← Back to Classes
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Create New Class</h1>
        </div>

        <Card>
          <Card.Body>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <FormField
                label="Class Name"
                required
                error={formData.name === '' ? undefined : ''}
              >
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
                  onClick={() => router.push('/classes')}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={loading}
                  className="flex-1"
                >
                  Create Class
                </Button>
              </div>
            </form>
          </Card.Body>
        </Card>
      </div>
    </div>
  )
}
