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
  names: TagName[]
}

interface TagGroup {
  id: string
  tag_ids: string[]
  names: TagName[]
}

export default function TagManagementPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [newNameEn, setNewNameEn] = useState('')
  const [newNameZh, setNewNameZh] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editNameEn, setEditNameEn] = useState('')
  const [editNameZh, setEditNameZh] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  // Tag Groups
  const [groups, setGroups] = useState<TagGroup[]>([])
  const [newGroupNameEn, setNewGroupNameEn] = useState('')
  const [newGroupNameZh, setNewGroupNameZh] = useState('')
  const [newGroupTagIds, setNewGroupTagIds] = useState<string[]>([])
  const [addingGroup, setAddingGroup] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editGroupNameEn, setEditGroupNameEn] = useState('')
  const [editGroupNameZh, setEditGroupNameZh] = useState('')
  const [editGroupTagIds, setEditGroupTagIds] = useState<string[]>([])
  const [groupSearch, setGroupSearch] = useState('')
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
      .select('id, challenge_tag_names(language, name)')
      .order('created_at')

    const formatted = (tagsData || []).map((t: any) => ({
      id: t.id,
      names: t.challenge_tag_names || []
    }))

    setTags(formatted)
    
    // Load tag groups with their members
    const { data: groupsData } = await supabase
      .from('tag_groups')
      .select('id, tag_group_names(language, name), tag_group_members(tag_id)')
      .order('created_at')

    const formattedGroups = (groupsData || []).map((g: any) => ({
      id: g.id,
      tag_ids: (g.tag_group_members || []).map((m: any) => m.tag_id),
      names: g.tag_group_names || []
    }))
    setGroups(formattedGroups)

    setLoading(false)
  }

  async function addTag() {
    if (!newNameEn.trim() && !newNameZh.trim()) { setError('At least one name is required'); return }

    setAdding(true)
    setError('')

    // Auto-generate slug from English name, or Chinese pinyin-ish, or random
    const baseSlug = (newNameEn.trim() || newNameZh.trim() || 'tag')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const slug = `${baseSlug}-${Date.now().toString(36)}`

    const { data: { user } } = await supabase.auth.getUser()

    // Create tag (name column holds the slug/identifier)
    const { data: tag, error: tagError } = await supabase
      .from('challenge_tags')
      .insert({ name: slug, created_by: user?.id })
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

  // Tag Group functions
  async function addGroup() {
    if (!newGroupNameEn.trim() && !newGroupNameZh.trim()) { setError('Group needs at least one name'); return }
    if (newGroupTagIds.length === 0) { setError('Select at least one tag for the group'); return }

    setAddingGroup(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    const { data: group, error: groupError } = await supabase
      .from('tag_groups')
      .insert({ created_by: user?.id })
      .select()
      .single()

    if (groupError) { setError(groupError.message); setAddingGroup(false); return }

    // Insert group members (junction table)
    const members = newGroupTagIds.map(tagId => ({ group_id: group.id, tag_id: tagId }))
    await supabase.from('tag_group_members').insert(members)

    // Insert names
    const names: { group_id: string; language: string; name: string }[] = []
    if (newGroupNameEn.trim()) names.push({ group_id: group.id, language: 'en', name: newGroupNameEn.trim() })
    if (newGroupNameZh.trim()) names.push({ group_id: group.id, language: 'zh', name: newGroupNameZh.trim() })

    if (names.length > 0) {
      await supabase.from('tag_group_names').insert(names)
    }

    setNewGroupNameEn('')
    setNewGroupNameZh('')
    setNewGroupTagIds([])
    setAddingGroup(false)
    await loadTags()
  }

  async function deleteGroup(id: string) {
    if (!confirm('Delete this tag group?')) return
    await supabase.from('tag_groups').delete().eq('id', id)
    setGroups(prev => prev.filter(g => g.id !== id))
  }

  async function startEditGroup(group: TagGroup) {
    setEditingGroup(group.id)
    setEditGroupNameEn(group.names.find(n => n.language === 'en')?.name || '')
    setEditGroupNameZh(group.names.find(n => n.language === 'zh')?.name || '')
    setEditGroupTagIds([...group.tag_ids])
  }

  async function saveEditGroup(groupId: string) {
    // Update members via junction table
    await supabase.from('tag_group_members').delete().eq('group_id', groupId)
    if (editGroupTagIds.length > 0) {
      const members = editGroupTagIds.map(tagId => ({ group_id: groupId, tag_id: tagId }))
      await supabase.from('tag_group_members').insert(members)
    }

    // Update names
    await supabase.from('tag_group_names').delete().eq('group_id', groupId)
    const names: { group_id: string; language: string; name: string }[] = []
    if (editGroupNameEn.trim()) names.push({ group_id: groupId, language: 'en', name: editGroupNameEn.trim() })
    if (editGroupNameZh.trim()) names.push({ group_id: groupId, language: 'zh', name: editGroupNameZh.trim() })
    if (names.length > 0) {
      await supabase.from('tag_group_names').insert(names)
    }

    setEditingGroup(null)
    await loadTags()
  }

  function getTagDisplayName(tagId: string): string {
    const tag = tags.find(t => t.id === tagId)
    if (!tag) return tagId.slice(0, 8)
    return tag.names.find(n => n.language === 'en')?.name || tag.names.find(n => n.language === 'zh')?.name || tagId.slice(0, 8)
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
              Enter the tag name in one or both languages. An internal ID is generated automatically.
            </p>
          </Card.Header>
          <Card.Body>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">English Name</label>
                  <input
                    type="text"
                    value={newNameEn}
                    onChange={e => setNewNameEn(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
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
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                    placeholder="例如：代数"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  />
                </div>
              </div>
              <Button onClick={addTag} disabled={(!newNameEn.trim() && !newNameZh.trim()) || adding} isLoading={adding}>
                + Create Tag
              </Button>
            </div>
          </Card.Body>
        </Card>

        {/* Tag list */}
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between gap-4">
              <Card.Title>All Tags ({tags.length})</Card.Title>
              <input
                type="text"
                placeholder="Search tags..."
                value={tagSearch}
                onChange={e => setTagSearch(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-200 w-48"
              />
            </div>
          </Card.Header>
          <Card.Body>
            {tags.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No tags yet. Create your first one above.</p>
            ) : (
              <div className="space-y-3">
                {tags
                  .filter(tag => {
                    if (!tagSearch.trim()) return true
                    const q = tagSearch.toLowerCase()
                    return tag.names.some(n => n.name.toLowerCase().includes(q))
                  })
                  .map(tag => (
                  <div key={tag.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    {editingTag === tag.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">English</label>
                            <input
                              type="text"
                              value={editNameEn}
                              onChange={e => setEditNameEn(e.target.value)}
                              placeholder="English name"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">中文</label>
                            <input
                              type="text"
                              value={editNameZh}
                              onChange={e => setEditNameZh(e.target.value)}
                              placeholder="中文名称"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(tag.id)}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingTag(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          {tag.names.map(n => (
                            <span key={n.language} className="inline-flex items-center gap-1 px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm">
                              <span className="text-xs font-medium text-gray-400 uppercase">{n.language === 'zh' ? 'CN' : 'EN'}</span>
                              <span className="font-medium">{n.name}</span>
                            </span>
                          ))}
                          {tag.names.length === 0 && <span className="text-sm text-gray-400 italic">No names set</span>}
                        </div>
                        <div className="flex gap-2 shrink-0 ml-3">
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

        {/* Tag Groups */}
        <Card className="mt-6">
          <Card.Header>
            <div className="flex items-center justify-between gap-4">
              <Card.Title>Tag Groups ({groups.length})</Card.Title>
              <input
                type="text"
                placeholder="Search groups..."
                value={groupSearch}
                onChange={e => setGroupSearch(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-200 w-48"
              />
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Group tags into presets. When creating a challenge, apply a group to add all its tags at once.
            </p>
          </Card.Header>
          <Card.Body>
            {/* Create new group - collapsible */}
            {!showCreateGroup ? (
              <div className="mb-4">
                <Button size="sm" variant="outline" onClick={() => setShowCreateGroup(true)}>
                  + Create New Group
                </Button>
              </div>
            ) : (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Create New Group</h4>
                <button onClick={() => setShowCreateGroup(false)} className="text-sm text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">English Name</label>
                  <input
                    type="text"
                    value={newGroupNameEn}
                    onChange={e => setNewGroupNameEn(e.target.value)}
                    placeholder="e.g. Algebra Basics"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">中文名称</label>
                  <input
                    type="text"
                    value={newGroupNameZh}
                    onChange={e => setNewGroupNameZh(e.target.value)}
                    placeholder="例如：代数基础"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">Select Tags for this Group</label>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => {
                    const selected = newGroupTagIds.includes(tag.id)
                    const name = tag.names.find(n => n.language === 'en')?.name || tag.names.find(n => n.language === 'zh')?.name || tag.id.slice(0, 8)
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => setNewGroupTagIds(prev => selected ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selected ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {selected ? '✓ ' : ''}{name}
                      </button>
                    )
                  })}
                </div>
              </div>
              <Button size="sm" onClick={addGroup} disabled={addingGroup} isLoading={addingGroup}>
                + Create Group
              </Button>
            </div>
            )}

            {/* Existing groups */}
            {groups.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No tag groups yet.</p>
            ) : (
              <div className="space-y-3">
                {groups
                  .filter(group => {
                    if (!groupSearch.trim()) return true
                    const q = groupSearch.toLowerCase()
                    const nameMatch = group.names.some(n => n.name.toLowerCase().includes(q))
                    const tagMatch = group.tag_ids.some(tagId => {
                      const tag = tags.find(t => t.id === tagId)
                      return tag?.names.some(n => n.name.toLowerCase().includes(q))
                    })
                    return nameMatch || tagMatch
                  })
                  .map(group => (
                  <div key={group.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    {editingGroup === group.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">English</label>
                            <input type="text" value={editGroupNameEn} onChange={e => setEditGroupNameEn(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">中文</label>
                            <input type="text" value={editGroupNameZh} onChange={e => setEditGroupNameZh(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Tags in Group</label>
                          <div className="flex flex-wrap gap-2">
                            {tags.map(tag => {
                              const selected = editGroupTagIds.includes(tag.id)
                              const name = getTagDisplayName(tag.id)
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => setEditGroupTagIds(prev => selected ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selected ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                  {selected ? '✓ ' : ''}{name}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEditGroup(group.id)}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingGroup(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            {group.names.map(n => (
                              <span key={n.language} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                                <span className="text-xs font-medium text-gray-400 uppercase">{n.language === 'zh' ? 'CN' : 'EN'}</span>
                                <span className="font-medium">{n.name}</span>
                              </span>
                            ))}
                            <span className="text-xs text-gray-400">({group.tag_ids.length} tags)</span>
                          </div>
                          <div className="flex gap-2 shrink-0 ml-3">
                            <button onClick={() => startEditGroup(group)} className="text-sm text-primary-600 hover:text-primary-800">Edit</button>
                            <button onClick={() => deleteGroup(group.id)} className="text-sm text-red-500 hover:text-red-700">Delete</button>
                          </div>
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
