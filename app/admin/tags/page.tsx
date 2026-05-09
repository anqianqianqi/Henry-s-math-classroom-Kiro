'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface Tag {
  id: string
  name: string
  created_at: string
}

export default function TagManagementPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [newTag, setNewTag] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadTags()
  }, [])

  async function loadTags() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Verify teacher
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
      const isTeacher = roleData?.some((r: any) => r.name === 'teacher' || r.name === 'administrator')
      if (!isTeacher) { router.push('/dashboard'); return }
    } else {
      router.push('/dashboard'); return
    }

    const { data } = await supabase
      .from('challenge_tags')
      .select('*')
      .order('name')

    setTags(data || [])
    setLoading(false)
  }

  async function addTag() {
    const name = newTag.trim().toLowerCase().replace(/\s+/g, '-')
    if (!name) return
    if (tags.some(t => t.name === name)) {
      setError('Tag already exists')
      return
    }

    setAdding(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data, error: insertError } = await supabase
      .from('challenge_tags')
      .insert({ name, created_by: user?.id })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
    } else if (data) {
      setTags(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewTag('')
    }
    setAdding(false)
  }

  async function deleteTag(id: string) {
    if (!confirm('Delete this tag? It will be removed from the suggestions list but won\'t affect challenges that already use it.')) return

    const { error } = await supabase
      .from('challenge_tags')
      .delete()
      .eq('id', id)

    if (!error) {
      setTags(prev => prev.filter(t => t.id !== id))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <p className="text-gray-500">Loading tags...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button onClick={() => router.push('/dashboard')} variant="ghost" size="sm">
              ←
            </Button>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Manage Tags</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <Card.Header>
            <Card.Title>Challenge Tags ({tags.length})</Card.Title>
            <p className="text-sm text-gray-600 mt-1">
              Create tags here. They&apos;ll appear as suggestions when creating or editing challenges.
            </p>
          </Card.Header>
          <Card.Body>
            {/* Add new tag */}
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Type a new tag name..."
                className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
              />
              <Button onClick={addTag} disabled={!newTag.trim() || adding} isLoading={adding}>
                + Create Tag
              </Button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Tag list */}
            {tags.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No tags yet. Create your first one above.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <div
                    key={tag.id}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 border border-primary-200 rounded-full"
                  >
                    <span className="text-sm font-medium text-primary-700">#{tag.name}</span>
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="text-primary-400 hover:text-red-600 transition-colors"
                      aria-label={`Delete ${tag.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>
      </main>
    </div>
  )
}
