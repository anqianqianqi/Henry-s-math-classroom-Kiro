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
    end_date: '',
    // New marketing fields
    is_public: false,
    target_audience: '',
    age_range: '',
    skill_level: '',
    prerequisites: '',
    syllabus: '',
    materials_provided: '',
    homework_expectations: '',
    teacher_bio: '',
    teaching_style: '',
    max_students: '',
    price: '',
    location: ''
  })
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([
    { id: crypto.randomUUID(), day: '', startTime: '', endTime: '' }
  ])
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null)
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null)
  const [learningObjectives, setLearningObjectives] = useState<string[]>([''])
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
        end_date: data.end_date || '',
        // Load new marketing fields
        is_public: data.is_public || false,
        target_audience: data.target_audience || '',
        age_range: data.age_range || '',
        skill_level: data.skill_level || '',
        prerequisites: data.prerequisites || '',
        syllabus: data.syllabus || '',
        materials_provided: data.materials_provided || '',
        homework_expectations: data.homework_expectations || '',
        teacher_bio: data.teacher_bio || '',
        teaching_style: data.teaching_style || '',
        max_students: data.max_students?.toString() || '',
        price: data.price?.toString() || '',
        location: data.location || ''
      })

      // Load existing cover image
      if (data.cover_image_url) {
        setExistingCoverUrl(data.cover_image_url)
      }

      // Load learning objectives
      if (data.learning_objectives && Array.isArray(data.learning_objectives) && data.learning_objectives.length > 0) {
        setLearningObjectives(data.learning_objectives)
      }

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

  function handleCoverImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB')
        return
      }
      if (!file.type.startsWith('image/')) {
        setError('File must be an image')
        return
      }
      setCoverImage(file)
      setCoverImagePreview(URL.createObjectURL(file))
      setError(null)
    }
  }

  function addLearningObjective() {
    setLearningObjectives([...learningObjectives, ''])
  }

  function removeLearningObjective(index: number) {
    if (learningObjectives.length > 1) {
      setLearningObjectives(learningObjectives.filter((_, i) => i !== index))
    }
  }

  function updateLearningObjective(index: number, value: string) {
    const newObjectives = [...learningObjectives]
    newObjectives[index] = value
    setLearningObjectives(newObjectives)
  }

  async function deleteCoverImage() {
    if (existingCoverUrl) {
      try {
        // Extract file path from URL
        const urlParts = existingCoverUrl.split('/class-covers/')
        if (urlParts.length > 1) {
          const filePath = urlParts[1]
          await supabase.storage.from('class-covers').remove([filePath])
        }
        setExistingCoverUrl(null)
      } catch (err) {
        console.error('Failed to delete cover image:', err)
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upload new cover image if provided
      let coverImageUrl = existingCoverUrl
      if (coverImage) {
        const fileExt = coverImage.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('class-covers')
          .upload(fileName, coverImage)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('class-covers')
          .getPublicUrl(fileName)
        
        coverImageUrl = publicUrl

        // Delete old cover image if it exists
        if (existingCoverUrl) {
          await deleteCoverImage()
        }
      }

      // Filter out empty schedule slots and format them
      const validSlots = scheduleSlots
        .filter(slot => slot.day && slot.startTime && slot.endTime)
        .map(slot => ({
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime
        }))

      // Filter out empty learning objectives
      const validObjectives = learningObjectives.filter(obj => obj.trim() !== '')

      const { error } = await supabase
        .from('classes')
        .update({
          name: formData.name,
          description: formData.description || null,
          schedule: validSlots.length > 0 ? validSlots : null,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          // Update new marketing fields
          is_public: formData.is_public,
          cover_image_url: coverImageUrl,
          target_audience: formData.target_audience || null,
          age_range: formData.age_range || null,
          skill_level: formData.skill_level || null,
          prerequisites: formData.prerequisites || null,
          syllabus: formData.syllabus || null,
          learning_objectives: validObjectives.length > 0 ? validObjectives : null,
          materials_provided: formData.materials_provided || null,
          homework_expectations: formData.homework_expectations || null,
          teacher_bio: formData.teacher_bio || null,
          teaching_style: formData.teaching_style || null,
          max_students: formData.max_students ? parseInt(formData.max_students) : null,
          price: formData.price ? parseFloat(formData.price) : null,
          location: formData.location || null
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

              {/* Divider */}
              <div className="border-t-2 border-gray-200 my-6"></div>

              {/* Public Discovery Section */}
              <div className="bg-blue-50 p-6 rounded-lg space-y-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🌍</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      Public Class Discovery
                    </h3>
                    <p className="text-sm text-gray-600">
                      Make your class discoverable to parents and students
                    </p>
                  </div>
                </div>

                {/* Make Public Toggle */}
                <div className="flex items-center gap-3 p-4 bg-white rounded-lg">
                  <input
                    type="checkbox"
                    id="is_public"
                    checked={formData.is_public}
                    onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="is_public" className="flex-1 cursor-pointer">
                    <div className="font-semibold text-gray-900">Make this class public</div>
                    <div className="text-sm text-gray-600">Allow parents to discover and request trial classes</div>
                  </label>
                </div>

                {formData.is_public && (
                  <div className="space-y-4">
                    {/* Cover Image */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cover Image
                      </label>
                      {(coverImagePreview || existingCoverUrl) ? (
                        <div className="relative">
                          <img
                            src={coverImagePreview || existingCoverUrl || ''}
                            alt="Cover"
                            className="w-full h-48 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setCoverImage(null)
                              setCoverImagePreview(null)
                              if (existingCoverUrl) {
                                deleteCoverImage()
                              }
                            }}
                            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                          >
                            🗑️
                          </button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleCoverImageChange}
                            className="hidden"
                            id="cover-image"
                          />
                          <label htmlFor="cover-image" className="cursor-pointer">
                            <div className="text-3xl mb-2">📸</div>
                            <div className="text-sm text-gray-600">Click to upload (max 5MB)</div>
                          </label>
                        </div>
                      )}
                    </div>

                    <FormField label="Who is this class for?">
                      <textarea
                        value={formData.target_audience}
                        onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                        placeholder="Describe the ideal student..."
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </FormField>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Age/Grade Range">
                        <Input
                          type="text"
                          value={formData.age_range}
                          onChange={(e) => setFormData({ ...formData, age_range: e.target.value })}
                          placeholder="e.g., Grades 3-5"
                        />
                      </FormField>
                      <FormField label="Skill Level">
                        <select
                          value={formData.skill_level}
                          onChange={(e) => setFormData({ ...formData, skill_level: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select...</option>
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      </FormField>
                    </div>

                    <FormField label="Prerequisites (optional)">
                      <textarea
                        value={formData.prerequisites}
                        onChange={(e) => setFormData({ ...formData, prerequisites: e.target.value })}
                        placeholder="Required knowledge or skills..."
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </FormField>

                    <FormField label="Syllabus / What's Included">
                      <textarea
                        value={formData.syllabus}
                        onChange={(e) => setFormData({ ...formData, syllabus: e.target.value })}
                        placeholder="Course topics and what students will learn..."
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </FormField>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Learning Objectives
                      </label>
                      <div className="space-y-2">
                        {learningObjectives.map((objective, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={objective}
                              onChange={(e) => updateLearningObjective(index, e.target.value)}
                              placeholder={`Objective ${index + 1}`}
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            {learningObjectives.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLearningObjective(index)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={addLearningObjective}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        ➕ Add Objective
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Materials Provided">
                        <textarea
                          value={formData.materials_provided}
                          onChange={(e) => setFormData({ ...formData, materials_provided: e.target.value })}
                          placeholder="Worksheets, textbooks..."
                          rows={2}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </FormField>
                      <FormField label="Homework Expectations">
                        <textarea
                          value={formData.homework_expectations}
                          onChange={(e) => setFormData({ ...formData, homework_expectations: e.target.value })}
                          placeholder="Time commitment..."
                          rows={2}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </FormField>
                    </div>

                    <FormField label="About the Teacher">
                      <textarea
                        value={formData.teacher_bio}
                        onChange={(e) => setFormData({ ...formData, teacher_bio: e.target.value })}
                        placeholder="Your qualifications and experience..."
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </FormField>

                    <FormField label="Teaching Style">
                      <Input
                        type="text"
                        value={formData.teaching_style}
                        onChange={(e) => setFormData({ ...formData, teaching_style: e.target.value })}
                        placeholder="e.g., Interactive, Project-based"
                      />
                    </FormField>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField label="Max Students">
                        <Input
                          type="number"
                          value={formData.max_students}
                          onChange={(e) => setFormData({ ...formData, max_students: e.target.value })}
                          placeholder="20"
                          min="1"
                        />
                      </FormField>
                      <FormField label="Price ($)">
                        <Input
                          type="number"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                        />
                      </FormField>
                      <FormField label="Location">
                        <Input
                          type="text"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          placeholder="Online"
                        />
                      </FormField>
                    </div>
                  </div>
                )}
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
