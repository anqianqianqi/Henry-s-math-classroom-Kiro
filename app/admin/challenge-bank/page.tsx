'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { localDateString } from '@/lib/utils/date'

type Tab = 'challenges' | 'templates'

interface PoolChallenge {
  id: string
  title: string
  description: string
  tag_ids: string[]
  max_points: number
  image_url?: string | null
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
  studentIds: string[]
  studentSearch: string
}

interface StudentInfo {
  id: string
  name: string
  lastName: string
  email: string
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
  const [allStudents, setAllStudents] = useState<StudentInfo[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [tagLang, setTagLang] = useState<'en' | 'zh'>('en')
  const [allTagData, setAllTagData] = useState<any[]>([])
  // Map: bank challenge id → list of { date, classNames }
  const [publishHistory, setPublishHistory] = useState<Record<string, Array<{ date: string; classNames: string[]; challengeId: string }>>>({})
  const tagDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => { loadData() }, [])

  // Rebuild tag list when language changes
  useEffect(() => {
    if (allTagData.length === 0) return
    const tagList = allTagData.map((t: any) => {
      const name = t.challenge_tag_names?.find((n: any) => n.language === tagLang)?.name
        || t.challenge_tag_names?.find((n: any) => n.language === 'en')?.name
        || t.challenge_tag_names?.find((n: any) => n.language === 'zh')?.name
        || t.id.slice(0, 8)
      return { id: t.id, name }
    })
    setTags(tagList)
  }, [tagLang, allTagData])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Load bank challenges from challenge_bank table
    const { data: challengesData } = await supabase
      .from('challenge_bank')
      .select('id, title, description, tag_ids, max_points, image_url, created_at')
      .order('created_at', { ascending: false })

    setChallenges(challengesData || [])

    // Load publish history: daily_challenges with source_bank_id + their class assignments
    if (challengesData && challengesData.length > 0) {
      const bankIds = challengesData.map((c: any) => c.id)
      const { data: published } = await supabase
        .from('daily_challenges')
        .select('id, challenge_date, source_bank_id')
        .in('source_bank_id', bankIds)
        .order('challenge_date', { ascending: false })

      const historyMap: Record<string, Array<{ date: string; classNames: string[]; challengeId: string }>> = {}

      if (published && published.length > 0) {
        // Fetch class assignments for these published challenges
        const publishedIds = published.map((p: any) => p.id)
        const { data: assignments } = await supabase
          .from('challenge_assignments')
          .select('challenge_id, class_id, classes(name)')
          .in('challenge_id', publishedIds)

        // Build a map: challenge_id → class names
        const assignmentMap: Record<string, string[]> = {}
        for (const a of assignments || []) {
          if (!assignmentMap[a.challenge_id]) assignmentMap[a.challenge_id] = []
          const name = (a as any).classes?.name
          if (name) assignmentMap[a.challenge_id].push(name)
        }

        for (const p of published) {
          if (!p.source_bank_id) continue
          if (!historyMap[p.source_bank_id]) historyMap[p.source_bank_id] = []
          historyMap[p.source_bank_id].push({
            date: p.challenge_date,
            classNames: assignmentMap[p.id] || [],
            challengeId: p.id,
          })
        }
      }
      setPublishHistory(historyMap)
    }

    // Load tags
    const { data: tagsData } = await supabase
      .from('challenge_tags')
      .select('id, challenge_tag_names(language, name)')
      .order('created_at')
    setAllTagData(tagsData || [])
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

    // Load students (non-teacher profiles)
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, full_name, email')
      .order('full_name')
    const { data: teacherRoles } = await supabase
      .from('user_roles')
      .select('user_id, roles!inner(name)')
      .is('class_id', null)
    const teacherIds = new Set(
      (teacherRoles || [])
        .filter((r: any) => r.roles?.name === 'teacher' || r.roles?.name === 'administrator')
        .map((r: any) => r.user_id)
    )
    const students = (profilesData || [])
      .filter((p: any) => !teacherIds.has(p.id))
      .map((p: any) => ({
        id: p.id,
        name: p.first_name || p.full_name?.split(' ')[0] || 'Unknown',
        lastName: p.last_name || p.full_name?.split(' ').slice(1).join(' ') || '',
        email: p.email || '',
      }))
    setAllStudents(students)

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
    const today = localDateString()
    setPublishModal({ challenge, date: today, classIds: [], studentIds: [], studentSearch: '' })
  }

  async function handlePublish() {
    if (!publishModal) return
    if (!publishModal.date) {
      showNotification('Please select a date', 'error')
      return
    }

    setPublishing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const source = publishModal.challenge

      // Create a NEW challenge instance from the bank item (leave original intact)
      const { data: newChallenge, error: insertError } = await supabase
        .from('daily_challenges')
        .insert({
          title: source.title,
          description: source.description,
          challenge_date: publishModal.date,
          tag_ids: source.tag_ids || [],
          max_points: source.max_points || 100,
          image_url: source.image_url || null,
          created_by: user.id,
          source_bank_id: source.id,
        })
        .select()
        .single()

      if (insertError || !newChallenge) throw insertError || new Error('Failed to create challenge instance')

      // Assign to selected classes
      if (publishModal.classIds.length > 0) {
        const assignments = publishModal.classIds.map(classId => ({
          challenge_id: newChallenge.id,
          class_id: classId,
          assigned_by: user.id,
        }))

        const { error: assignError } = await supabase
          .from('challenge_assignments')
          .insert(assignments)

        if (assignError) throw assignError
      }

      // Assign to individual students
      if (publishModal.studentIds.length > 0) {
        const studentAssignments = publishModal.studentIds.map(studentId => ({
          challenge_id: newChallenge.id,
          student_id: studentId,
          assigned_by: user.id,
        }))

        const { error: studentAssignError } = await supabase
          .from('challenge_student_assignments')
          .insert(studentAssignments)

        if (studentAssignError) throw studentAssignError
      }

      // Bank item stays — just close the modal
      showNotification(`Published "${source.title}" for ${publishModal.date}`, 'success')
      setPublishModal(null)
    } catch (err: any) {
      showNotification(err.message || 'Failed to publish', 'error')
    } finally {
      setPublishing(false)
    }
  }

  async function handleDelete(challengeId: string) {
    if (!confirm('Delete this challenge from the bank?')) return
    setDeleting(challengeId)
    await supabase.from('challenge_bank').delete().eq('id', challengeId)
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
    (!search.trim() ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())) &&
    (selectedTags.length === 0 || selectedTags.every(t => c.tag_ids?.includes(t)))
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
            <div className="flex items-center gap-2">
              <select
                value={tagLang}
                onChange={e => setTagLang(e.target.value as 'en' | 'zh')}
                className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white"
              >
                <option value="en">EN</option>
                <option value="zh">CN</option>
              </select>
            {activeTab === 'challenges' ? (
              <Button onClick={() => router.push('/challenges/new?source=bank')} size="sm">
                + Write Challenge
              </Button>
            ) : (
              <Button onClick={() => router.push('/admin/generative-templates')} size="sm">
                + Create Template
              </Button>
            )}
            </div>
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

            {/* Tag filter */}
            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium text-gray-700 shrink-0">Tags:</label>
                <div className="relative" ref={tagDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setTagDropdownOpen(o => !o)}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-gray-200 rounded-xl bg-white text-sm hover:border-primary-400 transition-colors min-w-[160px]"
                  >
                    <span className="flex-1 text-left">
                      {selectedTags.length === 0
                        ? 'All Tags'
                        : `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''} selected`}
                    </span>
                    <span className="text-gray-400">{tagDropdownOpen ? '▲' : '▼'}</span>
                  </button>
                  {tagDropdownOpen && (
                    <div className="absolute z-20 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
                      {tags.map(tag => (
                        <label
                          key={tag.id}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(tag.id)}
                            onChange={() =>
                              setSelectedTags(prev =>
                                prev.includes(tag.id)
                                  ? prev.filter(t => t !== tag.id)
                                  : [...prev, tag.id]
                              )
                            }
                            className="w-4 h-4 text-primary-600 rounded"
                          />
                          <span className="text-sm text-gray-700">{tag.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {selectedTags.map(tagId => {
                  const tag = tags.find(t => t.id === tagId)
                  return (
                    <span
                      key={tagId}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium"
                    >
                      {tag?.name || tagId.slice(0, 8)}
                      <button
                        onClick={() => setSelectedTags(prev => prev.filter(t => t !== tagId))}
                        className="ml-1 text-primary-500 hover:text-primary-800"
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    className="text-sm text-gray-400 hover:text-gray-600"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}

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
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/challenges/${challenge.id}`)}>
                          <h3 className="font-semibold text-gray-900 text-lg hover:text-primary-600 transition-colors">{challenge.title}</h3>
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
                          {/* Publish history — collapsible */}
                          {publishHistory[challenge.id]?.length > 0 && (
                            <details className="mt-3 pt-3 border-t border-gray-100">
                              <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 list-none flex items-center gap-1">
                                <span>📅 Published {publishHistory[challenge.id].length} time{publishHistory[challenge.id].length !== 1 ? 's' : ''}</span>
                                <span className="text-gray-400 text-xs">▼</span>
                              </summary>
                              <div className="mt-2 space-y-1">
                                {publishHistory[challenge.id].map((h, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                                    <span className="text-gray-400">•</span>
                                    <span className="font-medium">{new Date(h.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    {h.classNames.length > 0 ? (
                                      <span className="text-gray-500">→ {h.classNames.join(', ')}</span>
                                    ) : (
                                      <span className="text-gray-400 italic">no class assigned</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Publish Challenge</h2>
            <p className="text-sm text-gray-600 mb-3">
              <span className="font-medium">{publishModal.challenge.title}</span>
            </p>

            {/* Publish history inside modal */}
            {publishHistory[publishModal.challenge.id]?.length > 0 && (
              <details className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <summary className="text-xs font-semibold text-amber-700 cursor-pointer select-none list-none flex items-center justify-between">
                  <span>📋 Previously published {publishHistory[publishModal.challenge.id].length} time{publishHistory[publishModal.challenge.id].length !== 1 ? 's' : ''}</span>
                  <span className="text-amber-400">▼</span>
                </summary>
                <div className="mt-2 space-y-1.5">
                  {publishHistory[publishModal.challenge.id].map((h, i) => (
                    <div key={i} className="text-xs text-amber-800 flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">•</span>
                      <div>
                        <span className="font-medium">{new Date(h.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        {h.classNames.length > 0 && (
                          <span className="text-amber-600"> → {h.classNames.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

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
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Classes <span className="text-gray-400 font-normal">(Optional)</span></label>
                {classes.length === 0 ? (
                  <p className="text-sm text-gray-400">No classes available</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
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

              {/* Individual student selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Individual Students (Optional)</label>
                <input
                  type="text"
                  value={publishModal.studentSearch}
                  onChange={e => setPublishModal(prev => prev ? { ...prev, studentSearch: e.target.value } : null)}
                  placeholder="Search students..."
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm mb-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
                {publishModal.studentIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {publishModal.studentIds.map(sid => {
                      const s = allStudents.find(st => st.id === sid)
                      return (
                        <span key={sid} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {s ? `${s.name}${s.lastName ? ' ' + s.lastName : ''}` : 'Unknown'}
                          <button
                            type="button"
                            onClick={() => setPublishModal(prev => prev ? { ...prev, studentIds: prev.studentIds.filter(id => id !== sid) } : null)}
                            className="ml-0.5 text-blue-400 hover:text-blue-800"
                          >×</button>
                        </span>
                      )
                    })}
                  </div>
                )}
                {allStudents.length > 0 && (
                  <div className="max-h-36 overflow-y-auto border-2 border-gray-200 rounded-xl">
                    {allStudents
                      .filter(s => !publishModal.studentIds.includes(s.id))
                      .filter(s => !publishModal.studentSearch.trim() ||
                        s.name.toLowerCase().includes(publishModal.studentSearch.toLowerCase()) ||
                        s.lastName.toLowerCase().includes(publishModal.studentSearch.toLowerCase()) ||
                        s.email.toLowerCase().includes(publishModal.studentSearch.toLowerCase())
                      )
                      .slice(0, 20)
                      .map(student => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => setPublishModal(prev => prev ? { ...prev, studentIds: [...prev.studentIds, student.id] } : null)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                        >
                          <span className="font-medium text-gray-800">{student.name}{student.lastName ? ' ' + student.lastName : ''}</span>
                          {student.email && <span className="ml-2 text-xs text-gray-400">{student.email}</span>}
                        </button>
                      ))
                    }
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
