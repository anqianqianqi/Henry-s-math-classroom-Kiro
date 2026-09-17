'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { MegaWorkflow, StoryPitch, Step1Output, Step2Output, Step4Output } from '@/lib/mega/types'
import { isStepDone, STEP_DONE } from '@/lib/mega/types'

// ── Notification ──────────────────────────────────────────────────────────

function Notification({ message, type, onClose }: {
  message: string; type: 'success' | 'error'; onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-3 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
      {message}
      <button onClick={onClose} className="text-white/70 hover:text-white text-lg leading-none">×</button>
    </div>
  )
}

// ── Progress Stepper ──────────────────────────────────────────────────────

const STEP_LABELS = ['Math Solver', 'Takeaway', 'Story', 'Mega']

function StepStepper({ status }: { status: string }) {
  function getStepState(n: number): 'done' | 'active' | 'locked' {
    if (isStepDone(status, n)) return 'done'
    const activeMap: Record<string, number> = {
      step1_pending: 1, step1_done: 1,
      step2_pending: 2, step2_done: 2,
      step3_pending: 3, step3_done: 3,
      step4_pending: 4, completed: 4,
    }
    return activeMap[status] === n ? 'active' : 'locked'
  }

  return (
    <div className="flex items-center gap-0 mb-8">
      {[1, 2, 3, 4].map((n, i) => {
        const state = getStepState(n)
        return (
          <div key={n} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                state === 'done'   ? 'bg-green-500 text-white' :
                state === 'active' ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' :
                'bg-gray-100 text-gray-400'
              }`}>
                {state === 'done' ? '✓' : n}
              </div>
              <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                state === 'done' ? 'text-green-600' :
                state === 'active' ? 'text-indigo-600' :
                'text-gray-400'
              }`}>
                {STEP_LABELS[i]}
              </span>
            </div>
            {i < 3 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${
                isStepDone(status, n) ? 'bg-green-400' : 'bg-gray-200'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1 Output Display ─────────────────────────────────────────────────

function Step1Display({ output }: { output: Step1Output }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="p-3 bg-green-50 rounded-lg border border-green-100">
        <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-1">Answer</p>
        <p className="font-bold text-green-800">{output.answer}</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Solution Steps</p>
        <ol className="space-y-2">
          {output.solution_steps.map((s, i) => (
            <li key={i} className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
              <p className="font-semibold text-gray-800">{s.step}</p>
              <p className="text-gray-600 mt-0.5">{s.action}</p>
              <p className="text-indigo-600 text-xs mt-1 italic">💡 {s.discovery_moment}</p>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Common Mistakes</p>
        <div className="space-y-1.5">
          {output.common_mistakes.map((m, i) => (
            <div key={i} className="p-2.5 bg-red-50 rounded-lg border border-red-100 text-xs">
              <span className="font-semibold text-red-700">{m.mistake}: </span>
              <span className="text-red-600">&ldquo;{m.what_student_writes}&rdquo;</span>
            </div>
          ))}
        </div>
      </div>
      <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100 text-xs">
        <span className="font-semibold text-amber-700">Core trap: </span>
        <span className="text-amber-700">{output.core_trap}</span>
      </div>
    </div>
  )
}

// ── Step 2 Output Display ─────────────────────────────────────────────────

function Step2Display({ output }: { output: Step2Output }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
        <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-1">Core Concept (Henry&apos;s Key Insight)</p>
        <p className="text-indigo-800 font-medium italic">&ldquo;{output.core_concept}&rdquo;</p>
      </div>
      <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
        <p className="text-[10px] font-semibold text-yellow-700 uppercase tracking-wide mb-1">Student&apos;s Aha Moment</p>
        <p className="text-yellow-800">{output.student_insight}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-xs">
          <p className="font-semibold text-gray-600 mb-1">Teaching Angle</p>
          <p className="text-gray-700">{output.teaching_angle}</p>
        </div>
        <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-xs">
          <p className="font-semibold text-gray-600 mb-1">Prior Knowledge</p>
          <p className="text-gray-700">{output.connection_to_prior_knowledge}</p>
        </div>
      </div>
      <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-100 text-xs">
        <p className="font-semibold text-purple-700 mb-1">Challenge Extension</p>
        <p className="text-purple-700">{output.challenge_extension}</p>
      </div>
    </div>
  )
}

// ── Step 3 — Story Pitch Cards ────────────────────────────────────────────

function Step3PitchCards({ pitches, selected, onSelect }: {
  pitches: StoryPitch[]
  selected: StoryPitch | null
  onSelect: (p: StoryPitch) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {pitches.map((p, i) => (
        <button
          key={i}
          onClick={() => onSelect(p)}
          className={`text-left p-4 rounded-xl border-2 transition ${
            selected?.title === p.title
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'
          }`}
        >
          <p className="font-bold text-gray-900 text-sm mb-1">{p.title}</p>
          <p className="text-xs text-indigo-600 font-medium mb-2">{p.character}</p>
          <p className="text-xs text-gray-600 leading-relaxed">{p.scenario}</p>
        </button>
      ))}
    </div>
  )
}

// ── Step 4 Output Display ─────────────────────────────────────────────────

function Step4Display({ output }: { output: Step4Output }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-2">Story Intro</p>
        <p className="text-gray-800 leading-relaxed">{output.story_intro}</p>
      </div>
      <div className="p-3 bg-gray-800 rounded-xl text-white">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">The Challenge</p>
        <p className="font-medium whitespace-pre-line">{output.challenge}</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Solution</p>
        <ol className="space-y-1.5">
          {output.solution.map((s, i) => (
            <li key={i} className="flex gap-2 text-xs text-gray-700">
              <span className="text-indigo-500 font-bold shrink-0">{i + 1}.</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
        <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-1">Henry&apos;s Key Insight</p>
        <p className="text-indigo-800 font-medium italic">&ldquo;{output.key_insight}&rdquo;</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Watch Out For</p>
        <ul className="space-y-1">
          {output.common_traps.map((t, i) => (
            <li key={i} className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5 border border-red-100">⚠️ {t}</li>
          ))}
        </ul>
      </div>
      <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
        <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide mb-1">Challenge Yourself</p>
        <p className="text-purple-800 text-xs leading-relaxed">{output.challenge_yourself}</p>
      </div>
    </div>
  )
}

// ── Step Panel ────────────────────────────────────────────────────────────

const STEP_NAMES = ['Math Solver', 'Math Takeaway', 'Story Brainstorm', 'Mega Generator']
const STEP_DESCS = [
  'Solves the problem and maps the cognitive traps',
  'Extracts the core mathematical insight',
  'Generates 3 story pitches — pick one',
  'Assembles the complete teaching document',
]

function StepPanel({
  step, workflow, rawOutput, pitches, selectedPitch,
  running, sending, expanded, resetConfirm,
  onRun, onApprove, onSelectPitch, onRerun, onToggleExpand, onResetRequest, onResetConfirm, onResetCancel,
}: {
  step: number
  workflow: MegaWorkflow
  rawOutput: any
  pitches: StoryPitch[] | null
  selectedPitch: StoryPitch | null
  running: boolean
  sending: boolean
  expanded: boolean
  resetConfirm: boolean
  onRun: () => void
  onApprove: () => void
  onSelectPitch: (p: StoryPitch) => void
  onRerun: () => void
  onToggleExpand: () => void
  onResetRequest: () => void
  onResetConfirm: () => void
  onResetCancel: () => void
}) {
  const isDone    = isStepDone(workflow.status, step)
  const approvedOutput = (workflow as any)[`step${step}_output`]
  const displayOutput  = rawOutput ?? (workflow as any)[`step${step}_raw`]
  const hasOutput      = !!displayOutput
  const isStep3        = step === 3

  return (
    <div className={`rounded-2xl border-2 overflow-hidden mb-4 transition ${
      isDone ? 'border-green-200' : 'border-indigo-200'
    }`}>
      {/* Panel header */}
      <div
        className={`px-4 py-3 flex items-center justify-between cursor-pointer ${
          isDone ? 'bg-green-50' : 'bg-indigo-50'
        }`}
        onClick={isDone ? onToggleExpand : undefined}
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
            isDone ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white'
          }`}>
            {isDone ? '✓' : step}
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">{STEP_NAMES[step - 1]}</p>
            <p className="text-[11px] text-gray-500">{STEP_DESCS[step - 1]}</p>
          </div>
        </div>
        {isDone && (
          <span className="text-gray-400 text-lg">{expanded ? '↑' : '↓'}</span>
        )}
      </div>

      {/* Panel body — show when not done, or when expanded */}
      {(!isDone || expanded) && (
        <div className="px-4 py-4 bg-white space-y-4">

          {/* Not yet run */}
          {!hasOutput && !running && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-4">{STEP_DESCS[step - 1]}</p>
              <button
                onClick={onRun}
                className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition"
              >
                ▶ Run {STEP_NAMES[step - 1]}
              </button>
            </div>
          )}

          {/* Running spinner */}
          {running && (
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-indigo-600 font-medium animate-pulse">🤖 Agent is thinking...</p>
            </div>
          )}

          {/* Output + action buttons */}
          {hasOutput && !running && (
            <>
              {/* Step-specific output display */}
              {step === 1 && <Step1Display output={displayOutput as Step1Output} />}
              {step === 2 && <Step2Display output={displayOutput as Step2Output} />}
              {step === 3 && (
                <>
                  {pitches && (
                    <Step3PitchCards
                      pitches={pitches}
                      selected={selectedPitch}
                      onSelect={onSelectPitch}
                    />
                  )}
                  {!pitches && displayOutput?.pitches && (
                    <Step3PitchCards
                      pitches={displayOutput.pitches}
                      selected={selectedPitch}
                      onSelect={onSelectPitch}
                    />
                  )}
                  {!selectedPitch && (
                    <p className="text-xs text-amber-600 text-center">Select a story pitch above to approve</p>
                  )}
                </>
              )}
              {step === 4 && <Step4Display output={displayOutput as Step4Output} />}

              {/* Action buttons */}
              {!isDone && (
                <div className="flex gap-2 flex-wrap pt-1">
                  <button
                    onClick={onApprove}
                    disabled={sending || (isStep3 && !selectedPitch)}
                    className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition"
                  >
                    {sending ? 'Saving...' : '✓ Approve →'}
                  </button>
                  <button
                    onClick={onRerun}
                    disabled={sending || running}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-40 transition"
                  >
                    ↺ Re-run
                  </button>
                </div>
              )}

              {/* Approved — show reset option */}
              {isDone && (
                <div className="pt-1">
                  {!resetConfirm ? (
                    <button
                      onClick={onResetRequest}
                      className="text-xs text-gray-400 hover:text-red-500 transition"
                    >
                      Reset from this step
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                      <p className="text-xs text-red-700 flex-1">
                        ⚠️ This will clear steps {step}–4 and let you re-run from here.
                      </p>
                      <button onClick={onResetConfirm} className="text-xs font-semibold text-red-600 hover:text-red-800">Yes, reset</button>
                      <button onClick={onResetCancel}  className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Workflow Page ────────────────────────────────────────────────────

export default function MegaWorkflowPage({ params }: { params: { id: string } }) {
  const router  = useRouter()
  const supabase = createClient()

  const [workflow, setWorkflow]     = useState<MegaWorkflow | null>(null)
  const [loading, setLoading]       = useState(true)
  const [token, setToken]           = useState<string | null>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Per-step state
  const [stepRunning, setStepRunning]       = useState<number | null>(null)
  const [stepSending, setStepSending]       = useState<number | null>(null)
  const [stepRaw, setStepRaw]               = useState<Record<number, any>>({})
  const [stepExpanded, setStepExpanded]     = useState<Record<number, boolean>>({})
  const [resetConfirm, setResetConfirm]     = useState<number | null>(null)

  // Step 3 pitch selection
  const [pitches, setPitches]               = useState<StoryPitch[] | null>(null)
  const [selectedPitch, setSelectedPitch]   = useState<StoryPitch | null>(null)

  // ── Auth + load ─────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setToken(session.access_token)
      await loadWorkflow(session.access_token)
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadWorkflow = useCallback(async (tok?: string) => {
    const t = tok ?? token
    if (!t) return
    try {
      const res = await fetch(`/api/mega/${params.id}`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      const data = await res.json()
      if (data.ok) setWorkflow(data.workflow)
      else setNotification({ message: data.error ?? 'Failed to load workflow', type: 'error' })
    } catch (err: any) {
      setNotification({ message: err.message, type: 'error' })
    }
  }, [params.id, token])

  // ── Run agent ───────────────────────────────────────────────────────
  async function handleRun(step: number) {
    if (!token) return
    setStepRunning(step)
    try {
      const res = await fetch(`/api/mega/${params.id}/step/${step}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Agent failed')
      // Store raw output — step 3 special: extract pitches
      setStepRaw(prev => ({ ...prev, [step]: data.raw }))
      if (step === 3 && data.raw?.pitches) {
        setPitches(data.raw.pitches)
        setSelectedPitch(null)
      }
    } catch (err: any) {
      setNotification({ message: `Step ${step} failed: ${err.message}`, type: 'error' })
    } finally {
      setStepRunning(null)
    }
  }

  // ── Approve step ────────────────────────────────────────────────────
  async function handleApprove(step: number) {
    if (!token) return
    setStepSending(step)

    let body: any = stepRaw[step] ?? (workflow as any)?.[`step${step}_raw`]

    // Step 3: wrap selected pitch + all pitches
    if (step === 3) {
      const allPitches = pitches ?? (workflow as any)?.step3_raw?.pitches ?? []
      body = { selected_pitch: selectedPitch, all_pitches: allPitches }
    }

    try {
      const res = await fetch(`/api/mega/${params.id}/step/${step}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error && data.error !== 'already_resolved')
        throw new Error(data.error)
      // Clear local raw (approved version is now in DB)
      setStepRaw(prev => { const n = { ...prev }; delete n[step]; return n })
      await loadWorkflow()
    } catch (err: any) {
      setNotification({ message: `Approve failed: ${err.message}`, type: 'error' })
    } finally {
      setStepSending(null)
    }
  }

  // ── Reset from step ─────────────────────────────────────────────────
  async function handleReset(fromStep: number) {
    if (!token) return
    try {
      const res = await fetch(`/api/mega/${params.id}/step/${fromStep}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reset', from_step: fromStep }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Reset failed')
      // Clear local state for reset steps
      setStepRaw(prev => {
        const n = { ...prev }
        for (let s = fromStep; s <= 4; s++) delete n[s]
        return n
      })
      if (fromStep <= 3) { setPitches(null); setSelectedPitch(null) }
      setResetConfirm(null)
      await loadWorkflow()
    } catch (err: any) {
      setNotification({ message: err.message, type: 'error' })
    }
  }

  if (loading || !workflow) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading workflow...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">

        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}

        {/* Back */}
        <button
          onClick={() => router.push('/admin/mega-materials')}
          className="text-sm text-gray-400 hover:text-gray-600 mb-5 flex items-center gap-1"
        >
          ← All Megas
        </button>

        {/* Challenge anchor — always visible */}
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 mb-6 shadow-sm">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Challenge</p>
          <p className="font-bold text-gray-900">{workflow.challenge_title}</p>
          {workflow.challenge_body && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{workflow.challenge_body}</p>
          )}
          {workflow.challenge_image_url && (
            <p className="text-xs text-indigo-500 mt-1">📷 Has image — vision will be used in Step 1</p>
          )}
        </div>

        {/* Progress stepper */}
        <StepStepper status={workflow.status} />

        {/* Step panels */}
        {[1, 2, 3, 4].map(step => (
          <StepPanel
            key={step}
            step={step}
            workflow={workflow}
            rawOutput={stepRaw[step] ?? null}
            pitches={step === 3 ? (pitches ?? null) : null}
            selectedPitch={step === 3 ? selectedPitch : null}
            running={stepRunning === step}
            sending={stepSending === step}
            expanded={!!stepExpanded[step]}
            resetConfirm={resetConfirm === step}
            onRun={() => handleRun(step)}
            onApprove={() => handleApprove(step)}
            onSelectPitch={p => setSelectedPitch(p)}
            onRerun={() => handleRun(step)}
            onToggleExpand={() => setStepExpanded(prev => ({ ...prev, [step]: !prev[step] }))}
            onResetRequest={() => setResetConfirm(step)}
            onResetConfirm={() => handleReset(step)}
            onResetCancel={() => setResetConfirm(null)}
          />
        ))}

        {/* Completed banner */}
        {workflow.status === 'completed' && (
          <div className="mt-4 p-5 bg-green-50 rounded-2xl border-2 border-green-200 text-center">
            <p className="text-2xl mb-2">🎉</p>
            <p className="font-bold text-green-800">Mega complete!</p>
            <p className="text-sm text-green-600 mt-1">All 4 steps approved. The teaching material is ready.</p>
          </div>
        )}
      </div>
    </div>
  )
}
