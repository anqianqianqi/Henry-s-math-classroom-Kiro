'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { WorkflowState } from '@/lib/manga/domain'

export default function MangaStudioPage() {
  const challengeId = useSearchParams().get('challengeId') || ''
  const router = useRouter()
  const { t } = useLanguage()
  const [projectId, setProjectId] = useState('')
  const [state, setState] = useState<WorkflowState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function call(url: string, body?: unknown) {
    setBusy(true); setError('')
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || t('manga.error'))
      return data
    } catch (err) { setError(err instanceof Error ? err.message : t('manga.error')); return null }
    finally { setBusy(false) }
  }

  async function start() {
    const data = await call('/api/manga/projects', { challengeId, language: 'bilingual' })
    if (data) { setProjectId(data.projectId); setState(data.state) }
  }
  async function advance() { const data = await call(`/api/manga/projects/${projectId}/advance`); if (data) setState(data) }
  async function approveMath() { const data = await call(`/api/manga/projects/${projectId}/approve-math`); if (data) setState(data) }
  async function selectStory(pitchId: string) { const data = await call(`/api/manga/projects/${projectId}/select-story`, { pitchId }); if (data) setState(data) }

  return <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-sky-50 p-4 sm:p-8"><main className="mx-auto max-w-5xl">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-3xl font-black text-gray-900">{t('manga.studio')}</h1><p className="mt-2 text-gray-600">{t('manga.subtitle')}</p></div><Button variant="outline" onClick={() => router.push(`/challenges/${challengeId}`)}>{t('manga.back')}</Button></div>
    <div className="my-6 grid grid-cols-3 gap-2 text-center text-sm font-bold"><div className="rounded-xl bg-primary-100 p-3">{t('manga.stepMath')}</div><div className={`rounded-xl p-3 ${state?.storyPitches.length ? 'bg-primary-100' : 'bg-gray-100'}`}>{t('manga.stepStory')}</div><div className={`rounded-xl p-3 ${state?.stage === 'casting' ? 'bg-primary-100' : 'bg-gray-100'}`}>{t('manga.stepCast')}</div></div>
    {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
    {!projectId && <Card className="p-8 text-center"><Button onClick={start} isLoading={busy} disabled={!challengeId}>{t('manga.start')}</Button></Card>}
    {projectId && !state?.mathAnalysis && <Card className="p-8"><h2 className="text-xl font-black">{t('manga.stepMath')}</h2><Button className="mt-5" onClick={advance} isLoading={busy}>{t('manga.analyze')}</Button></Card>}
    {state?.mathAnalysis && !state.storyPitches.length && <Card className="p-6"><h2 className="text-xl font-black">{t('manga.stepMath')}</h2><dl className="mt-5 space-y-4"><Item label={t('manga.answer')} value={state.mathAnalysis.answer}/><Item label={t('manga.takeaway')} value={state.mathAnalysis.mathTakeaway}/><Item label={t('manga.verification')} value={state.mathAnalysis.verification}/></dl><div className="mt-6 flex gap-3">{state.stage === 'math_review' ? <Button onClick={approveMath} isLoading={busy}>{t('manga.approveMath')}</Button> : <Button onClick={advance} isLoading={busy}>{t('manga.generateStories')}</Button>}</div></Card>}
    {state?.storyPitches.length ? <div className="grid gap-4 md:grid-cols-2">{state.storyPitches.map(pitch => <Card key={pitch.id} className={`p-6 ${state.selectedPitchId === pitch.id ? 'ring-2 ring-primary-400' : ''}`}><div className="text-xs font-black uppercase tracking-wide text-primary-600">{pitch.type}</div><h2 className="mt-2 text-xl font-black">{pitch.title}</h2><p className="mt-2 font-medium text-gray-700">{pitch.hook}</p><p className="mt-3 text-sm text-gray-600">{pitch.synopsis}</p><Button className="mt-5" variant={state.selectedPitchId === pitch.id ? 'secondary' : 'outline'} onClick={() => selectStory(pitch.id)} disabled={busy || state.stage === 'casting'}>{state.selectedPitchId === pitch.id ? t('manga.selected') : t('manga.chooseStory')}</Button></Card>)}</div> : null}
    {busy && <p className="mt-4 text-center text-sm text-gray-500">{t('manga.loading')}</p>}
  </main></div>
}

function Item({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-black uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-1 text-gray-900">{value}</dd></div> }
