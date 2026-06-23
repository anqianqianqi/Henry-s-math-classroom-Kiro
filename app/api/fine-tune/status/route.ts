/**
 * GET /api/fine-tune/status
 *
 * Returns the status of the most recent fine-tune job.
 * Also syncs status from OpenAI back to our DB if it changed.
 *
 * Response:
 *   { job: { id, openai_job_id, status, model_id, examples_count, created_at } | null }
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Map OpenAI fine-tune status → our DB status
function mapStatus(openaiStatus: string): string {
  switch (openaiStatus) {
    case 'validating_files':
    case 'queued':
    case 'running':
      return 'training'
    case 'succeeded':
      return 'ready'
    case 'failed':
    case 'cancelled':
      return 'failed'
    default:
      return 'pending'
  }
}

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Auth check ────────────────────────────────────────────────────────────
    const { data: roles } = await supabase
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', session.user.id)
      .is('class_id', null)

    const isTeacher = (roles as any[])?.some((r: any) =>
      r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
    )
    if (!isTeacher) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // ── Load most recent job from DB ──────────────────────────────────────────
    const { data: jobs, error: dbErr } = await supabase
      .from('ai_grading_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    const job = jobs?.[0] ?? null
    if (!job) return NextResponse.json({ job: null })

    // If already terminal, no need to poll OpenAI
    if (job.status === 'ready' || job.status === 'failed') {
      return NextResponse.json({ job })
    }

    // ── Poll OpenAI for latest status ─────────────────────────────────────────
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ job })  // return DB state if no key

    const res = await fetch(`https://api.openai.com/v1/fine_tuning/jobs/${job.openai_job_id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) return NextResponse.json({ job })  // return DB state on OpenAI error

    const ftData = await res.json()
    const newStatus = mapStatus(ftData.status)
    const modelId: string | null = ftData.fine_tuned_model ?? null

    // Update DB if status changed
    if (newStatus !== job.status || (modelId && modelId !== job.model_id)) {
      await supabase
        .from('ai_grading_config')
        .update({ status: newStatus, model_id: modelId, updated_at: new Date().toISOString() })
        .eq('id', job.id)

      return NextResponse.json({
        job: { ...job, status: newStatus, model_id: modelId },
      })
    }

    return NextResponse.json({ job })

  } catch (e: any) {
    console.error('fine-tune/status error:', e)
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 })
  }
}
