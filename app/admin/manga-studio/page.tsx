'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { WorkflowState } from '@/lib/manga/domain'

export default function MangaStudioPage() {
  const searchParams  = useSearchParams()
  const challengeId   = searchParams.get('challengeId') || ''
  const urlProjectId  = searchParams.get('projectId')   || ''
  const router = useRouter()
  const { t } = useLanguage()

  const [projectId, setProjectId] = useState(urlProjectId)
  const [state, setState]         = useState<WorkflowState | null>(null)
  const [loading, setLoading]     = useState(!!urlProjectId) // spinner while loading existing project
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState('')

  // Math review state
  const [reviewOpen, setReviewOpen]   = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')

  // ── Load existing project on mount if projectId is in the URL ──────────
  useEffect(() => {
    if (!urlProjectId) return
    async function load() {
      setLoading(true); setError('')
      try {
        const res = await fetch(`/api/manga/projects/${urlProjectId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load project')
        setProjectId(data.projectId)
        setState(data.state)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project')
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlProjectId])

  // ── Generic POST helper ────────────────────────────────────────────────
  async function call(url: string, body?: unknown) {
    setBusy(true); setError('')
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || t('manga.error'))
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : t('manga.error'))
      return null
    } finally {
      setBusy(false)
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────

  async function start() {
    const data = await call('/api/manga/projects', { challengeId, language: 'bilingual' })
    if (data) {
      setProjectId(data.projectId)
      setState(data.state)
      // Put projectId in URL so the page can be resumed after refresh
      router.replace(`/admin/manga-studio?challengeId=${challengeId}&projectId=${data.projectId}`)
    }
  }

  // advance with force=false — use existing DB result if available
  async function advance(force = false) {
    const data = await call(`/api/manga/projects/${projectId}/advance`, force ? { force: true } : {})
    if (data) setState(data)
  }

  async function approveMath() {
    const data = await call(`/api/manga/projects/${projectId}/approve-math`)
    if (data) setState(data)
  }

  async function reviewMath() {
    if (!reviewNotes.trim()) return
    const data = await call(`/api/manga/projects/${projectId}/review-math`, { reviewNotes })
    if (data) { setState(data); setReviewOpen(false); setReviewNotes('') }
  }

  async function selectStory(pitchId: string) {
    const data = await call(`/api/manga/projects/${projectId}/select-story`, { pitchId })
    if (data) setState(data)
  }

  async function chooseRenderMode(mode: 'one_by_one' | 'bulk') {
    const data = await call(`/api/manga/projects/${projectId}/render-mode`, { mode })
    if (data) setState(data)
  }

  async function generatePanels(panelIndex?: number) {
    const data = await call(
      `/api/manga/projects/${projectId}/panels/generate`,
      panelIndex === undefined ? {} : { panelIndex },
    )
    if (data?.state) setState(data.state)
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-sky-50 flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading project…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-sky-50 p-4 sm:p-8">
      <main className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900">{t('manga.studio')}</h1>
            <p className="mt-2 text-gray-600">{t('manga.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={() => router.push(`/challenges/${challengeId}`)}>
            {t('manga.back')}
          </Button>
        </div>

        {/* Step stepper */}
        <div className="my-6 grid grid-cols-3 gap-2 text-center text-sm font-bold">
          <div className="rounded-xl bg-primary-100 p-3">{t('manga.stepMath')}</div>
          <div className={`rounded-xl p-3 ${state?.storyPitches.length ? 'bg-primary-100' : 'bg-gray-100'}`}>{t('manga.stepStory')}</div>
          <div className={`rounded-xl p-3 ${state?.stage === 'casting' ? 'bg-primary-100' : 'bg-gray-100'}`}>{t('manga.stepCast')}</div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
        )}

        {/* Start button — only when no project yet */}
        {!projectId && (
          <Card className="p-8 text-center">
            <Button onClick={start} isLoading={busy} disabled={!challengeId}>{t('manga.start')}</Button>
          </Card>
        )}

        {/* Math step — not yet run */}
        {projectId && !state?.mathAnalysis && (
          <Card className="p-8">
            <h2 className="text-xl font-black">{t('manga.stepMath')}</h2>
            <Button className="mt-5" onClick={() => advance(false)} isLoading={busy}>
              {t('manga.analyze')}
            </Button>
          </Card>
        )}

        {/* Math analysis — results exist in DB */}
        {state?.mathAnalysis && !state.storyPitches.length && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-black">{t('manga.stepMath')}</h2>
              {/* "Saved" badge — results came from DB */}
              <span className="text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full">
                💾 Saved
              </span>
            </div>

            <dl className="mt-4 space-y-4">
              <Item label={t('manga.answer')}       value={state.mathAnalysis.answer}/>
              <Item label={t('manga.takeaway')}     value={state.mathAnalysis.mathTakeaway}/>
              <Item label={t('manga.verification')} value={state.mathAnalysis.verification}/>
              {state.mathAnalysis.ambiguities.length > 0 && (
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-red-500">⚠️ Ambiguities</dt>
                  <dd className="mt-1 space-y-1">
                    {state.mathAnalysis.ambiguities.map((a, i) => (
                      <p key={i} className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-1.5">{a}</p>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            {/* Review textarea */}
            {reviewOpen && (
              <div className="mt-5 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">Tell the math agent what to fix:</p>
                <textarea
                  autoFocus
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder="e.g. The answer should be C. 375. The takeaway needs to mention place value."
                  rows={4}
                  className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <div className="flex gap-2">
                  <Button onClick={reviewMath} isLoading={busy} disabled={!reviewNotes.trim()}>
                    ↺ Re-run with notes
                  </Button>
                  <Button variant="outline" onClick={() => { setReviewOpen(false); setReviewNotes('') }} disabled={busy}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              {state.stage === 'math_review'
                ? <Button onClick={approveMath} isLoading={busy}>{t('manga.approveMath')}</Button>
                : <Button onClick={() => advance(false)} isLoading={busy}>{t('manga.generateStories')}</Button>
              }
              {!reviewOpen && (
                <Button variant="outline" onClick={() => setReviewOpen(true)} disabled={busy}>
                  ✏️ Review
                </Button>
              )}
              {/* Regenerate — force a fresh OpenAI call, discarding saved result */}
              <Button
                variant="outline"
                onClick={() => advance(true)}
                isLoading={busy}
                disabled={reviewOpen}
              >
                ↺ Regenerate
              </Button>
            </div>
          </Card>
        )}

        {/* Story pitches — results exist in DB */}
        {state?.storyPitches.length ? (
          <>
            {/* "Saved" banner + regenerate option */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full">
                💾 Story pitches saved
              </span>
              <Button
                variant="outline"
                onClick={() => advance(true)}
                isLoading={busy}
                disabled={!!state.selectedPitchId}
              >
                ↺ Regenerate pitches
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {state.storyPitches.map(pitch => (
                <Card key={pitch.id} className={`p-6 ${state.selectedPitchId === pitch.id ? 'ring-2 ring-primary-400' : ''}`}>
                  <div className="text-xs font-black uppercase tracking-wide text-primary-600">{pitch.type}</div>
                  <h2 className="mt-2 text-xl font-black">{pitch.title}</h2>
                  <p className="mt-2 font-medium text-gray-700">{pitch.hook}</p>
                  <p className="mt-3 text-sm text-gray-600">{pitch.synopsis}</p>
                  <Button
                    className="mt-5"
                    variant={state.selectedPitchId === pitch.id ? 'secondary' : 'outline'}
                    onClick={() => selectStory(pitch.id)}
                    disabled={busy || state.stage === 'casting'}
                  >
                    {state.selectedPitchId === pitch.id ? t('manga.selected') : t('manga.chooseStory')}
                  </Button>
                </Card>
              ))}
            </div>
          </>
        ) : null}

        {/* Render mode selection */}
        {state?.stage === 'render_mode_selection' && (
          <Card className="mt-6 p-6">
            <h2 className="text-xl font-black">{t('manga.chooseRenderMode')}</h2>
            <p className="mt-2 text-sm text-gray-600">{t('manga.renderModeHelp')}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <button className="rounded-2xl border-2 border-sky-200 p-5 text-left hover:border-sky-500" onClick={() => chooseRenderMode('one_by_one')} disabled={busy}>
                <span className="block font-black">{t('manga.oneByOne')}</span>
                <span className="mt-1 block text-sm text-gray-600">{t('manga.oneByOneHelp')}</span>
              </button>
              <button className="rounded-2xl border-2 border-amber-200 p-5 text-left hover:border-amber-500" onClick={() => chooseRenderMode('bulk')} disabled={busy}>
                <span className="block font-black">{t('manga.bulk')}</span>
                <span className="mt-1 block text-sm text-gray-600">{t('manga.bulkHelp')}</span>
              </button>
            </div>
          </Card>
        )}

        {/* Panel generation */}
        {state?.renderSpec.generationMode && ['generating', 'panel_review'].includes(state.stage) && (
          <Card className="mt-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{t('manga.panelArt')}</h2>
                <p className="mt-1 text-sm text-gray-600">
                  {state.renderSpec.generationMode === 'bulk' ? t('manga.bulkActive') : t('manga.oneByOneActive')}
                </p>
              </div>
              {state.renderSpec.generationMode === 'bulk' && (
                <Button onClick={() => generatePanels()} isLoading={busy}>{t('manga.generatePending')}</Button>
              )}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {state.panels.map(panel => (
                <div key={panel.index} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <strong>{t('manga.panel')} {panel.index}</strong>
                    <span className={`text-xs uppercase font-semibold px-2 py-0.5 rounded-full ${
                      panel.artStatus === 'ready' || panel.artStatus === 'approved' ? 'bg-green-100 text-green-700' :
                      panel.artStatus === 'failed' ? 'bg-red-100 text-red-700' :
                      panel.artStatus === 'generating' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {/* Show "💾 saved" for already-generated panels */}
                      {(panel.artStatus === 'ready' || panel.artStatus === 'approved') ? '💾 saved' : panel.artStatus}
                    </span>
                  </div>
                  {panel.imageUrl && (
                    <img src={panel.imageUrl} alt={`${t('manga.panel')} ${panel.index}`} className="mt-3 aspect-[3/2] w-full rounded-lg object-cover"/>
                  )}
                  <p className="mt-2 line-clamp-3 text-xs text-gray-500">{panel.purpose}</p>
                  {panel.lastError && <p className="mt-2 text-xs text-red-600">{panel.lastError}</p>}
                  {state.renderSpec.generationMode === 'one_by_one' && (
                    <Button className="mt-3" variant="outline" onClick={() => generatePanels(panel.index)} isLoading={busy}>
                      {panel.imageUrl ? t('manga.regeneratePanel') : t('manga.generatePanel')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {busy && <p className="mt-4 text-center text-sm text-gray-500">{t('manga.loading')}</p>}
      </main>
    </div>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-gray-900">{value}</dd>
    </div>
  )
}
