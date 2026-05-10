'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface TagName {
  language: string
  name: string
}

interface Tag {
  id: string
  slug: string
  names: TagName[]
}

export default function TagManagementPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [newSlug, setNewSlug] = useState('')
  const [newNameEn, setNewNameEn] = useState('')
  const [newNameZh, setNewNameZh] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editNameEn, setEditNameEn] = useState('')
  const [editNameZh, setEditNameZh] = useState('')
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

    const { data: tagsData } = await supabase
      .from('challenge_tags')
      .select('id, slug, challenge_tag_names(language, name)')
      .order('slug')

    const formatted = (tagsData || []).map((t: any) => ({
      id: t.id,
      slug: t.slug,
      names: t.challenge_tag_names || []
    }))

    setTags(formatted)
    setLoading(false)
  }

  async function addTag() {
    const slug = newSlug.trim().toLowerCase().replace(/\s+/g, '-')
    if (!slug) { setError('Slug is required'); return }
    if (!newNameEn.trim() && !newNameZh.trim()) { setError('At least one name is required'); return }
    if (tags.some(t => t.slug === slug)) { setError('Tag slug already exists'); return }

    setAdding(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    // Create tag
    const { data: tag, error: tagError } = await supabase
      .from('challenge_tags')
      .insert({ slug, created_by: user?.id })
      .select()
      .single()

    if (tagError) { setError(tagError.message); setAdding(false); return }

    // Insert names
    const names: { tag_id: string; language: string; name: string }[] = []
    if (newNameEn.trim()) names.push({ tag_id: tag.id, language: 'en', name: newNameEn.trim() })
    if (newNameZh.trim()) names.push({ tag_id: tag.id, language: 'zh', name: newNameZh.trim() })

    if (names.length > 0) {
      await supabase.from('challenge_tag_names').insert(names)
    }

    setNewSlug('')
    setNewNameEn('')
    setNewNameZh('')
    setAdding(false)
    await loadTags()
  }

  async function deleteTag(id: string) {
    if (!confirm('Delete this tag and all its translations?')) return
    await supabase.from('challenge_tags').delete().eq('id', id)
    setTags(prev => prev.filter(t => t.id !== id))
  }

  async function startEdit(tag: Tag) {
    setEditingTag(tag.id)
    setEditNameEn(tag.names.find(n => n.language === 'en')?.name || '')
    setEditNameZh(tag.names.find(n => n.language === 'zh')?.name || '')
  }

  async function saveEdit(tagId: string) {
    // Delete existing names and re-insert
    await supabase.from('challenge_tag_names').delete().eq('tag_id', tagId)

    const names: { tag_id: string; language: string; name: string }[] = []
    if (editNameEn.trim()) names.push({ tag_id: tagId, language: 'en', name: editNameEn.trim() })
    if (editNameZh.trim()) names.push({ tag_id: tagId, language: 'zh', name: editNameZh.trim() })

    if (names.length > 0) {
      await supabase.from('challenge_tag_names').insert(names)
    }

    setEditingTag(null)
    await loadTags()
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
        {/* Create new tag */}
        <Card className="mb-6">
          <Card.Header>
            <Card.Title>Create New Tag</Card.Title>
            <p className="text-sm text-gray-600 mt-1">
              Each tag has a unique slug and display names in different languages.
            </p>
          </Card.Header>
          <Card.Body>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (internal ID)</label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={e => setNewSlug(e.target.value)}
                  placeholder="e.g. algebra, geometry, grade-3"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">English Name</label>
                  <input
                    type="text"
                    value={newNameEn}
                    onChange={e => setNewNameEn(e.target.value)}
                    placeholder="e.g. Algebra"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">中文名称</label>
                  <input
                    type="text"
                    value={newNameZh}
                    onChange={e => setNewNameZh(e.target.value)}
                    placeholder="例如：代数"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  />
                </div>
              </div>
              <Button onClick={addTag} disabled={!newSlug.trim() || adding} isLoading={adding}>
                + Create Tag
              </Button>
            </div>
          </Card.Body>
        </Card>

        {/* Tag list */}
        <Card>
          <Card.Header>
            <Card.Title>All Tags ({tags.length})</Card.Title>
          </Card.Header>
          <Card.Body>
            {tags.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No tags yet. Create your first one above.</p>
            ) : (
              <div className="space-y-3">
                {tags.map(tag => (
                  <div key={tag.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    {editingTag === tag.id ? (
                      <div className="space-y-2">
                        <p className="text-sm font-mono text-gray-500">slug: {tag.slug}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editNameEn}
                            onChange={e => setEditNameEn(e.target.value)}
                            placeholder="English name"
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <input
                            type="text"
                            value={editNameZh}
                            onChange={e => setEditNameZh(e.target.value)}
                            placeholder="中文名称"
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(tag.id)}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingTag(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-mono text-gray-400 mr-3">{tag.slug}</span>
                          {tag.names.map(n => (
                            <span key={n.language} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded-full text-sm mr-2">
                              <span className="text-xs text-gray-400">{n.language}:</span> {n.name}
                            </span>
                          ))}
                          {tag.names.length === 0 && <span className="text-sm text-gray-400 italic">No names set</span>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => startEdit(tag)} className="text-sm text-primary-600 hover:text-primary-800">Edit</button>
                          <button onClick={() => deleteTag(tag.id)} className="text-sm text-red-500 hover:text-red-700">Delete</button>
                        </div>
                      </div>
                    )}
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
