'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'

interface Challenge {
  id: string
  title: string
  description: string
  challenge_date: string
  created_by: string
  image_url?: string | null
}

interface Class {
  id: string
  name: string
}

export default function EditChallengePage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [challengeDate, setChallengeDate] = useState('')
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [submissionCount, setSubmissionCount] = useState(0)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    loadData()
  }, [params.id])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    setUserId(user.id)

    // Check if user is teacher
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .is('class_id', null)

    if (roles && roles.length > 0) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .in('id', roles.map((r: any) => r.role_id))

      const hasTeacherRole = roleData?.some((r: any) => r.name === 'teacher')
      
      if (!hasTeacherRole) {
        router.push('/dashboard')
        return
      }
    } else {
      router.push('/dashboard')
      return
    }

    // Load challenge
    const { data: challengeData } = await supabase
      .from('daily_challenges')
      .select('*')
      .eq('id', params.id)
      .single()

    if (!challengeData) {
      router.push('/challenges')
      return
    }

    setChallenge(challengeData)
    setTitle(challengeData.title)
    setDescription(challengeData.description)
    setChallengeDate(challengeData.challenge_date)
    setCurrentImageUrl(challengeData.image_url || null)

    // Load submission count
    const { count } = await supabase
      .from('challenge_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('challenge_id', params.id)

    setSubmissionCount(count || 0)

    // Load current class assignments
    const { data: assignments } = await supabase
      .from('challenge_assignments')
      .select('class_id')
      .eq('challenge_id', params.id)

    setSelectedClasses(assignments?.map(a => a.class_id) || [])

    // Load all classes
    const { data: classesData } = await supabase
      .from('classes')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    setClasses(classesData || [])
    setLoading(false)
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
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB')
        return
      }

      setImageFile(file)
      
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

  async function uploadImage(): Promise<string | null> {
    if (!imageFile || !userId) return null

    setUploadingImage(true)
    try {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${userId}/${params.id}.${fileExt}`
      
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

  async function deleteImage() {
    if (!currentImageUrl || !userId) return

    try {
      const fileName = `${userId}/${params.id}`
      await supabase.storage
        .from('challenge-images')
        .remove([fileName])
      
      await supabase
        .from('daily_challenges')
        .update({ image_url: null })
        .eq('id', params.id)
      
      setCurrentImageUrl(null)
    } catch (err) {
      console.error('Error deleting image:', err)
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

    if (selectedClasses.length === 0) {
      setError('Please select at least one class')
      return
    }

    if (!userId) return

    setSubmitting(true)

    try {
      // Upload new image if provided
      let imageUrl = currentImageUrl
      if (imageFile) {
        const uploadedUrl = await uploadImage()
        if (uploadedUrl) {
          imageUrl = uploadedUrl
        }
      }

      // Update challenge
      const { error: updateError } = await supabase
        .from('daily_challenges')
        .update({
          title: title.trim(),
          description: description.trim(),
          challenge_date: challengeDate,
          image_url: imageUrl
        })
        .eq('id', params.id)

      if (updateError) {
        setError(updateError.message)
        setSubmitting(false)
        return
      }

      // Update class assignments
      // First, delete existing assignments
      await supabase
        .from('challenge_assignments')
        .delete()
        .eq('challenge_id', params.id)

      // Then, insert new assignments
      const assignments = selectedClasses.map(classId => ({
        challenge_id: params.id,
        class_id: classId,
        assigned_by: userId
      }))

      const { error: assignError } = await supabase
        .from('challenge_assignments')
        .insert(assignments)

      if (assignError) {
        setError(`Challenge updated but assignment failed: ${assignError.message}`)
        setSubmitting(false)
        return
      }

      // Success! Redirect to challenge detail
      router.push(`/challenges/${params.id}`)
    } catch (err) {
      console.error('Error updating challenge:', err)
      setError('An unexpected error occurred')
      setSubmitting(false)
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

  if (!challenge) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <Card>
          <Card.Body className="text-center py-8">
            <div className="text-5xl mb-3">❌</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Challenge Not Found
            </h3>
            <Button onClick={() => router.push('/challenges')}>
              Back to Challenges
            </Button>
          </Card.Body>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push(`/challenges/${params.id}`)}
            >
              ← Back
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-3xl">✏️</span>
              <h1 className="text-2xl font-bold text-gray-900">Edit Challenge</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Warning if has submissions */}
        {submissionCount > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-2xl">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">
                  This challenge has {submissionCount} submission{submissionCount !== 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-yellow-800">
                  Editing this challenge won't affect existing submissions, but students will see the updated content.
                </p>
              </div>
            </div>
          </div>
        )}

        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <span>✨</span>
              Edit Challenge Details
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
                label="Challenge Title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Solve for x: Linear Equation"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Challenge Description
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Challenge Image (Optional)
                </label>
                {imagePreview || currentImageUrl ? (
                  <div className="relative">
                    <img
                      src={imagePreview || currentImageUrl || ''}
                      alt="Challenge preview"
                      className="w-full h-64 object-contain bg-gray-50 rounded-2xl border-2 border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (imagePreview) {
                          removeImage()
                        } else if (currentImageUrl) {
                          deleteImage()
                        }
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full 
                               hover:bg-red-600 transition-colors shadow-lg"
                    >
                      🗑️
                    </button>
                    {!imagePreview && currentImageUrl && (
                      <label className="absolute bottom-2 right-2 bg-primary-500 text-white px-4 py-2 rounded-full 
                                     hover:bg-primary-600 transition-colors shadow-lg cursor-pointer">
                        Change Image
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleImageChange}
                        />
                      </label>
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
                  Add a diagram, graph, or visual aid to help students understand the problem
                </p>
              </div>

              <FormField
                label="Challenge Date"
                type="date"
                value={challengeDate}
                onChange={(e) => setChallengeDate(e.target.value)}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Assign to Classes
                </label>
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
                  <div className="p-8 bg-gray-50 rounded-2xl text-center">
                    <div className="text-5xl mb-3">📚</div>
                    <p className="text-gray-600">No classes available</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={submitting}
                  isLoading={submitting}
                  fullWidth
                  size="lg"
                >
                  <span className="mr-2">💾</span>
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/challenges/${params.id}`)}
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
