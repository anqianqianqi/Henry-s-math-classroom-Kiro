'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import TagInput, { TagOption } from '@/components/TagInput'
import { generateChallenge, GenerativeTemplate } from '@/lib/challenge-generator'
import { PageHeader } from '@/components/ui/PageHeader'
import { schoolDateString } from '@/lib/utils/timezone'
import {
  HENRY_PROBLEM_EXTENSION,
  HenryProblemError,
  isHenryProblemFile,
  parseHenryProblem,
  type StoredHenryProblem,
} from '@/lib/henryproblem'
import { cropGraphToBlob } from '@/lib/henryproblem-graph'
import { HenryProblemSheet } from '@/components/HenryProblemSheet'

interface Class {
  id: string
  name: string
  created_by: string
}

export default function NewChallengePage() {
  const { t, language } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const fromBank = searchParams.get('source') === 'bank'
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [challengeDate, setChallengeDate] = useState('')
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<TagOption[]>([])
  // Follows the site-wide switcher; there is no second language control.
  const tagLang = language
  const [maxPoints, setMaxPoints] = useState(100)
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [allStudents, setAllStudents] = useState<Array<{id: string, name: string, email?: string}>>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [tagGroups, setTagGroups] = useState<Array<{id: string, name: string, tag_ids: string[]}>>([])
  const [allTagGroupData, setAllTagGroupData] = useState<any[]>([])
  const [generativeTemplates, setGenerativeTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null)
  const [saveToPool, setSaveToPool] = useState(false)
  // Image parsing state
  const [parseImageFile, setParseImageFile] = useState<File | null>(null)
  const [parseImagePreview, setParseImagePreview] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  // Pending new tags suggested by GPT — shown for confirmation before creating
  const [pendingNewTags, setPendingNewTags] = useState<string[]>([])
  const [creatingTags, setCreatingTags] = useState(false)
  // .henryproblem import state — structured, no API call needed
  const [henryProblem, setHenryProblem] = useState<StoredHenryProblem | null>(null)
  const [henryFileName, setHenryFileName] = useState<string | null>(null)
  const [henryError, setHenryError] = useState<string | null>(null)
  const [henryLoading, setHenryLoading] = useState(false)
  useEffect(() => {
    if (fromBank) {
      setSaveToPool(true)
      setChallengeDate('')
    }
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    setUserId(user.id)

    // Check if user is teacher — use a single joined query instead of two sequential ones
    const { data: roleCheck } = await supabase
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', user.id)
      .is('class_id', null)

    const hasTeacherRole = (roleCheck as any[])?.some(
      (r: any) => r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
    )

    if (!hasTeacherRole) {
      router.push('/dashboard')
      return
    }

    // ── Run all independent queries in parallel ───────────────────────────
    const [
      { data: classesData },
      { data: tagsData },
      { data: groupsData },
      { data: genTemplates },
    ] = await Promise.all([
      supabase.from('classes')
        .select('id, name, created_by, is_active')
        .eq('is_active', true)
        .order('name'),
      supabase.from('challenge_tags')
        .select('id, challenge_tag_names(language, name)')
        .order('created_at'),
      supabase.from('tag_groups')
        .select('id, tag_group_names(language, name), tag_group_members(tag_id)')
        .order('created_at'),
      supabase.from('challenge_templates')
        .select('id, title_template, description_template, variables, answer_formula, max_points, tag_ids')
        .eq('is_generative', true)
        .order('created_at', { ascending: false }),
    ])

    setClasses(classesData || [])

    const tagOptions: TagOption[] = (tagsData || []).map((t: any) => {
      const names = t.challenge_tag_names || []
      return { id: t.id, name: t.id.slice(0, 8), _names: names }
    })
    setAvailableTags(tagOptions as any)

    setAllTagGroupData(groupsData || [])
    const groupsList = (groupsData || []).map((g: any) => {
      const name = g.tag_group_names?.find((n: any) => n.language === tagLang)?.name
        || g.tag_group_names?.find((n: any) => n.language === 'en')?.name
        || g.tag_group_names?.[0]?.name || 'Group'
      const tagIds = (g.tag_group_members || []).map((m: any) => m.tag_id)
      return { id: g.id, name, tag_ids: tagIds }
    })
    setTagGroups(groupsList)

    setGenerativeTemplates(genTemplates || [])

    // ── Students: deferred — only load when user expands individual assignment ──
    // (loaded lazily in the UI when needed)

    // Set default date to today (only if not saving to bank)
    if (!fromBank) {
      const today = schoolDateString()
      setChallengeDate(today)
    }
    
    setLoading(false)
  }

  // Lazy-load students only when the individual assignment section is expanded
  async function loadStudentsIfNeeded() {
    if (allStudents.length > 0) return
    const [{ data: profilesData }, { data: teacherRoles }] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, full_name').order('full_name'),
      supabase.from('user_roles').select('user_id, roles!inner(name)').is('class_id', null),
    ])
    const teacherIds = new Set(
      (teacherRoles || [])
        .filter((r: any) => r.roles?.name === 'teacher' || r.roles?.name === 'administrator')
        .map((r: any) => r.user_id)
    )
    const students = (profilesData || [])
      .filter((p: any) => !teacherIds.has(p.id))
      .map((p: any) => ({
        id: p.id,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.full_name || 'Unknown'
      }))
    setAllStudents(students)
  }

  function toggleClass(classId: string) {
    setSelectedClasses(prev => 
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    )
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB')
        return
      }

      setImageFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
  }

  /**
   * Match tag names against existing tags; anything unknown becomes a pending
   * tag the teacher confirms before it is created.
   */
  function applyTagNames(names: string[]) {
    const matchedIds: string[] = []
    const unmatched: string[] = []

    for (const rawName of names) {
      const name = rawName.trim()
      if (!name) continue
      const existing = (availableTags as any[]).find((t: any) =>
        (t._names || []).some((n: any) => String(n.name).toLowerCase() === name.toLowerCase())
      )
      if (existing) matchedIds.push(existing.id)
      else unmatched.push(name)
    }

    if (matchedIds.length > 0) setTags(prev => [...new Set([...prev, ...matchedIds])])
    if (unmatched.length > 0) setPendingNewTags(prev => [...new Set([...prev, ...unmatched])])
  }

  /**
   * Read a .henryproblem snapshot and fill the form directly from its fields.
   * No image parsing, no LLM call — the file already holds title, score, tags
   * and both language versions of the wording.
   */
  async function handleHenryProblemChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file after an error
    if (!file) return

    setHenryError(null)

    if (!isHenryProblemFile(file.name)) {
      setHenryError(`Please choose a ${HENRY_PROBLEM_EXTENSION} file.`)
      return
    }
    if (file.size > 40 * 1024 * 1024) {
      setHenryError('That file is too large to read.')
      return
    }

    setHenryLoading(true)
    try {
      const parsed = parseHenryProblem(await file.text())

      if (parsed.title) setTitle(parsed.title)
      setDescription(parsed.description)
      if (parsed.maxPoints != null) setMaxPoints(parsed.maxPoints)
      if (parsed.tagNames.length > 0) applyTagNames(parsed.tagNames)

      // The embedded diagram becomes the challenge image, cropped exactly as
      // the snapshot specifies. It rides the existing upload path.
      if (parsed.graphDataUrl) {
        const blob = await cropGraphToBlob(parsed.graphDataUrl, parsed.crop)
        const base = file.name.replace(new RegExp(`${HENRY_PROBLEM_EXTENSION}$`, 'i'), '')
        setImageFile(new File([blob], `${base || 'graph'}.png`, { type: 'image/png' }))
        setImagePreview(URL.createObjectURL(blob))
      }

      setHenryProblem(parsed.stored)
      setHenryFileName(file.name)
    } catch (err) {
      setHenryError(
        err instanceof HenryProblemError
          ? err.message
          : 'Could not read that file. Please try again.'
      )
    } finally {
      setHenryLoading(false)
    }
  }

  function removeHenryProblem() {
    setHenryProblem(null)
    setHenryFileName(null)
    setHenryError(null)
  }

  async function uploadImage(challengeId: string): Promise<string | null> {
    if (!imageFile || !userId) return null

    setUploadingImage(true)
    try {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${userId}/${challengeId}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('challenge-images')
        .upload(fileName, imageFile, {
          upsert: true,
          contentType: imageFile.type
        })

      if (error) {
        console.error('Error uploading image:', error)
        return null
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('challenge-images')
        .getPublicUrl(fileName)

      return publicUrl
    } catch (err) {
      console.error('Error uploading image:', err)
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('Please enter a title')
      return
    }

    if (!description.trim()) {
      setError('Please enter a description')
      return
    }

    if (!saveToPool && !challengeDate) {
      setError('Please select a date or save to pool')
      return
    }

    if (selectedClasses.length === 0) {
      // No class selected - that's fine, create without assignment
    }

    if (!userId) return

    setSubmitting(true)

    // Resolve final tag IDs — create any pending new tags first
    let finalTagIds = [...tags]
    if (pendingNewTags.length > 0) {
      for (const tagName of pendingNewTags) {
        const slug = tagName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        try {
          const { data: newTag } = await supabase
            .from('challenge_tags')
            .insert({ name: slug, created_by: userId })
            .select('id')
            .single()
          if (newTag?.id) {
            await supabase.from('challenge_tag_names').insert({ tag_id: newTag.id, language: 'en', name: tagName })
            finalTagIds.push(newTag.id)
          }
        } catch { /* skip on error */ }
      }
      setPendingNewTags([])
    }

    try {
      let challenge: any = null
      let challengeError: any = null

      if (saveToPool) {
        // Save to challenge_bank table
        const result = await supabase
          .from('challenge_bank')
          .insert({
            created_by: userId,
            title: title.trim(),
            description: description.trim(),
            tag_ids: finalTagIds,
            max_points: maxPoints,
            henryproblem: henryProblem,
          })
          .select()
          .single()
        challenge = result.data
        challengeError = result.error
      } else {
        // Save to daily_challenges table
        const result = await supabase
          .from('daily_challenges')
          .insert({
            created_by: userId,
            title: title.trim(),
            description: description.trim(),
            challenge_date: challengeDate,
            tag_ids: finalTagIds,
            max_points: maxPoints,
            henryproblem: henryProblem,
          })
          .select()
          .single()
        challenge = result.data
        challengeError = result.error
      }

      console.log('Challenge created:', challenge)
      console.log('Challenge error:', challengeError)

      if (challengeError) {
        setError(challengeError.message)
        setSubmitting(false)
        return
      }

      // Upload image if provided
      let imageUrl: string | null = null
      if (imageFile) {
        imageUrl = await uploadImage(challenge.id)
        if (imageUrl) {
          // Update challenge with image URL (use correct table)
          await supabase
            .from(saveToPool ? 'challenge_bank' : 'daily_challenges')
            .update({ image_url: imageUrl })
            .eq('id', challenge.id)
        }
      }

      // Assign to selected classes (optional)
      if (selectedClasses.length > 0) {
        const assignments = selectedClasses.map(classId => ({
          challenge_id: challenge.id,
          class_id: classId,
          assigned_by: userId
        }))

        const { error: assignError } = await supabase
          .from('challenge_assignments')
          .insert(assignments)

        if (assignError) {
          console.error('Assignment failed:', assignError)
          setError(`Challenge created but assignment failed: ${assignError.message}`)
          setSubmitting(false)
          return
        }
      }

      // Assign to individual students (optional)
      if (selectedStudents.length > 0) {
        const studentAssignments = selectedStudents.map(studentId => ({
          challenge_id: challenge.id,
          student_id: studentId,
          assigned_by: userId
        }))

        const { error: studentAssignError } = await supabase
          .from('challenge_student_assignments')
          .insert(studentAssignments)

        if (studentAssignError) {
          console.error('Student assignment failed:', studentAssignError)
          // Don't block - challenge was created
        }
      }

      // Success! Grant teacher pet XP for creating a challenge (await so DB is updated before redirect)
      try {
        const xpRes = await fetch('/api/pet/teacher-xp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_challenge' }),
        })
        const xpData = await xpRes.json()
        console.log('[teacher-xp] response:', xpRes.status, xpData)
        // Store the XP gain so DesktopPetWrapper can pick it up after navigation
        if (xpData?.ok && xpData?.new_xp != null) {
          sessionStorage.setItem('didi-pending-xp', JSON.stringify({
            xp:        xpData.new_xp,
            happiness: xpData.new_happiness,
            hunger:    xpData.new_hunger,
            stage:     xpData.new_stage,
          }))
        }
      } catch (e) {
        console.error('[teacher-xp] fetch error:', e)
      }

      // Redirect — DesktopPetWrapper will pick up the pending XP on pathname change
      router.push(saveToPool ? '/admin/challenge-bank' : '/challenges')
    } catch (err) {
      console.error('Error creating challenge:', err)
      setError('An unexpected error occurred')
      setSubmitting(false)
    }
  }

  async function handleParseImage() {
    if (!parseImageFile) return
    setParsing(true)
    setParseError(null)

    try {
      // Convert file to base64
      const arrayBuffer = await parseImageFile.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')

      const res = await fetch('/api/parse-challenge-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: parseImageFile.type }),
      })
      const data = await res.json()

      if (!res.ok) {
        setParseError(data.error || 'Failed to parse image')
        return
      }

      // Fill in the form fields with parsed values
      if (data.title) setTitle(data.title)
      if (data.description) setDescription(data.description)
      if (data.maxPoints) setMaxPoints(data.maxPoints)
      // hint field is stored separately — scroll user to the form
      // Store hint in description if not empty (hint field is separate in the challenge page)
      // We'll store it appended as a note for now
      if (data.hint) {
        setDescription(prev => prev + (prev ? '\n\n[Hint: ' + data.hint + ']' : '[Hint: ' + data.hint + ']'))
      }

      // Clear the parse image after successful fill
      setParseImageFile(null)
      setParseImagePreview(null)
    } catch (err) {
      setParseError('Something went wrong. Please try again.')
    } finally {
      setParsing(false)
    }
  }

  async function handleGenerateFromTemplate() {
    if (!selectedTemplateId || !userId) return

    const rawTemplate = generativeTemplates.find(t => t.id === selectedTemplateId)
    if (!rawTemplate) return

    setGenerating(true)
    setError('')
    setGenerateSuccess(null)

    try {
      const template: GenerativeTemplate = {
        id: rawTemplate.id,
        title_template: rawTemplate.title_template,
        description_template: rawTemplate.description_template,
        variables: rawTemplate.variables,
        answer_formula: rawTemplate.answer_formula,
        max_points: rawTemplate.max_points ?? 10,
        tag_ids: rawTemplate.tag_ids ?? [],
      }

      const challengeId = await generateChallenge(template, supabase, userId)

      if (challengeId) {
        setGenerateSuccess(`Challenge generated successfully!`)
        // Redirect to the new challenge
        router.push(`/challenges/${challengeId}`)
      } else {
        setError('Failed to generate challenge. Please try again.')
      }
    } catch (err) {
      console.error('Error generating from template:', err)
      setError('An unexpected error occurred during generation.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🎯</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <PageHeader
        breadcrumbs={
          fromBank
            ? [{ label: 'Challenge Bank', href: '/admin/challenge-bank' }, { label: 'New Challenge' }]
            : [{ label: 'Challenges', href: '/challenges' }, { label: 'New Challenge' }]
        }
        maxWidth="max-w-3xl"
      />

      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Generate from Template Section */}
        {generativeTemplates.length > 0 && (
          <Card className="mb-6">
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <span>🎲</span>
                Generate from Template
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <p className="text-sm text-gray-600 mb-4">
                Quickly generate a randomized challenge from one of your generative templates.
              </p>

              {generateSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-2xl mb-4">
                  <p className="text-sm text-green-700">{generateSuccess}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Template
                  </label>
                  <select
                    value={selectedTemplateId || ''}
                    onChange={(e) => setSelectedTemplateId(e.target.value || null)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl 
                             focus:border-primary-500 focus:ring-2 focus:ring-primary-200
                             transition-colors bg-white"
                  >
                    <option value="">Choose a template...</option>
                    {generativeTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title_template} ({Object.keys(t.variables || {}).length} variables)
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="button"
                  onClick={handleGenerateFromTemplate}
                  disabled={!selectedTemplateId || generating}
                  isLoading={generating}
                  size="lg"
                  className="w-full"
                >
                  <span className="mr-2">🎲</span>
                  Generate Challenge
                </Button>
              </div>
            </Card.Body>
          </Card>
        )}

        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <span>✨</span>
              New Challenge
            </Card.Title>
          </Card.Header>
          <Card.Body>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <p className="text-sm text-red-600">{error}</p>
                </div>

              )}

              <FormField
                label="Title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Solve for x: Linear Equation"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the challenge... Include the problem and any instructions."
                  className="w-full h-48 p-4 border-2 border-gray-200 rounded-2xl 
                           focus:border-primary-500 focus:ring-2 focus:ring-primary-200
                           resize-none transition-colors"
                  required
                />
                <p className="mt-2 text-sm text-gray-500">
                  Tip: Use line breaks to format your problem clearly
                </p>
              </div>

              {/* Henry Problem file import */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Henry Problem File (Optional)
                </label>

                {henryProblem ? (
                  <div className="rounded-2xl border-2 border-green-200 bg-green-50/60 p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-green-900 flex items-center gap-2">
                          <span>📄</span>
                          <span className="truncate">{henryFileName}</span>
                        </p>
                        <p className="text-xs text-green-700 mt-0.5">
                          Title, score, tags and both languages were read straight from the file — no AI parsing needed.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={removeHenryProblem}
                        className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg
                                   bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        Remove
                      </button>
                    </div>

                    <HenryProblemSheet
                      problem={henryProblem.problem}
                      graphUrl={imagePreview}
                    />
                    <p className="mt-2 text-xs text-green-700">
                      This is how students will see the problem. Edits to the fields below won&apos;t change this sheet.
                    </p>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full py-8
                                    border-2 border-dashed border-green-300 rounded-2xl
                                    hover:border-green-500 hover:bg-green-50/50
                                    cursor-pointer transition-all">
                    <span className="text-4xl mb-2">📄</span>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">
                        {henryLoading ? 'Reading file...' : 'Click to upload a .henryproblem file'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Fills the form instantly — no image parsing, no API call
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      accept={HENRY_PROBLEM_EXTENSION}
                      disabled={henryLoading}
                      onChange={handleHenryProblemChange}
                    />
                  </label>
                )}

                {henryError && (
                  <p className="mt-2 text-sm text-red-600">{henryError}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image (Optional)
                </label>
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Challenge preview"
                      className="w-full h-64 object-contain bg-gray-50 rounded-2xl border-2 border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full 
                               hover:bg-red-600 transition-colors shadow-lg"
                    >
                      🗑️
                    </button>
                    {/* Parse button — only shown when image is selected */}
                    <button
                      type="button"
                      disabled={parsing}
                      onClick={async () => {
                        if (!imageFile) return
                        setParsing(true)
                        setParseError(null)
                        try {
                          const arrayBuffer = await imageFile.arrayBuffer()
                          const base64 = Buffer.from(arrayBuffer).toString('base64')
                          // Build a flat list of tag names to send to the API for matching
                          const tagList = availableTags.map((t: any) => {
                            const localName = t._names?.find((n: any) => n.language === tagLang)?.name
                              || t._names?.find((n: any) => n.language === 'en')?.name
                              || t._names?.[0]?.name
                            return { id: t.id, name: localName || t.id.slice(0, 8) }
                          })
                          const res = await fetch('/api/parse-challenge-image', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ imageBase64: base64, mimeType: imageFile.type, availableTags: tagList }),
                          })
                          const data = await res.json()
                          if (!res.ok) { setParseError(data.error || 'Failed to parse'); return }
                          if (data.title) setTitle(data.title)
                          if (data.description) setDescription(data.description)
                          if (data.maxPoints) setMaxPoints(data.maxPoints)
                          if (data.hint) setDescription(prev => prev + (prev ? '\n\n[Hint: ' + data.hint + ']' : '[Hint: ' + data.hint + ']'))
                          // Match suggested tag names back to IDs and auto-select them.
                          // Process suggested tags: match existing ones by name, store new ones as pending
                          if (data.suggestedTagNames?.length > 0) {
                            const pendingNames: string[] = []
                            const matchedIds: string[] = []

                            for (const suggestedName of data.suggestedTagNames as string[]) {
                              const cleanName = String(suggestedName).replace(/^NEW:/i, '').trim()
                              if (!cleanName) continue

                              const existing = tagList.find((t: any) =>
                                t.name.toLowerCase() === cleanName.toLowerCase()
                              )
                              if (existing) {
                                matchedIds.push(existing.id)
                              } else {
                                pendingNames.push(cleanName)
                              }
                            }

                            if (matchedIds.length > 0) {
                              setTags(prev => [...new Set([...prev, ...matchedIds])])
                            }
                            // Store new tag names to be created when the challenge is saved
                            if (pendingNames.length > 0) {
                              setPendingNewTags(pendingNames)
                            }
                          }
                        } catch { setParseError('Something went wrong') }
                        finally { setParsing(false) }
                      }}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                                 font-semibold text-sm transition-all
                                 bg-purple-600 text-white hover:bg-purple-700 active:scale-95
                                 disabled:bg-purple-300 disabled:cursor-not-allowed"
                    >
                      {parsing ? '🔍 Reading image...' : '🪄 Fill form from this image'}
                    </button>
                    {parseError && (
                      <p className="mt-2 text-sm text-red-600">{parseError}</p>
                    )}
                    {/* Pending new tag confirmation */}
                    {pendingNewTags.length > 0 && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs font-semibold text-amber-800 mb-2">
                          GPT suggests creating {pendingNewTags.length} new tag{pendingNewTags.length > 1 ? 's' : ''}:
                        </p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {pendingNewTags.map(name => (
                            <div key={name} className="flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-1 rounded-full">
                              <span>{name}</span>
                              <button
                                type="button"
                                onClick={() => setPendingNewTags(prev => prev.filter(t => t !== name))}
                                className="ml-0.5 text-amber-500 hover:text-amber-900"
                                title="Dismiss this tag"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={creatingTags}
                            onClick={async () => {
                              setCreatingTags(true)
                              try {
                                const { data: { user } } = await supabase.auth.getUser()
                                for (const tagName of pendingNewTags) {
                                  const slug = tagName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                                  const { data: newTag } = await supabase
                                    .from('challenge_tags')
                                    .insert({ name: slug, created_by: user?.id })
                                    .select('id')
                                    .single()
                                  if (newTag?.id) {
                                    await supabase.from('challenge_tag_names').insert({ tag_id: newTag.id, language: 'en', name: tagName })
                                    setAvailableTags(prev => [...prev, { id: newTag.id, name: tagName, _names: [{ language: 'en', name: tagName }] } as any])
                                    setTags(prev => [...new Set([...prev, newTag.id])])
                                  }
                                }
                                setPendingNewTags([])
                              } finally {
                                setCreatingTags(false)
                              }
                            }}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                          >
                            {creatingTags ? 'Creating...' : `Create ${pendingNewTags.length > 1 ? 'all' : 'it'}`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingNewTags([])}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          >
                            Dismiss all
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-64 
                                  border-2 border-dashed border-gray-300 rounded-2xl 
                                  hover:border-primary-500 hover:bg-primary-50/50 
                                  cursor-pointer transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <span className="text-5xl mb-3">📸</span>
                      <p className="mb-2 text-sm text-gray-600">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                      <p className="text-xs text-purple-600 font-medium mt-2">🪄 Upload your notes to auto-fill the form</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </label>
                )}
                <p className="mt-2 text-sm text-gray-500">
                  Upload your challenge notes or diagram — once uploaded, click <span className="text-purple-600 font-medium">🪄 Fill form from this image</span> to auto-fill the title, description, and points
                </p>
              </div>

              <FormField
                label="Date"
                type="date"
                value={challengeDate}
                onChange={(e) => setChallengeDate(e.target.value)}
                required={!saveToPool}
              />

              {/* Save to Pool toggle */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-200">
                <input
                  type="checkbox"
                  id="saveToPool"
                  checked={saveToPool}
                  onChange={(e) => {
                    setSaveToPool(e.target.checked)
                    if (e.target.checked) setChallengeDate('')
                  }}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="saveToPool" className="flex-1 cursor-pointer">
                  <span className="font-medium text-blue-900">Save to Challenge Bank</span>
                  <p className="text-sm text-blue-700 mt-0.5">
                    No date needed — store this challenge in your bank and publish it later
                  </p>
                </label>
                <span className="text-2xl">🏦</span>
              </div>

              <FormField
                label="Max Points"
                type="number"
                value={maxPoints.toString()}
                onChange={(e) => setMaxPoints(parseInt(e.target.value) || 100)}
                helperText="Total points this challenge is worth (default: 100)"
              />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Tags (Optional)</label>
                </div>
                <TagInput
                  selectedTagIds={tags}
                  onChange={setTags}
                  availableTags={availableTags.map((t: any) => {
                    const localName = t._names?.find((n: any) => n.language === tagLang)?.name
                    const allNames = t._names?.map((n: any) => n.name) || []
                    return { id: t.id, name: localName || t.id.slice(0, 8), _allNames: allNames }
                  })}
                  placeholder="Search by name..."
                  tagGroups={tagGroups.map(g => {
                    const name = allTagGroupData.find((gd: any) => gd.id === g.id)?.tag_group_names?.find((n: any) => n.language === tagLang)?.name || g.name
                    return { ...g, name }
                  })}
                />
                {/* Pending new tags — will be created when challenge is saved */}
                {pendingNewTags.length > 0 && (
                  <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs text-amber-700 font-medium mb-1.5">
                      New tags (will be created on save):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {pendingNewTags.map(name => (
                        <span key={name} className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
                          {name}
                          <button
                            type="button"
                            onClick={() => setPendingNewTags(prev => prev.filter(t => t !== name))}
                            className="text-amber-500 hover:text-amber-900 leading-none"
                          >×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Assign to Classes
                  </label>
                  {classes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => router.push('/classes/new')}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      + Create New Class
                    </button>
                  )}
                </div>
                {classes.length > 0 ? (
                  <div className="space-y-2">
                    {classes.map(cls => (
                      <label
                        key={cls.id}
                        className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl 
                                 hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedClasses.includes(cls.id)}
                          onChange={() => toggleClass(cls.id)}
                          className="w-5 h-5 text-primary-600 rounded 
                                   focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-2xl">📚</span>
                        <span className="font-medium text-gray-900">{cls.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl text-center border-2 border-dashed border-gray-300">
                    <div className="text-6xl mb-4">📚</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No Classes Yet
                    </h3>
                    <p className="text-gray-600 mb-6 max-w-sm mx-auto">
                      You need to create a class before you can assign challenges to students.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button
                        type="button"
                        onClick={() => router.push('/classes/new')}
                        size="lg"
                      >
                        <span className="mr-2">✨</span>
                        Create Your First Class
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push('/classes')}
                        size="lg"
                      >
                        View All Classes
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Individual Student Assignment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Assign to Individual Students (Optional)
                </label>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={e => { setStudentSearch(e.target.value); loadStudentsIfNeeded() }}
                  onFocus={() => loadStudentsIfNeeded()}
                  placeholder="Search students by name..."
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl 
                           focus:border-primary-500 focus:ring-2 focus:ring-primary-100
                           transition-all mb-2"
                />
                {/* Selected students */}
                {selectedStudents.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedStudents.map(sid => {
                      const student = allStudents.find(s => s.id === sid)
                      return (
                        <span key={sid} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          {student?.name || 'Unknown'}
                          <button type="button" onClick={() => setSelectedStudents(prev => prev.filter(id => id !== sid))} className="ml-1 text-blue-400 hover:text-blue-800">×</button>
                        </span>
                      )
                    })}
                  </div>
                )}
                {/* Student list */}
                {allStudents.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border-2 border-gray-200 rounded-xl">
                    {allStudents
                      .filter(s => !selectedStudents.includes(s.id))
                      .filter(s => !studentSearch.trim() || s.name.toLowerCase().includes(studentSearch.toLowerCase()))
                      .slice(0, 20)
                      .map(student => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => setSelectedStudents(prev => [...prev, student.id])}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                        >
                          {student.name}
                        </button>
                      ))}
                    {allStudents.filter(s => !selectedStudents.includes(s.id)).filter(s => !studentSearch.trim() || s.name.toLowerCase().includes(studentSearch.toLowerCase())).length === 0 && (
                      <p className="px-4 py-3 text-sm text-gray-500 text-center">No students found</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={submitting}
                  isLoading={submitting}
                  size="lg"
                  className="flex-1"
                >
                  {saveToPool ? '🏦 Save to Bank' : 'Create Challenge'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(fromBank ? '/admin/challenge-bank' : '/dashboard')}
                  size="lg"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card.Body>
        </Card>
      </main>
    </div>
  )
}
