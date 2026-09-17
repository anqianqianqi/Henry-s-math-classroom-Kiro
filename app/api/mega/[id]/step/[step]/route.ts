/**
 * POST  /api/mega/[id]/step/[step]  — run the AI agent for that step
 * PATCH /api/mega/[id]/step/[step]  — approve Henry's output / reset
 *
 * POST saves raw output but does NOT advance status.
 * PATCH saves approved output and advances status (optimistic lock).
 * PATCH with { action: 'reset', from_step: N } clears steps N–4.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runStep1, runStep2, runStep3, runStep4 } from '@/lib/mega/agents'
import type { Step1Output, Step2Output, StoryPitch } from '@/lib/mega/types'
import { STEP_PENDING, STEP_DONE, RESET_STATUS } from '@/lib/mega/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const OPENAI_KEY   = process.env.OPENAI_API_KEY!

export const maxDuration = 120

async function authenticateTeacher(req: NextRequest): Promise<{ userId: string } | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return null

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const supabaseUser = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return null

  const { data: roles } = await supabase
    .from('user_roles').select('roles!inner(name)').eq('user_id', user.id).is('class_id', null)
  const isTeacher = (roles as any[])?.some((r: any) =>
    ['teacher', 'administrator'].includes(r.roles?.name)
  )
  return isTeacher ? { userId: user.id } : null
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; step: string } }
) {
  const auth = await authenticateTeacher(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stepNum = parseInt(params.step)
  if (![1, 2, 3, 4].includes(stepNum))
    return NextResponse.json({ error: 'Invalid step — must be 1, 2, 3, or 4' }, { status: 400 })

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data: wf, error: wfErr } = await supabase
    .from('mega_workflows').select('*').eq('id', params.id).single()
  if (wfErr || !wf) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
  if (wf.created_by !== auth.userId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (stepNum >= 2 && !wf.step1_output)
    return NextResponse.json({ error: 'Step 1 must be approved first' }, { status: 400 })
  if (stepNum >= 3 && !wf.step2_output)
    return NextResponse.json({ error: 'Step 2 must be approved first' }, { status: 400 })
  if (stepNum === 4 && !(wf.step3_output as any)?.selected_pitch)
    return NextResponse.json({ error: 'Step 3 must be approved with a selected pitch first' }, { status: 400 })

  try {
    let rawOutput: any

    switch (stepNum) {
      case 1:
        rawOutput = await runStep1(wf.challenge_title, wf.challenge_body, wf.challenge_image_url ?? null, OPENAI_KEY)
        break
      case 2:
        rawOutput = await runStep2(wf.challenge_title, wf.challenge_body, wf.step1_output as Step1Output, OPENAI_KEY)
        break
      case 3: {
        const pitches = await runStep3(wf.challenge_title, wf.challenge_body, wf.step1_output as Step1Output, wf.step2_output as Step2Output, OPENAI_KEY)
        rawOutput = { pitches }
        break
      }
      case 4:
        rawOutput = await runStep4(
          wf.challenge_title, wf.challenge_body,
          wf.step1_output as Step1Output,
          wf.step2_output as Step2Output,
          (wf.step3_output as any).selected_pitch as StoryPitch,
          OPENAI_KEY,
        )
        break
    }

    await supabase.from('mega_workflows').update({ [`step${stepNum}_raw`]: rawOutput }).eq('id', params.id)
    return NextResponse.json({ ok: true, raw: rawOutput })
  } catch (err: any) {
    console.error(`Mega step ${stepNum} error:`, err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; step: string } }
) {
  const auth = await authenticateTeacher(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // ── Reset ─────────────────────────────────────────────────────────────
  if (body.action === 'reset') {
    const fromStep = body.from_step as number
    if (![2, 3, 4].includes(fromStep))
      return NextResponse.json({ error: 'Can only reset from step 2, 3, or 4' }, { status: 400 })

    const clearFields: Record<string, null> = {}
    for (let s = fromStep; s <= 4; s++) {
      clearFields[`step${s}_output`] = null
      clearFields[`step${s}_raw`]    = null
    }
    const { error } = await supabase
      .from('mega_workflows')
      .update({ ...clearFields, status: RESET_STATUS[fromStep] })
      .eq('id', params.id)
      .eq('created_by', auth.userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: RESET_STATUS[fromStep] })
  }

  // ── Approve ───────────────────────────────────────────────────────────
  const stepNum = parseInt(params.step)
  if (![1, 2, 3, 4].includes(stepNum))
    return NextResponse.json({ error: 'Invalid step' }, { status: 400 })

  if (stepNum === 3) {
    const p = body.selected_pitch
    if (!p?.title || !p?.character || !p?.scenario || !p?.why_it_works)
      return NextResponse.json({ error: 'step3 requires selected_pitch with title, character, scenario, why_it_works' }, { status: 400 })
    if (!Array.isArray(body.all_pitches))
      return NextResponse.json({ error: 'step3 requires all_pitches array' }, { status: 400 })
  }

  const outputField   = `step${stepNum}_output`
  const newStatus     = STEP_DONE[stepNum]
  const pendingStatus = STEP_PENDING[stepNum]

  // Optimistic lock
  const { data: updated, error } = await supabase
    .from('mega_workflows')
    .update({ [outputField]: body, status: newStatus })
    .eq('id', params.id)
    .eq('status', pendingStatus)
    .eq('created_by', auth.userId)
    .select('id, status')
    .single()

  if (error || !updated) {
    // Check current state
    const { data: current } = await supabase
      .from('mega_workflows').select('status').eq('id', params.id).single()

    const currentStatus = (current as any)?.status as string | undefined

    if (currentStatus === newStatus) {
      return NextResponse.json({ ok: true, status: newStatus })
    }

    if (currentStatus) {
      // Allow overwrite of an already-approved step (Henry re-running)
      const { error: overwriteErr } = await supabase
        .from('mega_workflows')
        .update({ [outputField]: body })
        .eq('id', params.id)
        .eq('created_by', auth.userId)
      if (overwriteErr) return NextResponse.json({ error: overwriteErr.message }, { status: 500 })
      return NextResponse.json({ ok: true, status: currentStatus })
    }

    return NextResponse.json({ error: 'already_resolved' }, { status: 409 })
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
