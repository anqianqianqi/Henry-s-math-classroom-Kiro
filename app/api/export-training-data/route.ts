import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/export-training-data
 *
 * Exports challenge submission conversations (Henry + students) as JSONL
 * for OpenAI fine-tuning on gpt-4o-mini.
 *
 * Only admin / teacher roles may call this endpoint.
 *
 * Each line = one training example in OpenAI chat fine-tune format:
 * {
 *   "messages": [
 *     { "role": "system",    "content": "..." },
 *     { "role": "user",      "content": "<challenge> + <student's initial answer>" },
 *     { "role": "assistant", "content": "<Henry's first comment>" },
 *     { "role": "user",      "content": "<student's reply>" },
 *     { "role": "assistant", "content": "<Henry's next comment>" },
 *     ...
 *   ]
 * }
 *
 * The full comment thread (all participants) is preserved in chronological
 * order, with teacher/admin comments mapped to "assistant" and student
 * comments mapped to "user".  This lets the model learn the full
 * conversational style, not just isolated grades.
 *
 * Inclusion rules:
 *   • Submission must have a non-null `points` value (Henry graded it)
 *   • Submission must have at least one comment from a teacher/admin user
 *   • Submissions with no comments at all are skipped (nothing to learn)
 */
export async function GET() {
  const supabase = createClient()

  // ── Auth check ────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify teacher / administrator role (global role, class_id IS NULL)
  const { data: roles } = await supabase
    .from('user_roles')
    .select('roles!inner(name)')
    .eq('user_id', user.id)
    .is('class_id', null)

  const isTeacher = (roles as any[])?.some((r: any) =>
    r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
  )
  if (!isTeacher) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Step 1: load graded submissions ──────────────────────────────────────
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
    .order('submitted_at', { ascending: true })

  if (subErr) {
    return NextResponse.json({ error: subErr.message }, { status: 500 })
  }
  if (!submissions || submissions.length === 0) {
    return emptyJSONL()
  }

  const submissionIds = submissions.map((s: any) => s.id)

  // ── Step 2: load ALL comments for those submissions ───────────────────────
  // Include the commenter's role so we can assign the correct turn label.
  // We join user_roles to get role name for each commenter.
  const { data: commentsRaw, error: commentErr } = await supabase
    .from('submission_comments')
    .select(`
      id,
      submission_id,
      user_id,
      content,
      created_at
    `)
    .in('submission_id', submissionIds)
    .order('created_at', { ascending: true })

  if (commentErr) {
    return NextResponse.json({ error: commentErr.message }, { status: 500 })
  }

  // ── Step 3: look up which user_ids are teachers / admins ──────────────────
  // Collect unique commenter user_ids and batch-check their roles once.
  const commenterIds = [...new Set((commentsRaw ?? []).map((c: any) => c.user_id as string))]
  let teacherSet = new Set<string>()

  if (commenterIds.length > 0) {
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('user_id, roles!inner(name)')
      .in('user_id', commenterIds)
      .is('class_id', null)

    for (const row of (roleRows ?? []) as any[]) {
      if (row.roles?.name === 'teacher' || row.roles?.name === 'administrator') {
        teacherSet.add(row.user_id)
      }
    }
  }

  // Group comments by submission_id, preserving chronological order
  const commentsBySubmission: Record<string, Array<{ content: string; isTeacher: boolean }>> = {}
  for (const c of (commentsRaw ?? []) as any[]) {
    if (!commentsBySubmission[c.submission_id]) {
      commentsBySubmission[c.submission_id] = []
    }
    commentsBySubmission[c.submission_id].push({
      content: c.content as string,
      isTeacher: teacherSet.has(c.user_id as string),
    })
  }

  // ── Step 4: build JSONL ───────────────────────────────────────────────────
  const SYSTEM_PROMPT =
    "You are Henry's math grading assistant. " +
    "You help Henry grade student challenge submissions and communicate with students " +
    "in Henry's encouraging, concise teaching style. " +
    "When given a math challenge and a student's answer, provide feedback and a point score. " +
    "When continuing a conversation, respond as Henry would — supportive and to the point."

  const lines: string[] = []

  for (const sub of submissions as any[]) {
    const thread = commentsBySubmission[sub.id]

    // Skip submissions with no comments at all — nothing for the model to learn
    if (!thread || thread.length === 0) continue

    // Must have at least one teacher comment (otherwise we have no "answer" to train on)
    if (!thread.some(t => t.isTeacher)) continue

    const challenge = sub.daily_challenges
    const challengeTitle = challenge?.title ?? 'Math Challenge'
    const challengeDesc  = challenge?.description ?? ''

    // Build message list
    // First turn: user = challenge context + student's initial submission
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content:
          `Challenge: ${challengeTitle}\n` +
          (challengeDesc ? `Description: ${challengeDesc}\n` : '') +
          `\nStudent's answer:\n${sub.content}`,
      },
    ]

    // Remaining turns: interleave comments in chronological order
    // teacher comment  → assistant
    // student comment  → user
    for (const comment of thread) {
      messages.push({
        role: comment.isTeacher ? 'assistant' : 'user',
        content: comment.content,
      })
    }

    // The final message in a training example must be from the assistant.
    // If the thread ends with a student comment (no teacher reply yet), skip —
    // we don't want the model to learn incomplete exchanges.
    if (messages[messages.length - 1].role !== 'assistant') continue

    // Also append the grade as the very last assistant token so the model
    // learns to output it alongside its comment.  Append to the last
    // assistant message rather than adding a separate turn.
    const lastIdx = messages.length - 1
    messages[lastIdx] = {
      ...messages[lastIdx],
      content: messages[lastIdx].content + `\nPoints: ${sub.points}`,
    }

    lines.push(JSON.stringify({ messages }))
  }

  const jsonl = lines.join('\n')

  return new Response(jsonl, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Content-Disposition': 'attachment; filename="henry-grading-training.jsonl"',
    },
  })
}

function emptyJSONL() {
  return new Response('', {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Content-Disposition': 'attachment; filename="henry-grading-training.jsonl"',
    },
  })
}
