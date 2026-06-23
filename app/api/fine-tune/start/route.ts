/**
 * POST /api/fine-tune/start
 *
 * Triggered by Henry clicking "Launch Fine-tune Job".
 * Flow:
 *   1. Auth + teacher role check
 *   2. Query DB for up to MAX_EXAMPLES graded submissions with teacher comments
 *   3. Build JSONL in memory (never persisted to our DB)
 *   4. Upload JSONL to OpenAI Files API
 *   5. Start fine-tune job on gpt-4o-mini
 *   6. Save job metadata to ai_grading_config
 *   7. Return { jobId, fileId, examplesCount }
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const MAX_EXAMPLES = 50

const SYSTEM_PROMPT =
  "You are writing as Henry, a math teacher giving quick casual feedback to students — like texting. " +
  "Short, direct, no fluff. Not formal. Match the tone of the examples exactly. " +
  "End your response with: Points: <number>"

export async function POST() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Auth: teacher / administrator only ────────────────────────────────────
    const { data: roles } = await supabase
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', session.user.id)
      .is('class_id', null)

    const isTeacher = (roles as any[])?.some((r: any) =>
      r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
    )
    if (!isTeacher) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    // ── Step 1: Load graded submissions ───────────────────────────────────────
    const { data: submissions, error: subErr } = await supabase
      .from('challenge_submissions')
      .select(`
        id,
        user_id,
        content,
        points,
        submitted_at,
        daily_challenges:challenge_id (
          title,
          description
        )
      `)
      .not('points', 'is', null)
      .order('submitted_at', { ascending: false })
      .limit(MAX_EXAMPLES * 3)  // fetch more than needed; we filter below

    if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })
    if (!submissions || submissions.length === 0) {
      return NextResponse.json({ error: 'No graded submissions found in DB. Grade some submissions first.' }, { status: 400 })
    }

    const submissionIds = (submissions as any[]).map((s: any) => s.id)

    // ── Step 2: Load all comments for those submissions ───────────────────────
    const { data: commentsRaw, error: commentErr } = await supabase
      .from('submission_comments')
      .select('id, submission_id, user_id, content, created_at')
      .in('submission_id', submissionIds)
      .order('created_at', { ascending: true })

    if (commentErr) return NextResponse.json({ error: commentErr.message }, { status: 500 })

    // ── Step 3: Identify teacher user IDs ─────────────────────────────────────
    const commenterIds = [...new Set((commentsRaw ?? []).map((c: any) => c.user_id as string))]
    let teacherIds = new Set<string>()

    if (commenterIds.length > 0) {
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id, roles!inner(name)')
        .in('user_id', commenterIds)
        .is('class_id', null)

      for (const row of (roleRows ?? []) as any[]) {
        if (row.roles?.name === 'teacher' || row.roles?.name === 'administrator') {
          teacherIds.add(row.user_id)
        }
      }
    }

    // Group comments by submission, tagging each as teacher or student
    const commentsBySubmission: Record<string, Array<{ content: string; isTeacher: boolean }>> = {}
    for (const c of (commentsRaw ?? []) as any[]) {
      if (!commentsBySubmission[c.submission_id]) commentsBySubmission[c.submission_id] = []
      commentsBySubmission[c.submission_id].push({
        content: c.content as string,
        isTeacher: teacherIds.has(c.user_id as string),
      })
    }

    // ── Step 4: Build JSONL lines ─────────────────────────────────────────────
    const lines: string[] = []

    for (const sub of submissions as any[]) {
      if (lines.length >= MAX_EXAMPLES) break

      const thread = commentsBySubmission[sub.id]
      if (!thread || thread.length === 0) continue
      if (!thread.some(t => t.isTeacher)) continue  // need at least one teacher turn

      const challenge = sub.daily_challenges
      const title = challenge?.title ?? 'Math Challenge'
      const desc  = challenge?.description ?? ''

      // Build messages array
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            `Challenge: ${title}\n` +
            (desc ? `Description: ${desc}\n` : '') +
            `\nStudent's answer:\n${sub.content}`,
        },
      ]

      // Interleave thread: teacher → assistant, student → user
      for (const comment of thread) {
        messages.push({
          role: comment.isTeacher ? 'assistant' : 'user',
          content: comment.content,
        })
      }

      // Training example must end with assistant turn
      if (messages[messages.length - 1].role !== 'assistant') continue

      // Append grade to last assistant message
      const lastIdx = messages.length - 1
      messages[lastIdx] = {
        ...messages[lastIdx],
        content: messages[lastIdx].content + `\nPoints: ${sub.points}`,
      }

      lines.push(JSON.stringify({ messages }))
    }

    if (lines.length < 10) {
      return NextResponse.json({
        error: `Only ${lines.length} valid training examples found. OpenAI requires at least 10. Grade more submissions and add teacher comments first.`,
        count: lines.length,
      }, { status: 400 })
    }

    const jsonl = lines.join('\n')

    // ── Step 5: Upload JSONL to OpenAI Files API ──────────────────────────────
    const blob = new Blob([jsonl], { type: 'application/json' })
    const formData = new FormData()
    formData.append('purpose', 'fine-tune')
    formData.append('file', blob, 'training.jsonl')

    const uploadRes = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: `OpenAI file upload failed: ${err?.error?.message ?? uploadRes.statusText}` },
        { status: 502 }
      )
    }

    const uploadData = await uploadRes.json()
    const fileId: string = uploadData.id

    // ── Step 6: Start fine-tune job ───────────────────────────────────────────
    const ftRes = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        training_file: fileId,
        model: 'gpt-4o-mini-2024-07-18',
      }),
    })

    if (!ftRes.ok) {
      const err = await ftRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: `OpenAI fine-tune start failed: ${err?.error?.message ?? ftRes.statusText}` },
        { status: 502 }
      )
    }

    const ftData = await ftRes.json()
    const jobId: string = ftData.id

    // ── Step 7: Save job metadata to DB ──────────────────────────────────────
    const { error: insertErr } = await supabase
      .from('ai_grading_config')
      .insert({
        openai_job_id: jobId,
        openai_file_id: fileId,
        status: 'pending',
        examples_count: lines.length,
      })

    if (insertErr) {
      // Job is running on OpenAI — log the IDs in the response even if DB insert fails
      console.error('DB insert failed for fine-tune job:', insertErr.message)
    }

    return NextResponse.json({
      jobId,
      fileId,
      examplesCount: lines.length,
      message: `Fine-tune job started with ${lines.length} training examples. Training typically takes 15–30 minutes.`,
    })

  } catch (e: any) {
    console.error('fine-tune/start error:', e)
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 })
  }
}
