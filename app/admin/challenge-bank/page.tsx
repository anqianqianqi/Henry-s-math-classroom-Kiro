'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

type Tab = 'challenges' | 'templates'

interface PoolChallenge {
  id: string
  title: string
  description: string
  tag_ids: string[]
  max_points: number
  created_at: string
}

interface TagInfo {
  id: string
  name: string
}

interface ClassInfo {
  id: string
  name: string
}

interface PublishModal {
  challenge: PoolChallenge
  date: string
  classIds: string[]
}

interface TemplateItem {
  id: string
  title_template: string
  description_template: string
  variables: Record<string, any>
  answer_formula: string
  max_points: number
  tag_ids: string[]
  created_at: string
  challenge_count: number
}

export default function ChallengeBankPage() {
  const router = useRouter()
  const supabase = createClient()

  const [challenges, setChallenges] = useState<PoolChallenge[]>([])
  const [tags, setTags] = useState<TagInfo[]>([])
  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [publishModal, setPublishModal] = useState<PublishModal | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('challenges')
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [templateSearch, setTemplateSearch] = useState('')
  const [deletingTemplate, setDeletingTemplate] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Load pool challenges
    const { data: challengesData } = await supabase
      .from('daily_challenges')
      .select('id, title, description, tag_ids, max_points, created_at')
      .eq('is_pool', true)
      .order('created_at', { ascending: false })

    setChallenges(challengesData || [])

    // Load tags
    const { data: tagsData } = await supabase
      .from('challenge_tags')
      .select('id, challenge_tag_names(language, name)')
      .order('created_at')
    const tagList = (tagsData || []).map((t: any) => {
      const en = t.challenge_tag_names?.find((n: any) => n.language === 'en')?.name
      const zh = t.challenge_tag_names?.find((n: any) => n.language === 'zh')?.name
      return { id: t.id, name: en || zh || t.id.slice(0, 8) }
    })
    setTags(tagList)

    // Load classes
    const { data: classesData } = await supabase
      .from('classes')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    setClasses(classesData || [])

    // Load generative templates
    const { data: templateData } = await supabase
      .from('challenge_templates')
      .select('id, title_template, description_template, variables, answer_formula, max_points, tag_ids, created_at')
      .eq('is_generative', true)
      .order('created_at', { ascending: false })

    if (templateData) {
      const templateIds = templateData.map((t: any) => t.id)
      let challengeCounts: Record<string, number> = {}
      if (templateIds.length > 0) {
        const { data: genChallenges } = await supabase
          .from('daily_challenges')
          .select('template_id')
          .in('template_id', templateIds)
        for (const c of genChallenges || []) {
          if (c.template_id) challengeCounts[c.template_id] = (challengeCounts[c.template_id] || 0) + 1
        }
      }
      setTemplates(templateData.map((t: any) => ({
        ...t,
        variables: t.variables || {},
        tag_ids: t.tag_ids || [],
        challenge_count: challengeCounts[t.id] || 0,
      })))
    }

    setLoading(false)
  }

  function showNotification(message: string, type: 'success' | 'error') {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }

  function openPublish(challenge: PoolChallenge) {
    const today = new Date().toISOString().split('T')[0]
    setPublishModal({ challenge, date: today, classIds: [] })
  }

  async function handlePublish() {
    if (!publishModal) return
    if (!publishModal.date) {
      showNotification('Please select a date', 'error')
      return
    }
    if (publishModal.classIds.length === 0) {
      showNotification('Please select at least one class', 'error')
      return
    }

    setPublishing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Update challenge: set date, remove from pool
      const { error: updateError } = await supabase
        .from('daily_challenges')
        .update({
          challenge_date: publishModal.date,
          is_pool: false,
        })
        .eq('id', publishModal.challenge.id)

      if (updateError) throw updateError

      // Assign to selected classes
      const assignments = publishModal.classIds.map(classId => ({
        challenge_id: publishModal.challenge.id,
        class_id: classId,
        assigned_by: user.id,
      }))

      const { error: assignError } = await supabase
        .from('challenge_assignments')
        .insert(assignments)

      if (assignError) throw assignError

      showNotification(`Published "${publishModal.challenge.title}" for ${publishModal.date}`, 'success')
      setPublishModal(null)
      // Remove from local list
      setChallenges(prev => prev.filter(c => c.id !== publishModal.challenge.id))
    } catch (err: any) {
      showNotification(err.message || 'Failed to publish', 'error')
    } finally {
      setPublishing(false)
    }
  }

  async function handleDelete(challengeId: string) {
    if (!confirm('Delete this challenge from the bank?')) return
    setDeleting(challengeId)
    await supabase.from('daily_challenges').delete().eq('id', challengeId)
    setChallenges(prev => prev.filter(c => c.id !== challengeId))
    setDeleting(null)
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!confirm('Delete this template?')) return
    setDeletingTemplate(templateId)
    await supabase.from('challenge_templates').delete().eq('id', templateId)
    setTemplates(prev => prev.filter(t => t.id !== templateId))
    setDeletingTemplate(null)
  }

  const filteredTemplates = templates.filter(t =>
    !templateSearch.trim() ||
    t.title_template.toLowerCase().includes(templateSearch.toLowerCase())
  )

  const filtered = challenges.filter(c =>
    !search.trim() ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <p className="text-gray-500">Loading challenge bank...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-lg text-white font-medium ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {notification.message}
          <button onClick={() => setNotification(null)} className="ml-3 text-white/80 hover:text-white">×</button>
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button onClick={() => router.push('/dashboard')} variant="ghost" size="sm">←</Button>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">🏦 Challenge Bank</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Create in advance, publish when ready</p>
              </div>
            </div>
            {activeTab === 'challenges' ? (
              <Button onClick={() => router.push('/challenges/new')} size="sm">
                + Write Challenge
              </Button>
            ) : (
              <Button onClick={() => router.push('/admin/generative-templates')} size="sm">
                + Create Template
              </Button>
            )}
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-3 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('challenges')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'challenges'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📝 Challenges ({challenges.length})
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'templates'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🤖 Templates ({templates.length})
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {activeTab === 'challenges' ? (
          <>
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search challenges..."
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
            />

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium text-gray-900">{filtered.length}</span> challenge{filtered.length !== 1 ? 's' : ''} in bank
            </div>

            {filtered.length === 0 ? (
              <Card>
                <Card.Body>
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">📝</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No challenges yet</h3>
                    <p className="text-gray-500 mb-6">Write challenges and save them to the bank for later use.</p>
                    <Button onClick={() => router.push('/challenges/new')}>+ Write Challenge</Button>
                  </div>
                </Card.Body>
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered.map(challenge => (
                  <Card key={challenge.id}>
                    <Card.Body>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-lg">{challenge.title}</h3>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{challenge.description}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="info">{challenge.max_points} pts</Badge>
                            {challenge.tag_ids?.map(tid => {
                              const tag = tags.find(t => t.id === tid)
                              return tag ? (
                                <span key={tid} className="px-2 py-0.5 bg-primary-50 text-primary-600 rounded-full text-xs">
                                  {tag.name}
                                </span>
                              ) : null
                            })}
                            <span className="text-xs text-gray-400">
                              Added {new Date(challenge.created_at + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button size="sm" onClick={() => openPublish(challenge)}>
                            📅 Publish
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => router.push(`/challenges/${challenge.id}/edit`)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleDelete(challenge.id)} disabled={deleting === challenge.id}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Templates tab */}
            <input
              type="text"
              value={templateSearch}
              onChange={e => setTemplateSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
            />

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium text-gray-900">{filteredTemplates.length}</span> template{filteredTemplates.length !== 1 ? 's' : ''}
            </div>

            {filteredTemplates.length === 0 ? (
              <Card>
                <Card.Body>
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">🤖</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates yet</h3>
                    <p className="text-gray-500 mb-6">Create parameterized templates that generate random challenges automatically.</p>
                    <Button onClick={() => router.push('/admin/generative-templates')}>+ Create Template</Button>
                  </div>
                </Card.Body>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredTemplates.map(template => (
                  <Card key={template.id}>
                    <Card.Body>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-lg truncate">{template.title_template}</h3>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="info">{Object.keys(template.variables).length} variable{Object.keys(template.variables).length !== 1 ? 's' : ''}</Badge>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              {template.challenge_count} generated
                            </span>
                            <Badge variant="success">{template.max_points} pts</Badge>
                            {template.tag_ids?.map(tid => {
                              const tag = tags.find(t => t.id === tid)
                              return tag ? (
                                <span key={tid} className="px-2 py-0.5 bg-primary-50 text-primary-600 rounded-full text-xs">
                                  {tag.name}
                                </span>
                              ) : null
                            })}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Formula: <code className="bg-gray-100 px-1 rounded">{template.answer_formula}</code>
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => router.push(`/admin/generative-templates`)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeleteTemplate(template.id)}
                            disabled={deletingTemplate === template.id}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Publish Modal */}
      {publishModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Publish Challenge</h2>
            <p className="text-sm text-gray-600 mb-6">
              <span className="font-medium">{publishModal.challenge.title}</span>
            </p>

            <div className="space-y-4">
              {/* Date picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Challenge Date</label>
                <input
                  type="date"
                  value={publishModal.date}
                  onChange={e => setPublishModal(prev => prev ? { ...prev, date: e.target.value } : null)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                />
              </div>

              {/* Class selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Classes</label>
                {classes.length === 0 ? (
                  <p className="text-sm text-gray-400">No classes available</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {classes.map(cls => (
                      <label key={cls.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={publishModal.classIds.includes(cls.id)}
                          onChange={e => {
                            setPublishModal(prev => {
                              if (!prev) return null
                              const classIds = e.target.checked
                                ? [...prev.classIds, cls.id]
                                : prev.classIds.filter(id => id !== cls.id)
                              return { ...prev, classIds }
                            })
                          }}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        <span className="text-sm font-medium text-gray-900">{cls.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={handlePublish}
                disabled={publishing}
                isLoading={publishing}
                className="flex-1"
              >
                Publish
              </Button>
              <Button
                variant="outline"
                onClick={() => setPublishModal(null)}
                disabled={publishing}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
