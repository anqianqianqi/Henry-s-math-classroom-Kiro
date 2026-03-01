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

  useEffect(() => {
    loadData()
  }, [])

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

    // Load classes created by this teacher
    const { data: classesData } = await supabase
      .from('classes')
      .select('id, name')
      .eq('created_by', user.id)
      .eq('is_active', true)
      .order('name')

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

      if (challengeError) {
        setError(challengeError.message)
        setSubmitting(false)
        return
      }

      // Assign to selected classes
      const assignments = selectedClasses.map(classId => ({
        challenge_id: challenge.id,
        class_id: classId,
        assigned_by: userId
      }))

      const { error: assignError } = await supabase
        .from('challenge_assignments')
        .insert(assignments)

      if (assignError) {
        setError(assignError.message)
        setSubmitting(false)
        return
      }

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
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
            >
              ← Back
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎯</span>
              <h1 className="text-2xl font-bold text-gray-900">Create Daily Challenge</h1>
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
                <p className="mt-2 text-sm text-gray-500">
                  Tip: Use line breaks to format your problem clearly
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
                  <div className="p-6 bg-gray-50 rounded-2xl text-center">
                    <div className="text-4xl mb-3">📚</div>
                    <p className="text-gray-600 mb-4">
                      You need to create a class first
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push('/classes/new')}
                    >
                      Create Class
                    </Button>
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
