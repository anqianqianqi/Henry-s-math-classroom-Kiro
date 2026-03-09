'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface HomeworkFormProps {
  occurrenceId: string
  existingAssignment?: HomeworkAssignment | null
  onSave: () => void
  onCancel?: () => void
}

interface HomeworkAssignment {
  id: string
  title: string
  description: string
  due_date: string
  points_possible: number
  submission_type: 'file' | 'text' | 'link'
  assignment_file_url?: string
  allow_late: boolean
}

export default function HomeworkForm({
  occurrenceId,
  existingAssignment,
  onSave,
  onCancel
}: HomeworkFormProps) {
  const [title, setTitle] = useState(existingAssignment?.title || '')
  const [description, setDescription] = useState(existingAssignment?.description || '')
  const [dueDate, setDueDate] = useState(
    existingAssignment?.due_date
      ? new Date(existingAssignment.due_date).toISOString().slice(0, 16)
      : ''
  )
  const [pointsPossible, setPointsPossible] = useState(
    existingAssignment?.points_possible || 100
  )
  const [submissionType, setSubmissionType] = useState<'file' | 'text' | 'link'>(
    existingAssignment?.submission_type || 'file'
  )
  const [allowLate, setAllowLate] = useState(existingAssignment?.allow_late || false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim() || !description.trim() || !dueDate) {
      setError('Please fill in all required fields')
      return
    }

    if (pointsPossible < 1) {
      setError('Points must be at least 1')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const assignmentData = {
        occurrence_id: occurrenceId,
        created_by: user.id,
        title: title.trim(),
        description: description.trim(),
        due_date: new Date(dueDate).toISOString(),
        points_possible: pointsPossible,
        submission_type: submissionType,
        allow_late: allowLate
      }

      if (existingAssignment) {
        // Update existing assignment
        const { error: updateError } = await supabase
          .from('homework_assignments')
          .update(assignmentData)
          .eq('id', existingAssignment.id)

        if (updateError) throw updateError
      } else {
        // Create new assignment
        const { error: insertError } = await supabase
          .from('homework_assignments')
          .insert(assignmentData)

        if (insertError) throw insertError
      }

      onSave()
    } catch (err) {
      console.error('Failed to save assignment:', err)
      setError(err instanceof Error ? err.message : 'Failed to save assignment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>
          {existingAssignment ? 'Edit Homework Assignment' : 'Create Homework Assignment'}
        </Card.Title>
      </Card.Header>
      <Card.Body>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Chapter 3 Practice Problems"
              disabled={saving}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instructions <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide detailed instructions for students..."
              rows={6}
              disabled={saving}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Be clear about what students need to submit and any specific requirements
            </p>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={saving}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Points Possible */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Points Possible <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              value={pointsPossible}
              onChange={(e) => setPointsPossible(parseInt(e.target.value) || 0)}
              min={1}
              max={1000}
              disabled={saving}
              required
            />
          </div>

          {/* Submission Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Submission Type <span className="text-red-500">*</span>
            </label>
            <select
              value={submissionType}
              onChange={(e) => setSubmissionType(e.target.value as any)}
              disabled={saving}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="file">File Upload</option>
              <option value="text">Text Entry</option>
              <option value="link">Link/URL</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {submissionType === 'file' && 'Students will upload a file (PDF, DOC, image, etc.)'}
              {submissionType === 'text' && 'Students will type their answer directly'}
              {submissionType === 'link' && 'Students will submit a URL link'}
            </p>
          </div>

          {/* Allow Late Submissions */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allow-late"
              checked={allowLate}
              onChange={(e) => setAllowLate(e.target.checked)}
              disabled={saving}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="allow-late" className="text-sm text-gray-700">
              Allow late submissions
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">⚠️ {error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : existingAssignment ? 'Update Assignment' : 'Create Assignment'}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="secondary"
                onClick={onCancel}
                disabled={saving}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card.Body>
    </Card>
  )
}
