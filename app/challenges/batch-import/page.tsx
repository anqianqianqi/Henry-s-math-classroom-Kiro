'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import TagInput from '@/components/TagInput'
import { HenryProblemSheet } from '@/components/HenryProblemSheet'
import {
  HENRY_PROBLEM_EXTENSION,
  HenryProblemError,
  isHenryProblemFile,
  parseHenryProblem,
  type ParsedHenryProblem,
} from '@/lib/henryproblem'
import { cropGraphToBlob } from '@/lib/henryproblem-graph'
import {
  createChallengeTags,
  naturalCompare,
  resolveTagNames,
  type KnownTag,
} from '@/lib/challenge-tags'

type RowStatus = 'ready' | 'invalid' | 'importing' | 'done' | 'failed'

interface Row {
  key: string
  fileName: string
  include: boolean
  status: RowStatus
  /** Populated when the file parsed cleanly. */
  parsed?: ParsedHenryProblem
  /** Editable overrides — default to the snapshot's own values. */
  title: string
  maxPoints: number
  /** Failure reason for invalid/failed rows. */
  message?: string
  /** Set once imported, for the "view" link. */
  createdId?: string
  duplicate?: boolean
}

export default function BatchImportPage() {
  const { t, language } = useLanguage()
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState('')

  // Universal tags — applied to every imported problem
  const [universalTagIds, setUniversalTagIds] = useState<string[]>([])
  const [universalNewTags, setUniversalNewTags] = useState<string[]>([])
  const [newTagDraft, setNewTagDraft] = useState('')

  const [availableTags, setAvailableTags] = useState<any[]>([])
  const [tagGroups, setTagGroups] = useState<Array<{ id: string; name: string; tag_ids: string[] }>>([])
  // Follows the site-wide switcher; there is no second language control.
  const tagLang = language
  const [existingTitles, setExistingTitles] = useState<Set<string>>(new Set())
  const [previewKey, setPreviewKey] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: roleCheck } = await supabase
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', user.id)
      .is('class_id', null)

    const isTeacher = (roleCheck as any[])?.some(
      (r: any) => r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
    )
    if (!isTeacher) { router.push('/dashboard'); return }

    const [{ data: tagsData }, { data: groupsData }, { data: bankTitles }] = await Promise.all([
      supabase.from('challenge_tags')
        .select('id, challenge_tag_names(language, name)')
        .order('created_at'),
      supabase.from('tag_groups')
        .select('id, tag_group_names(language, name), tag_group_members(tag_id)')
        .order('created_at'),
      supabase.from('challenge_bank').select('title'),
    ])

    setAvailableTags(tagsData || [])
    setTagGroups((groupsData || []).map((g: any) => ({
      id: g.id,
      name: g.tag_group_names?.find((n: any) => n.language === tagLang)?.name
        || g.tag_group_names?.[0]?.name || 'Group',
      tag_ids: (g.tag_group_members || []).map((m: any) => m.tag_id),
    })))
    setExistingTitles(new Set((bankTitles || []).map((b: any) => String(b.title).trim().toLowerCase())))
    setLoading(false)
  }

  /** Tags as the matcher wants them: id + every localized name. */
  const knownTags: KnownTag[] = useMemo(
    () => availableTags.map((t: any) => ({
      id: t.id,
      names: (t.challenge_tag_names || []).map((n: any) => String(n.name)),
    })),
    [availableTags]
  )

  /** Tags as TagInput wants them: id + display name in the current language. */
  const tagOptions = useMemo(
    () => availableTags.map((t: any) => {
      const names = t.challenge_tag_names || []
      const local = names.find((n: any) => n.language === tagLang)?.name
      return {
        id: t.id,
        name: local || names.find((n: any) => n.language === 'en')?.name || t.id.slice(0, 8),
        _allNames: names.map((n: any) => n.name),
      }
    }),
    [availableTags, tagLang]
  )

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setError('')
    setFinished(false)
    setReading(true)

    const candidates = Array.from(fileList).filter(f => isHenryProblemFile(f.name))
    if (candidates.length === 0) {
      setError(`No ${HENRY_PROBLEM_EXTENSION} files in that selection.`)
      setReading(false)
      return
    }

    candidates.sort((a, b) => naturalCompare(a.name, b.name))

    const next: Row[] = []
    for (const file of candidates) {
      const base = file.name.replace(new RegExp(`${HENRY_PROBLEM_EXTENSION}$`, 'i'), '')
      try {
        const parsed = parseHenryProblem(await file.text())
        const title = parsed.title || base
        next.push({
          key: `${file.name}-${file.size}-${file.lastModified}`,
          fileName: file.name,
          include: true,
          status: 'ready',
          parsed,
          title,
          maxPoints: parsed.maxPoints ?? 100,
          duplicate: existingTitles.has(title.trim().toLowerCase()),
        })
      } catch (err) {
        next.push({
          key: `${file.name}-${file.size}-${file.lastModified}`,
          fileName: file.name,
          include: false,
          status: 'invalid',
          title: base,
          maxPoints: 100,
          message: err instanceof HenryProblemError ? err.message : 'Could not read this file.',
        })
      }
    }

    // Replace rather than append — re-picking a folder should not duplicate.
    setRows(next)
    setReading(false)
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addUniversalNewTag() {
    const name = newTagDraft.trim()
    if (!name) return
    const alreadyKnown = knownTags.some(t =>
      t.names.some(n => n.toLowerCase() === name.toLowerCase())
    )
    if (alreadyKnown) {
      const { matchedIds } = resolveTagNames([name], knownTags)
      setUniversalTagIds(prev => [...new Set([...prev, ...matchedIds])])
    } else {
      setUniversalNewTags(prev => [...new Set([...prev, name])])
    }
    setNewTagDraft('')
  }

  const selectedRows = rows.filter(r => r.include && r.status !== 'invalid')

  /** Every tag name across the batch that does not exist yet. */
  const pendingNewTagNames = useMemo(() => {
    const names = new Set<string>()
    for (const name of universalNewTags) names.add(name)
    for (const row of selectedRows) {
      const { newNames } = resolveTagNames(row.parsed?.tagNames || [], knownTags)
      for (const name of newNames) names.add(name)
    }
    return [...names]
  }, [selectedRows, knownTags, universalNewTags])

  async function handleImport() {
    if (!userId || selectedRows.length === 0) return
    setImporting(true)
    setError('')
    setProgress({ done: 0, total: selectedRows.length })

    // Create every missing tag once up front, so 40 problems sharing a new
    // tag do not race each other into 40 duplicates.
    let createdTags = new Map<string, string>()
    if (pendingNewTagNames.length > 0) {
      createdTags = await createChallengeTags(supabase, pendingNewTagNames, userId)
    }

    const universalIds = [
      ...universalTagIds,
      ...universalNewTags
        .map(n => createdTags.get(n.trim().toLowerCase()))
        .filter((id): id is string => !!id),
    ]

    let completed = 0
    for (const row of selectedRows) {
      updateRow(row.key, { status: 'importing', message: undefined })
      try {
        const { matchedIds, newNames } = resolveTagNames(row.parsed!.tagNames, knownTags)
        const ownIds = [
          ...matchedIds,
          ...newNames
            .map(n => createdTags.get(n.trim().toLowerCase()))
            .filter((id): id is string => !!id),
        ]
        const tagIds = [...new Set([...ownIds, ...universalIds])]

        const { data: created, error: insertError } = await supabase
          .from('challenge_bank')
          .insert({
            created_by: userId,
            title: row.title.trim() || row.fileName,
            description: row.parsed!.description,
            tag_ids: tagIds,
            max_points: row.maxPoints,
            henryproblem: row.parsed!.stored,
          })
          .select('id')
          .single()

        if (insertError || !created) throw new Error(insertError?.message || 'Insert failed')

        // The diagram needs the challenge id in its storage path, so it is
        // uploaded after the row exists.
        if (row.parsed!.graphDataUrl) {
          const blob = await cropGraphToBlob(row.parsed!.graphDataUrl, row.parsed!.crop)
          const path = `${userId}/${created.id}.png`
          const { error: uploadError } = await supabase.storage
            .from('challenge-images')
            .upload(path, blob, { upsert: true, contentType: 'image/png' })

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('challenge-images').getPublicUrl(path)
            await supabase.from('challenge_bank')
              .update({ image_url: publicUrl }).eq('id', created.id)
          }
        }

        updateRow(row.key, { status: 'done', createdId: created.id })
      } catch (err) {
        updateRow(row.key, {
          status: 'failed',
          message: err instanceof Error ? err.message : 'Import failed',
        })
      }
      completed += 1
      setProgress({ done: completed, total: selectedRows.length })
    }

    setImporting(false)
    setFinished(true)
  }

  const doneCount = rows.filter(r => r.status === 'done').length
  const failedCount = rows.filter(r => r.status === 'failed').length
  const invalidCount = rows.filter(r => r.status === 'invalid').length
  const duplicateCount = rows.filter(r => r.duplicate && r.include).length
  const previewRow = rows.find(r => r.key === previewKey)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <PageHeader
        breadcrumbs={[
          { label: 'Challenge Bank', href: '/admin/challenge-bank' },
          { label: 'Batch Import' },
        ]}
        maxWidth="max-w-5xl"
      />

      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* ── Pick files ─────────────────────────────────────────────── */}
        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <span>📦</span> Batch Import Henry Problems
            </Card.Title>
          </Card.Header>
          <Card.Body>
            <p className="text-sm text-gray-600 mb-4">
              Choose a set of <code>{HENRY_PROBLEM_EXTENSION}</code> files — or the whole folder the
              batch app wrote them to. Each one becomes a challenge-bank item with its own title,
              points, tags and wording. Nothing is created until you press Import.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={reading || importing}
              >
                📄 Choose files
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => folderInputRef.current?.click()}
                disabled={reading || importing}
              >
                📁 Choose folder
              </Button>
              {rows.length > 0 && !importing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setRows([]); setFinished(false) }}
                >
                  Clear
                </Button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={HENRY_PROBLEM_EXTENSION}
              className="hidden"
              onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              // @ts-expect-error — non-standard but supported in Chrome/Edge/Safari
              webkitdirectory=""
              directory=""
              onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
            />

            {reading && <p className="mt-3 text-sm text-gray-500">Reading files…</p>}
          </Card.Body>
        </Card>

        {rows.length > 0 && (
          <>
            {/* ── Universal tags ───────────────────────────────────────── */}
            <Card>
              <Card.Header>
                <Card.Title className="flex items-center gap-2">
                  <span>🏷️</span> Tags for every problem in this batch
                </Card.Title>
              </Card.Header>
              <Card.Body>
                <p className="text-sm text-gray-600 mb-3">
                  These are added on top of the tags each file already carries. Useful for a
                  source, a unit, or a difficulty band.
                </p>

                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Existing tags</label>
                </div>
                <TagInput
                  selectedTagIds={universalTagIds}
                  onChange={setUniversalTagIds}
                  availableTags={tagOptions}
                  placeholder="Search by name..."
                  tagGroups={tagGroups}
                />

                <label className="block text-sm font-medium text-gray-700 mt-4 mb-2">
                  Or add a new tag
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagDraft}
                    onChange={e => setNewTagDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); addUniversalNewTag() }
                    }}
                    placeholder="e.g. Spring 2026 Set A"
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl
                               focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  />
                  <Button type="button" variant="outline" onClick={addUniversalNewTag}>
                    Add
                  </Button>
                </div>

                {universalNewTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {universalNewTags.map(name => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 bg-amber-100 text-amber-800
                                   text-xs font-medium px-2 py-0.5 rounded-full"
                      >
                        {name}
                        <button
                          type="button"
                          onClick={() => setUniversalNewTags(prev => prev.filter(t => t !== name))}
                          className="text-amber-500 hover:text-amber-900 leading-none"
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* ── Review ───────────────────────────────────────────────── */}
            <Card>
              <Card.Header>
                <Card.Title className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span>📝</span> Review ({selectedRows.length} of {rows.length} selected)
                  </span>
                  {!importing && !finished && (
                    <button
                      type="button"
                      onClick={() => {
                        const allOn = rows.every(r => r.include || r.status === 'invalid')
                        setRows(prev => prev.map(r =>
                          r.status === 'invalid' ? r : { ...r, include: !allOn }
                        ))
                      }}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                      Toggle all
                    </button>
                  )}
                </Card.Title>
              </Card.Header>
              <Card.Body className="space-y-2">
                {(invalidCount > 0 || duplicateCount > 0) && (
                  <div className="mb-3 space-y-1.5">
                    {invalidCount > 0 && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {invalidCount} file{invalidCount > 1 ? 's' : ''} could not be read and
                        {invalidCount > 1 ? ' are' : ' is'} excluded.
                      </p>
                    )}
                    {duplicateCount > 0 && (
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        {duplicateCount} title{duplicateCount > 1 ? 's' : ''} already exist in the
                        bank. Importing will create a second copy — rename or deselect to avoid that.
                      </p>
                    )}
                  </div>
                )}

                {rows.map(row => (
                  <div
                    key={row.key}
                    className={`rounded-xl border p-3 ${
                      row.status === 'invalid' ? 'bg-red-50/60 border-red-200'
                        : row.status === 'failed' ? 'bg-red-50/60 border-red-200'
                        : row.status === 'done' ? 'bg-green-50/60 border-green-200'
                        : row.duplicate && row.include ? 'bg-amber-50/50 border-amber-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={row.include}
                        disabled={row.status === 'invalid' || importing || finished}
                        onChange={e => updateRow(row.key, { include: e.target.checked })}
                        className="mt-1.5 w-4 h-4 rounded shrink-0 disabled:opacity-40"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500 truncate">{row.fileName}</span>
                          {row.parsed?.graphDataUrl && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              diagram
                            </span>
                          )}
                          {row.duplicate && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              title exists
                            </span>
                          )}
                          {row.status === 'importing' && (
                            <span className="text-[10px] text-gray-500">importing…</span>
                          )}
                          {row.status === 'done' && (
                            <span className="text-[10px] text-green-700 font-medium">✓ imported</span>
                          )}
                        </div>

                        {row.status === 'invalid' || row.status === 'failed' ? (
                          <p className="text-sm text-red-700 mt-1">{row.message}</p>
                        ) : (
                          <>
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              <input
                                type="text"
                                value={row.title}
                                disabled={importing || finished}
                                onChange={e => updateRow(row.key, { title: e.target.value })}
                                className="flex-1 min-w-[12rem] px-2.5 py-1.5 text-sm font-medium
                                           border border-gray-200 rounded-lg disabled:bg-gray-50"
                              />
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  value={row.maxPoints}
                                  disabled={importing || finished}
                                  onChange={e => updateRow(row.key, {
                                    maxPoints: parseInt(e.target.value) || 1,
                                  })}
                                  className="w-20 px-2.5 py-1.5 text-sm border border-gray-200
                                             rounded-lg disabled:bg-gray-50"
                                />
                                <span className="text-xs text-gray-500">pts</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {(row.parsed?.tagNames || []).map(name => (
                                <span
                                  key={name}
                                  className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                                >
                                  {name}
                                </span>
                              ))}
                              <button
                                type="button"
                                onClick={() => setPreviewKey(row.key === previewKey ? null : row.key)}
                                className="text-[11px] text-primary-600 hover:text-primary-700 font-medium"
                              >
                                {row.key === previewKey ? 'Hide preview' : 'Preview'}
                              </button>
                              {row.createdId && (
                                <a
                                  href={`/challenges/${row.createdId}`}
                                  className="text-[11px] text-green-700 hover:underline font-medium"
                                >
                                  View
                                </a>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {row.key === previewKey && row.parsed && (
                      <div className="mt-3">
                        <HenryProblemSheet
                          problem={row.parsed.snapshot.problem}
                          graphUrl={row.parsed.graphDataUrl}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </Card.Body>
            </Card>

            {/* ── Import ───────────────────────────────────────────────── */}
            <Card>
              <Card.Body>
                {pendingNewTagNames.length > 0 && !finished && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-semibold text-amber-800 mb-2">
                      {pendingNewTagNames.length} new tag
                      {pendingNewTagNames.length > 1 ? 's' : ''} will be created:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {pendingNewTagNames.map(name => (
                        <span
                          key={name}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {importing && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Importing…</span>
                      <span>{progress.done} / {progress.total}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 transition-all"
                        style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {finished ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-2xl">
                      <p className="text-sm text-green-800 font-medium">
                        Imported {doneCount} problem{doneCount === 1 ? '' : 's'} into the
                        challenge bank
                        {failedCount > 0 && ` — ${failedCount} failed`}.
                      </p>
                      {failedCount > 0 && (
                        <p className="text-xs text-green-700 mt-1">
                          Failed rows are marked above with the reason. Fix and re-import just those.
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={() => router.push('/admin/challenge-bank')} size="lg" className="flex-1">
                        Go to Challenge Bank
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => { setRows([]); setFinished(false); setUniversalNewTags([]) }}
                      >
                        Import more
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      onClick={handleImport}
                      disabled={selectedRows.length === 0 || importing}
                      isLoading={importing}
                      size="lg"
                      className="flex-1"
                    >
                      Import {selectedRows.length} problem{selectedRows.length === 1 ? '' : 's'} to Challenge Bank
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      disabled={importing}
                      onClick={() => router.push('/admin/challenge-bank')}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </Card.Body>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
