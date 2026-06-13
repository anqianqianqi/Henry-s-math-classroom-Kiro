'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import TagInput, { TagOption } from '@/components/TagInput'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  previewChallenge,
  generateChallenge,
  GenerativeTemplate,
  Variable,
  GeneratedChallenge,
} from '@/lib/challenge-generator'
import { validateGenerativeTemplate } from '@/lib/template-validation'

// --- Types ---

interface TemplateListItem {
  id: string
  title_template: string
  description_template: string
  variables: Record<string, Variable>
  answer_formula: string
  max_points: number
  tag_ids: string[]
  created_at: string
  challenge_count: number
}

interface VariableFormEntry {
  name: string
  type: 'random_int' | 'random_choice' | 'random_float'
  min: string
  max: string
  options: string
  decimals: string
}

type ViewMode = 'list' | 'create' | 'edit'

// --- Notification Component ---

function Notification({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-lg text-white font-medium ${
      type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`}>
      {message}
      <button onClick={onClose} className="ml-3 text-white/80 hover:text-white">×</button>
    </div>
  )
}

// --- Main Page Component ---

export default function GenerativeTemplatesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [templates, setTemplates] = useState<TemplateListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<TemplateListItem | null>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const supabase = createClient()

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const { data: templateData, error } = await supabase
        .from('challenge_templates')
        .select('id, title_template, description_template, variables, answer_formula, max_points, tag_ids, created_at')
        .eq('is_generative', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get challenge counts per template
      const templateIds = templateData?.map(t => t.id) || []
      let challengeCounts: Record<string, number> = {}

      if (templateIds.length > 0) {
        const { data: challenges } = await supabase
          .from('daily_challenges')
          .select('template_id')
          .in('template_id', templateIds)

        if (challenges) {
          for (const c of challenges) {
            if (c.template_id) {
              challengeCounts[c.template_id] = (challengeCounts[c.template_id] || 0) + 1
            }
          }
        }
      }

      const items: TemplateListItem[] = (templateData || []).map(t => ({
        id: t.id,
        title_template: t.title_template || '',
        description_template: t.description_template || '',
        variables: (t.variables as Record<string, Variable>) || {},
        answer_formula: t.answer_formula || '',
        max_points: t.max_points || 10,
        tag_ids: t.tag_ids || [],
        created_at: t.created_at,
        challenge_count: challengeCounts[t.id] || 0,
      }))

      setTemplates(items)
    } catch (err) {
      console.error('Error loading templates:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  function handleCreate() {
    setEditingTemplate(null)
    setViewMode('create')
  }

  function handleEdit(template: TemplateListItem) {
    setEditingTemplate(template)
    setViewMode('edit')
  }

  async function handleDelete(templateId: string) {
    if (!confirm('Are you sure you want to delete this template?')) return

    const { error } = await supabase
      .from('challenge_templates')
      .delete()
      .eq('id', templateId)

    if (error) {
      setNotification({ message: 'Failed to delete template', type: 'error' })
    } else {
      setNotification({ message: 'Template deleted', type: 'success' })
      loadTemplates()
    }
  }

  async function handleGenerate(template: TemplateListItem) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setNotification({ message: 'You must be logged in to generate challenges', type: 'error' })
      return
    }

    const genTemplate: GenerativeTemplate = {
      id: template.id,
      title_template: template.title_template,
      description_template: template.description_template,
      variables: template.variables,
      answer_formula: template.answer_formula,
      max_points: template.max_points,
      tag_ids: template.tag_ids,
    }

    const challengeId = await generateChallenge(genTemplate, supabase, user.id)

    if (challengeId) {
      // Fetch the title of the generated challenge
      const { data: challenge } = await supabase
        .from('daily_challenges')
        .select('title')
        .eq('id', challengeId)
        .single()

      setNotification({
        message: `Challenge generated: ${challenge?.title || challengeId}`,
        type: 'success',
      })
      loadTemplates()
    } else {
      setNotification({ message: 'Failed to generate challenge', type: 'error' })
    }
  }

  function handleFormClose() {
    setViewMode('list')
    setEditingTemplate(null)
    loadTemplates()
  }

  if (loading && viewMode === 'list') {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}

        {viewMode === 'list' && (
          <TemplateListView
            templates={templates}
            onCreate={handleCreate}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onGenerate={handleGenerate}
          />
        )}

        {(viewMode === 'create' || viewMode === 'edit') && (
          <TemplateForm
            template={editingTemplate}
            onClose={handleFormClose}
            onNotify={setNotification}
          />
        )}
      </div>
    </div>
  )
}


// --- List View Component ---

function TemplateListView({
  templates,
  onCreate,
  onEdit,
  onDelete,
  onGenerate,
}: {
  templates: TemplateListItem[]
  onCreate: () => void
  onEdit: (t: TemplateListItem) => void
  onDelete: (id: string) => void
  onGenerate: (t: TemplateListItem) => void
}) {
  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
          >
            ← Back
          </Button>
          <HomeButton />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Generative Templates
            </h1>
            <p className="text-gray-600">
              Create parameterized challenge patterns that produce randomized math problems
            </p>
          </div>
          <Button onClick={onCreate}>+ Create Template</Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card>
          <Card.Body>
            <p className="text-center text-gray-500 py-8">
              No generative templates yet. Click &quot;Create Template&quot; to get started.
            </p>
          </Card.Body>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={onEdit}
              onDelete={onDelete}
              onGenerate={onGenerate}
            />
          ))}
        </div>
      )}
    </>
  )
}


// --- Template Card Component (with expandable generated challenges) ---

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onGenerate,
}: {
  template: TemplateListItem
  onEdit: (t: TemplateListItem) => void
  onDelete: (id: string) => void
  onGenerate: (t: TemplateListItem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [challenges, setChallenges] = useState<Array<{ id: string; title: string; expected_answer: string; challenge_date: string }>>([])
  const [loadingChallenges, setLoadingChallenges] = useState(false)
  const supabase = createClient()

  async function loadGeneratedChallenges() {
    if (challenges.length > 0) {
      setExpanded(!expanded)
      return
    }
    setLoadingChallenges(true)
    setExpanded(true)
    const { data } = await supabase
      .from('daily_challenges')
      .select('id, title, expected_answer, challenge_date')
      .eq('template_id', template.id)
      .order('created_at', { ascending: false })
      .limit(50)

    setChallenges(data || [])
    setLoadingChallenges(false)
  }

  return (
    <Card>
      <Card.Body>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-lg truncate">
              {template.title_template}
            </h3>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="info">
                {Object.keys(template.variables).length} variable{Object.keys(template.variables).length !== 1 ? 's' : ''}
              </Badge>
              <button
                onClick={loadGeneratedChallenges}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors cursor-pointer"
              >
                {template.challenge_count} generated {expanded ? '▲' : '▼'}
              </button>
              <Badge variant="success">
                {template.max_points} pts
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Formula: <code className="bg-gray-100 px-1 rounded">{template.answer_formula}</code>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => onGenerate(template)}>
              Generate
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onEdit(template)}>
              Edit
            </Button>
            <Button size="sm" variant="danger" onClick={() => onDelete(template.id)}>
              Delete
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Generated Challenges</h4>
            {loadingChallenges ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : challenges.length === 0 ? (
              <p className="text-sm text-gray-400">No challenges generated yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {challenges.map(c => (
                  <a
                    key={c.id}
                    href={`/challenges/${c.id}`}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 truncate block hover:text-blue-700">{c.title}</span>
                      <span className="text-xs text-gray-500">{c.challenge_date}</span>
                    </div>
                    <code className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded ml-2 shrink-0">
                      = {c.expected_answer || '?'}
                    </code>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}


// --- Template Form Component (Create/Edit + Preview + Generate) ---

function TemplateForm({
  template,
  onClose,
  onNotify,
}: {
  template: TemplateListItem | null
  onClose: () => void
  onNotify: (n: { message: string; type: 'success' | 'error' }) => void
}) {
  const supabase = createClient()
  const isEditing = !!template

  // Form state
  const [titleTemplate, setTitleTemplate] = useState(template?.title_template || '')
  const [descriptionTemplate, setDescriptionTemplate] = useState(template?.description_template || '')
  const [answerFormula, setAnswerFormula] = useState(template?.answer_formula || '')
  const [maxPoints, setMaxPoints] = useState(template?.max_points?.toString() || '10')
  const [tagIds, setTagIds] = useState<string[]>(template?.tag_ids || [])
  const [variables, setVariables] = useState<VariableFormEntry[]>(
    template ? variablesFromRecord(template.variables) : []
  )
  const [availableTags, setAvailableTags] = useState<TagOption[]>([])
  const [tagGroups, setTagGroups] = useState<Array<{ id: string; name: string; tag_ids: string[] }>>([])
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Preview state
  const [previews, setPreviews] = useState<GeneratedChallenge[]>([])
  const [showPreview, setShowPreview] = useState(false)

  // AI generation state
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    loadTags()
  }, [])

  async function loadTags() {
    // Load tags with multilingual names
    const { data: tagsData } = await supabase
      .from('challenge_tags')
      .select('id, challenge_tag_names(language, name)')
      .order('created_at')

    if (tagsData) {
      setAvailableTags(tagsData.map((t: any) => {
        const name = t.challenge_tag_names?.find((n: any) => n.language === 'en')?.name
          || t.challenge_tag_names?.find((n: any) => n.language === 'zh')?.name
          || t.id.slice(0, 8)
        return { id: t.id, name }
      }))
    }

    // Load tag groups
    const { data: groupsData } = await supabase
      .from('tag_groups')
      .select('id, tag_group_names(language, name), tag_group_members(tag_id)')
      .order('created_at')

    if (groupsData) {
      setTagGroups(groupsData.map((g: any) => {
        const name = g.tag_group_names?.find((n: any) => n.language === 'en')?.name
          || g.tag_group_names?.find((n: any) => n.language === 'zh')?.name
          || g.id.slice(0, 8)
        const tag_ids = g.tag_group_members?.map((m: any) => m.tag_id) || []
        return { id: g.id, name, tag_ids }
      }))
    }
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiError('')

    try {
      const res = await fetch('/api/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      })

      const data = await res.json()

      if (!res.ok) {
        setAiError(data.error || 'Failed to generate template')
        return
      }

      // Fill form fields with AI response
      if (data.titleTemplate) setTitleTemplate(data.titleTemplate)
      if (data.descriptionTemplate) setDescriptionTemplate(data.descriptionTemplate)
      if (data.answerFormula) setAnswerFormula(data.answerFormula)
      if (data.maxPoints) setMaxPoints(String(data.maxPoints))

      // Convert variables object to form entries
      if (data.variables && typeof data.variables === 'object') {
        const entries: VariableFormEntry[] = Object.entries(data.variables).map(([name, v]: [string, any]) => ({
          name,
          type: v.type || 'random_int',
          min: String(v.min ?? '1'),
          max: String(v.max ?? '10'),
          options: v.options?.join(', ') || '',
          decimals: String(v.decimals ?? '1'),
        }))
        setVariables(entries)
      }
    } catch (err: any) {
      setAiError(err.message || 'Network error')
    } finally {
      setAiLoading(false)
    }
  }

  function addVariable() {
    setVariables([
      ...variables,
      { name: '', type: 'random_int', min: '1', max: '10', options: '', decimals: '1' },
    ])
  }

  function removeVariable(index: number) {
    setVariables(variables.filter((_, i) => i !== index))
  }

  function updateVariable(index: number, field: keyof VariableFormEntry, value: string) {
    const updated = [...variables]
    updated[index] = { ...updated[index], [field]: value }
    setVariables(updated)
  }

  function buildVariablesRecord(): Record<string, Variable> {
    const record: Record<string, Variable> = {}
    for (const v of variables) {
      if (!v.name.trim()) continue
      const variable: Variable = { type: v.type }
      if (v.type === 'random_int') {
        variable.min = parseInt(v.min) || 0
        variable.max = parseInt(v.max) || 10
      } else if (v.type === 'random_float') {
        variable.min = parseFloat(v.min) || 0
        variable.max = parseFloat(v.max) || 10
        variable.decimals = parseInt(v.decimals) || 1
      } else if (v.type === 'random_choice') {
        variable.options = v.options.split(',').map(o => o.trim()).filter(Boolean)
      }
      record[v.name.trim()] = variable
    }
    return record
  }

  function handleValidate(): boolean {
    const variablesRecord = buildVariablesRecord()
    const validationErrors = validateGenerativeTemplate({
      is_generative: true,
      title_template: titleTemplate,
      description_template: descriptionTemplate,
      variables: variablesRecord,
      answer_formula: answerFormula,
    })
    setErrors(validationErrors)
    return validationErrors.length === 0
  }

  function handlePreview() {
    if (!handleValidate()) return

    const variablesRecord = buildVariablesRecord()
    const genTemplate: GenerativeTemplate = {
      id: template?.id || 'preview',
      title_template: titleTemplate,
      description_template: descriptionTemplate,
      variables: variablesRecord,
      answer_formula: answerFormula,
      max_points: parseInt(maxPoints) || 10,
      tag_ids: tagIds,
    }

    const samples: GeneratedChallenge[] = []
    for (let i = 0; i < 3; i++) {
      samples.push(previewChallenge(genTemplate))
    }
    setPreviews(samples)
    setShowPreview(true)
  }

  async function handleSave() {
    if (!handleValidate()) return

    setSaving(true)
    try {
      const variablesRecord = buildVariablesRecord()
      const payload = {
        is_generative: true,
        title_template: titleTemplate,
        description_template: descriptionTemplate,
        variables: variablesRecord,
        answer_formula: answerFormula,
        max_points: parseInt(maxPoints) || 10,
        tag_ids: tagIds,
        title: titleTemplate,
        description: descriptionTemplate, // Required NOT NULL column in existing table
      }

      if (isEditing && template) {
        const { error } = await supabase
          .from('challenge_templates')
          .update(payload)
          .eq('id', template.id)

        if (error) throw error
        onNotify({ message: 'Template updated successfully', type: 'success' })
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const { error } = await supabase
          .from('challenge_templates')
          .insert({ ...payload, created_by: user.id })

        if (error) throw error
        onNotify({ message: 'Template created successfully', type: 'success' })
      }

      onClose()
    } catch (err: any) {
      onNotify({ message: err.message || 'Failed to save template', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateNow() {
    if (!handleValidate()) return
    if (!template) {
      onNotify({ message: 'Save the template first before generating', type: 'error' })
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      onNotify({ message: 'You must be logged in', type: 'error' })
      return
    }

    const variablesRecord = buildVariablesRecord()
    const genTemplate: GenerativeTemplate = {
      id: template.id,
      title_template: titleTemplate,
      description_template: descriptionTemplate,
      variables: variablesRecord,
      answer_formula: answerFormula,
      max_points: parseInt(maxPoints) || 10,
      tag_ids: tagIds,
    }

    const challengeId = await generateChallenge(genTemplate, supabase, user.id)

    if (challengeId) {
      const { data: challenge } = await supabase
        .from('daily_challenges')
        .select('title')
        .eq('id', challengeId)
        .single()

      onNotify({
        message: `Challenge generated: ${challenge?.title || challengeId}`,
        type: 'success',
      })
    } else {
      onNotify({ message: 'Failed to generate challenge', type: 'error' })
    }
  }

  return (
    <>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={onClose} className="mb-4">
          ← Back to Templates
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          {isEditing ? 'Edit Template' : 'Create Template'}
        </h1>
        <p className="text-gray-600">
          Define a parameterized challenge pattern with variables
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Panel */}
        <div className="space-y-6">
          {/* AI Generation Section */}
          <Card>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <span>🤖</span> Generate with AI
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <p className="text-sm text-gray-600 mb-3">
                Describe what kind of challenge template you want in plain language.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="e.g. multiplication problems for numbers 1-9, or 分数加法练习"
                  className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
                  onKeyDown={e => { if (e.key === 'Enter') handleAiGenerate() }}
                />
                <Button onClick={handleAiGenerate} isLoading={aiLoading} disabled={!aiPrompt.trim()}>
                  ✨ Generate
                </Button>
              </div>
              {aiError && (
                <p className="text-sm text-red-600 mt-2">{aiError}</p>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Template Definition</Card.Title>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                {/* Title Template */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title Template
                  </label>
                  <input
                    type="text"
                    value={titleTemplate}
                    onChange={e => setTitleTemplate(e.target.value)}
                    placeholder="e.g. 九九乘法: {{a}} × {{b}}"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {'{{variable_name}}'} syntax for placeholders
                  </p>
                </div>

                {/* Description Template */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description Template
                  </label>
                  <textarea
                    value={descriptionTemplate}
                    onChange={e => setDescriptionTemplate(e.target.value)}
                    placeholder="e.g. 計算 {{a}} × {{b}} = ?"
                    rows={3}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors resize-y"
                  />
                </div>

                {/* Answer Formula */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Answer Formula
                  </label>
                  <input
                    type="text"
                    value={answerFormula}
                    onChange={e => setAnswerFormula(e.target.value)}
                    placeholder="e.g. {{a}} * {{b}}"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Arithmetic expression using variables. Supports +, -, *, /, %, ()
                  </p>
                </div>

                {/* Max Points */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Points
                  </label>
                  <input
                    type="number"
                    value={maxPoints}
                    onChange={e => setMaxPoints(e.target.value)}
                    min="1"
                    className="w-32 px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags
                  </label>
                  <TagInput
                    selectedTagIds={tagIds}
                    onChange={setTagIds}
                    availableTags={availableTags}
                    placeholder="Search tags..."
                    tagGroups={tagGroups}
                  />
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Variables Section */}
          <Card>
            <Card.Header>
              <div className="flex items-center justify-between">
                <Card.Title>Variables</Card.Title>
                <Button size="sm" variant="outline" onClick={addVariable}>
                  + Add Variable
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {variables.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  No variables defined. Add at least one variable.
                </p>
              ) : (
                <div className="space-y-4">
                  {variables.map((v, index) => (
                    <VariableEditor
                      key={index}
                      variable={v}
                      index={index}
                      onChange={updateVariable}
                      onRemove={removeVariable}
                    />
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Validation Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h4 className="font-medium text-red-800 mb-2">Validation Errors</h4>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} isLoading={saving}>
              {isEditing ? 'Update Template' : 'Create Template'}
            </Button>
            <Button variant="outline" onClick={handlePreview}>
              Preview (3 samples)
            </Button>
            {isEditing && (
              <Button variant="ghost" onClick={handleGenerateNow}>
                Generate Now
              </Button>
            )}
          </div>
        </div>

        {/* Preview Panel */}
        <div>
          {showPreview && previews.length > 0 && (
            <Card>
              <Card.Header>
                <Card.Title>Preview (3 Samples)</Card.Title>
              </Card.Header>
              <Card.Body>
                <div className="space-y-4">
                  {previews.map((preview, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="info">Sample {i + 1}</Badge>
                      </div>
                      <h4 className="font-semibold text-gray-900">{preview.title}</h4>
                      <p className="text-sm text-gray-700">{preview.description}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-600">Answer:</span>
                        <code className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-sm font-mono">
                          {preview.expected_answer || '(empty)'}
                        </code>
                      </div>
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Values:</span>{' '}
                        {Object.entries(preview.values).map(([k, v]) => (
                          <span key={k} className="inline-block mr-2">
                            <code className="bg-gray-200 px-1 rounded">{k}={String(v)}</code>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}

          {!showPreview && (
            <Card>
              <Card.Body>
                <div className="text-center py-12 text-gray-400">
                  <p className="text-4xl mb-3">🎲</p>
                  <p className="font-medium">Click &quot;Preview&quot; to see sample challenges</p>
                  <p className="text-sm mt-1">3 random samples will be generated without saving</p>
                </div>
              </Card.Body>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}


// --- Variable Editor Component ---

function VariableEditor({
  variable,
  index,
  onChange,
  onRemove,
}: {
  variable: VariableFormEntry
  index: number
  onChange: (index: number, field: keyof VariableFormEntry, value: string) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl space-y-3 relative">
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-lg leading-none"
        aria-label="Remove variable"
      >
        ×
      </button>

      <div className="grid grid-cols-2 gap-3">
        {/* Variable Name */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input
            type="text"
            value={variable.name}
            onChange={e => onChange(index, 'name', e.target.value)}
            placeholder="e.g. a, b, fruit"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
          />
        </div>

        {/* Variable Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            value={variable.type}
            onChange={e => onChange(index, 'type', e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
          >
            <option value="random_int">Random Integer</option>
            <option value="random_float">Random Float</option>
            <option value="random_choice">Random Choice</option>
          </select>
        </div>
      </div>

      {/* Type-specific fields */}
      {(variable.type === 'random_int' || variable.type === 'random_float') && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Min</label>
            <input
              type="number"
              value={variable.min}
              onChange={e => onChange(index, 'min', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Max</label>
            <input
              type="number"
              value={variable.max}
              onChange={e => onChange(index, 'max', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
            />
          </div>
          {variable.type === 'random_float' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Decimals</label>
              <input
                type="number"
                value={variable.decimals}
                onChange={e => onChange(index, 'decimals', e.target.value)}
                min="0"
                max="10"
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
              />
            </div>
          )}
        </div>
      )}

      {variable.type === 'random_choice' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Options (comma-separated)
          </label>
          <input
            type="text"
            value={variable.options}
            onChange={e => onChange(index, 'options', e.target.value)}
            placeholder="e.g. apple, banana, orange"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
          />
        </div>
      )}
    </div>
  )
}

// --- Helper Functions ---

function variablesFromRecord(record: Record<string, Variable>): VariableFormEntry[] {
  return Object.entries(record).map(([name, v]) => ({
    name,
    type: v.type,
    min: v.min?.toString() || '1',
    max: v.max?.toString() || '10',
    options: v.options?.join(', ') || '',
    decimals: v.decimals?.toString() || '1',
  }))
}
