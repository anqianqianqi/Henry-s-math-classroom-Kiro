'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { generateOccurrences } from '@/lib/utils/occurrences'
import { useViewerZone } from '@/components/ui/useViewerZone'

/** Weekday values as stored, paired with their catalog key. */
const DAY_KEYS = [
  ['Monday', 'day.monday'],
  ['Tuesday', 'day.tuesday'],
  ['Wednesday', 'day.wednesday'],
  ['Thursday', 'day.thursday'],
  ['Friday', 'day.friday'],
  ['Saturday', 'day.saturday'],
  ['Sunday', 'day.sunday'],
] as const


interface ScheduleSlot {
  id: string
  day: string
  startTime: string
  endTime: string
}

export default function NewClassPage() {
  const { t } = useLanguage()
  // The teacher's saved zone. Virtual classes run on the teacher's clock, and
  // the schedule below is typed while looking at it.
  const { timezone: teacherTimezone } = useViewerZone()
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
  const [learningObjectives, setLearningObjectives] = useState<string[]>([''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [validFields, setValidFields] = useState({
    name: false,
    schedule: false,
    start_date: false
  })
  const [showValidationErrors, setShowValidationErrors] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkTeacher() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: roles } = await supabase.from('user_roles').select('role_id').eq('user_id', user.id).is('class_id', null)
      if (roles && roles.length > 0) {
        const { data: roleData } = await supabase.from('roles').select('name').in('id', roles.map((r: any) => r.role_id))
        if (!roleData?.some((r: any) => r.name === 'teacher' || r.name === 'administrator')) {
          router.push('/dashboard')
        }
      } else {
        router.push('/dashboard')
      }
    }
    checkTeacher()
  }, [])

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Check validation
    if (!isFormValid) {
      setShowValidationErrors(true)
      setError('Please fill in all required fields')
      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    
    setLoading(true)
    setError(null)
    setShowValidationErrors(false)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upload cover image if provided
      let coverImageUrl: string | null = null
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

      // Create class with all fields
      const { data: newClass, error: classError } = await supabase
        .from('classes')
        .insert({
          name: formData.name,
          description: formData.description || null,
          schedule: validSlots.length > 0 ? validSlots : null,
          /*
            Classes are virtual, so "where the class runs" is the teacher's own
            clock: the times above were typed while looking at it. Students
            elsewhere see them converted.

            Taken from the teacher's saved zone rather than the browser's, so a
            teacher setting up a class from a hotel abroad does not silently
            move every session for the whole class.
          */
          timezone: teacherTimezone,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          created_by: user.id,
          // New marketing fields
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
      
      // Auto-generate sessions if schedule and start date exist
      if (validSlots.length > 0 && formData.start_date) {
        try {
          const endDate = formData.end_date
            ? new Date(formData.end_date)
            : new Date(new Date(formData.start_date).getTime() + 8 * 7 * 24 * 60 * 60 * 1000) // 8 weeks

          const occurrences = generateOccurrences(
            newClass.id,
            validSlots.map(s => ({ day: s.day, startTime: s.startTime, endTime: s.endTime })),
            new Date(formData.start_date),
            endDate
          )

          if (occurrences.length > 0) {
            await supabase.from('class_occurrences').insert(occurrences)
          }
        } catch (err) {
          console.error('Failed to generate sessions:', err)
        }
      }
      
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
              <p className="text-gray-600">{t('classForm.redirecting')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/classes')}>
              ←
            </Button>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">{t('classForm.newClass')}</h1>
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
                    <p className="font-semibold text-red-900">{t('classForm.oops')}</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {/* Class Name */}
              <div>
                <label className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                  <span>✨</span>
                  <span>{t('classForm.className')}</span>
                  <span className="text-red-500">*</span>
                  {validFields.name && <span className="text-primary-500">✅</span>}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    validateField('name', e.target.value)
                  }}
                  placeholder={t('classForm.classNamePlaceholder')}
                  className={`w-full p-4 text-lg border-2 rounded-2xl 
                           focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                           transition-all duration-200 ${
                             showValidationErrors && !validFields.name
                               ? 'border-red-300 bg-red-50'
                               : 'border-gray-200'
                           }`}
                />
                {showValidationErrors && !validFields.name && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>{t('classForm.classNameRequired')}</span>
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                  <span>📝</span>
                  <span>{t('class.description')}</span>
                  <span className="text-sm font-normal text-gray-500">(optional)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('classForm.descriptionPlaceholder')}
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
                  <span>{t('classForm.schedule')}</span>
                  <span className="text-red-500">*</span>
                  {validFields.schedule && <span className="text-primary-500">✅</span>}
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Add one or more meeting times for your class
                </p>
                
                {showValidationErrors && !validFields.schedule && (
                  <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-xl flex items-center gap-2">
                    <span>⚠️</span>
                    <span className="text-sm text-red-700 font-medium">
                      Please add at least one complete meeting time (day, start time, and end time)
                    </span>
                  </div>
                )}
                
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
                            <option value="">{t('classForm.selectDay')}</option>
                            {DAY_KEYS.map(([value, key]) => (
                              <option key={value} value={value}>{t(key)}</option>
                            ))}
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
                  <span>{t('classForm.addMeeting')}</span>
                </button>

                {!validFields.schedule && scheduleSlots.every(s => !s.day && !s.startTime && !s.endTime) && (
                  <p className="mt-2 text-sm text-gray-500 flex items-center gap-2">
                    <span>💡</span>
                    <span>{t('classForm.needMeeting')}</span>
                  </p>
                )}
              </div>

              {/* Dates */}
              <div>
                <label className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                  <span>🗓️</span>
                  <span>{t('classForm.classDates')}</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date <span className="text-red-500">*</span>
                      {validFields.start_date && <span className="text-primary-500">✅</span>}
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => {
                        setFormData({ ...formData, start_date: e.target.value })
                        validateField('start_date', e.target.value)
                      }}
                      className={`w-full p-4 border-2 rounded-xl 
                               focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                               transition-all duration-200 ${
                                 showValidationErrors && !validFields.start_date
                                   ? 'border-red-300 bg-red-50'
                                   : 'border-gray-200'
                               }`}
                    />
                    {showValidationErrors && !validFields.start_date && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{t('classForm.startRequired')}</span>
                      </p>
                    )}
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

              {/* Divider */}
              <div className="border-t-2 border-gray-200 my-8"></div>

              {/* Public Discovery Section */}
              <div className="bg-blue-50 p-6 rounded-2xl space-y-6">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🌍</span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      Public Class Discovery
                    </h3>
                    <p className="text-sm text-gray-600">
                      Make your class discoverable to parents and students. Add details to help them decide if it&apos;s right for them.
                    </p>
                  </div>
                </div>

                {/* Make Public Toggle */}
                <div className="flex items-center gap-3 p-4 bg-white rounded-xl">
                  <input
                    type="checkbox"
                    id="is_public"
                    checked={formData.is_public}
                    onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                    className="w-6 h-6 text-primary-500 rounded focus:ring-2 focus:ring-primary-500"
                  />
                  <label htmlFor="is_public" className="flex-1 cursor-pointer">
                    <div className="font-semibold text-gray-900">
                      Make this class public
                    </div>
                    <div className="text-sm text-gray-600">
                      Allow parents to discover and request trial classes
                    </div>
                  </label>
                </div>

                {formData.is_public && (
                  <div className="space-y-6">
                    {/* Cover Image */}
                    <div>
                      <label className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                        <span>🖼️</span>
                        <span>{t('classForm.coverImage')}</span>
                        <span className="text-sm font-normal text-gray-500">(recommended)</span>
                      </label>
                      {coverImagePreview ? (
                        <div className="relative">
                          <img
                            src={coverImagePreview}
                            alt="Cover preview"
                            className="w-full h-48 object-cover rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setCoverImage(null)
                              setCoverImagePreview(null)
                            }}
                            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                          >
                            🗑️ Remove
                          </button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleCoverImageChange}
                            className="hidden"
                            id="cover-image"
                          />
                          <label htmlFor="cover-image" className="cursor-pointer">
                            <div className="text-4xl mb-2">📸</div>
                            <div className="text-sm text-gray-600">
                              Click to upload cover image (max 5MB)
                            </div>
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Target Audience */}
                    <div>
                      <label className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                        <span>🎯</span>
                        <span>{t('classForm.whoFor')}</span>
                      </label>
                      <textarea
                        value={formData.target_audience}
                        onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                        placeholder={t('classForm.whoForPlaceholder')}
                        rows={3}
                        className="w-full p-4 border-2 border-gray-200 rounded-xl 
                                 focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                 resize-none transition-all duration-200"
                      />
                    </div>

                    {/* Age Range & Skill Level */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Age/Grade Range
                        </label>
                        <input
                          type="text"
                          value={formData.age_range}
                          onChange={(e) => setFormData({ ...formData, age_range: e.target.value })}
                          placeholder={t('classForm.ageRangePlaceholder')}
                          className="w-full p-3 border-2 border-gray-200 rounded-xl 
                                   focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                   transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Skill Level
                        </label>
                        <select
                          value={formData.skill_level}
                          onChange={(e) => setFormData({ ...formData, skill_level: e.target.value })}
                          className="w-full p-3 border-2 border-gray-200 rounded-xl 
                                   focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                   transition-all duration-200 bg-white"
                        >
                          <option value="">{t('classForm.selectLevel')}</option>
                          <option value="beginner">{t('classForm.beginner')}</option>
                          <option value="intermediate">{t('classForm.intermediate')}</option>
                          <option value="advanced">{t('classForm.advanced')}</option>
                        </select>
                      </div>
                    </div>

                    {/* Prerequisites */}
                    <div>
                      <label className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                        <span>📋</span>
                        <span>{t('classForm.prerequisites')}</span>
                        <span className="text-sm font-normal text-gray-500">(optional)</span>
                      </label>
                      <textarea
                        value={formData.prerequisites}
                        onChange={(e) => setFormData({ ...formData, prerequisites: e.target.value })}
                        placeholder={t('classForm.prerequisitesPlaceholder')}
                        rows={2}
                        className="w-full p-4 border-2 border-gray-200 rounded-xl 
                                 focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                 resize-none transition-all duration-200"
                      />
                    </div>

                    {/* Syllabus */}
                    <div>
                      <label className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                        <span>📚</span>
                        <span>{t('classForm.syllabus')}</span>
                      </label>
                      <textarea
                        value={formData.syllabus}
                        onChange={(e) => setFormData({ ...formData, syllabus: e.target.value })}
                        placeholder={t('classForm.syllabusPlaceholder')}
                        rows={5}
                        className="w-full p-4 border-2 border-gray-200 rounded-xl 
                                 focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                 resize-none transition-all duration-200"
                      />
                    </div>

                    {/* Learning Objectives */}
                    <div>
                      <label className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                        <span>🎓</span>
                        <span>{t('classForm.objectives')}</span>
                        <span className="text-sm font-normal text-gray-500">(optional)</span>
                      </label>
                      <div className="space-y-3">
                        {learningObjectives.map((objective, index) => (
                          <div key={index} className="flex gap-3">
                            <input
                              type="text"
                              value={objective}
                              onChange={(e) => updateLearningObjective(index, e.target.value)}
                              placeholder={`Objective ${index + 1}`}
                              className="flex-1 p-3 border-2 border-gray-200 rounded-xl 
                                       focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                       transition-all duration-200"
                            />
                            {learningObjectives.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLearningObjective(index)}
                                className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
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
                        className="mt-3 flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 
                                 rounded-xl transition-colors font-medium"
                      >
                        <span>➕</span>
                        <span>{t('classForm.addObjective')}</span>
                      </button>
                    </div>

                    {/* Materials & Homework */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Materials Provided <span className="text-sm font-normal text-gray-500">(optional)</span>
                        </label>
                        <textarea
                          value={formData.materials_provided}
                          onChange={(e) => setFormData({ ...formData, materials_provided: e.target.value })}
                          placeholder={t('classForm.materialsPlaceholder')}
                          rows={3}
                          className="w-full p-3 border-2 border-gray-200 rounded-xl 
                                   focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                   resize-none transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Homework Expectations <span className="text-sm font-normal text-gray-500">(optional)</span>
                        </label>
                        <textarea
                          value={formData.homework_expectations}
                          onChange={(e) => setFormData({ ...formData, homework_expectations: e.target.value })}
                          placeholder={t('classForm.commitmentPlaceholder')}
                          rows={3}
                          className="w-full p-3 border-2 border-gray-200 rounded-xl 
                                   focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                   resize-none transition-all duration-200"
                        />
                      </div>
                    </div>

                    {/* Teacher Info */}
                    <div>
                      <label className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                        <span>👨‍🏫</span>
                        <span>{t('classForm.aboutTeacher')}</span>
                        <span className="text-sm font-normal text-gray-500">(optional)</span>
                      </label>
                      <textarea
                        value={formData.teacher_bio}
                        onChange={(e) => setFormData({ ...formData, teacher_bio: e.target.value })}
                        placeholder={t('classForm.aboutTeacherPlaceholder')}
                        rows={4}
                        className="w-full p-4 border-2 border-gray-200 rounded-xl 
                                 focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                 resize-none transition-all duration-200"
                      />
                    </div>

                    {/* Teaching Style */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Teaching Style <span className="text-sm font-normal text-gray-500">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.teaching_style}
                        onChange={(e) => setFormData({ ...formData, teaching_style: e.target.value })}
                        placeholder={t('classForm.teachingStylePlaceholder')}
                        className="w-full p-3 border-2 border-gray-200 rounded-xl 
                                 focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                 transition-all duration-200"
                      />
                    </div>

                    {/* Class Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Students
                        </label>
                        <input
                          type="number"
                          value={formData.max_students}
                          onChange={(e) => setFormData({ ...formData, max_students: e.target.value })}
                          placeholder="20"
                          min="1"
                          className="w-full p-3 border-2 border-gray-200 rounded-xl 
                                   focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                   transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Price ($)
                        </label>
                        <input
                          type="number"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full p-3 border-2 border-gray-200 rounded-xl 
                                   focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                   transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Location
                        </label>
                        <select
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className="w-full p-3 border-2 border-gray-200 rounded-xl 
                                   focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                   transition-all duration-200 bg-white"
                        >
                          <option value="">Select...</option>
                          <option value="Online">Online</option>
                          <option value="In-person">In-person</option>
                          <option value="Hybrid">Hybrid</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
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
                  disabled={loading}
                  isLoading={loading}
                  size="lg"
                  className="flex-1"
                >
                  <span className="mr-2">🚀</span>
                  Create Class
                </Button>
              </div>
            </form>
          </Card.Body>
        </Card>
      </main>
    </div>
  )
}
