'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'

interface Class {
  id: string
  name: string
  created_by: string
}

export default function NewChallengePage() {
  const router = useRouter()
  const supabase = createClient()
  
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

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    console.log('User ID:', user.id)
    setUserId(user.id)

    // Check if user is teacher
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .is('class_id', null)

    console.log('User roles:', roles)

    if (roles && roles.length > 0) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .in('id', roles.map((r: any) => r.role_id))

      console.log('Role data:', roleData)

      const hasTeacherRole = roleData?.some((r: any) => r.name === 'teacher')
      
      if (!hasTeacherRole) {
        router.push('/dashboard')
        return
      }
    } else {
      router.push('/dashboard')
      return
    }

    // Load ALL active classes (simplified query to avoid RLS issues)
    const { data: classesData, error: classesError } = await supabase
      .from('classes')
      .select('id, name, created_by, is_active')
      .eq('is_active', true)
      .order('name')

    console.log('Classes query result:', { classesData, classesError })
    console.log('Number of classes found:', classesData?.length || 0)

    setClasses(classesData || [])
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0]
    setChallengeDate(today)
    
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

    if (selectedClasses.length === 0) {
      setError('Please select at least one class')
      return
    }

    if (!userId) return

    setSubmitting(true)

    try {
      // Create challenge
      const { data: challenge, error: challengeError } = await supabase
        .from('daily_challenges')
        .insert({
          created_by: userId,
          title: title.trim(),
          description: description.trim(),
          challenge_date: challengeDate
        })
        .select()
        .single()

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
          // Update challenge with image URL
          await supabase
            .from('daily_challenges')
            .update({ image_url: imageUrl })
            .eq('id', challenge.id)
        }
      }

      // Assign to selected classes
      const assignments = selectedClasses.map(classId => ({
        challenge_id: challenge.id,
        class_id: classId,
        assigned_by: userId
      }))

      console.log('Attempting to insert assignments:', assignments)

      const { data: assignmentData, error: assignError } = await supabase
        .from('challenge_assignments')
        .insert(assignments)
        .select()

      console.log('Assignment result:', assignmentData)
      console.log('Assignment error:', assignError)

      if (assignError) {
        console.error('Assignment failed:', assignError)
        setError(`Challenge created but assignment failed: ${assignError.message}`)
        setSubmitting(false)
        return
      }

      console.log('Success! Redirecting...')
      // Success! Redirect to challenges
      router.push('/challenges')
    } catch (err) {
      console.error('Error creating challenge:', err)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
              ←
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl">🎯</span>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">New Challenge</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
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
                label="Date"
                type="date"
                value={challengeDate}
                onChange={(e) => setChallengeDate(e.target.value)}
                required
              />

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

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={submitting || classes.length === 0}
                  isLoading={submitting}
                  fullWidth
                  size="lg"
                >
                  <span className="mr-2">🚀</span>
                  Create Challenge
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
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
