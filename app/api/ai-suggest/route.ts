/**
 * POST /api/ai-suggest
 *
 * Generates an AI grading suggestion for a single submission using
 * few-shot prompting — no fine-tuning required.
 *
 * Body: { submissionId: string }
 *
 * Flow:
 *   1. Auth + teacher role check
 *   2. Load the target submission + its challenge
 *   3. Fetch up to 5 recent graded submissions with teacher comments (examples)
 *   4. Build few-shot prompt: system + examples + new submission
 *   5. Call gpt-4o (chat completions)
 *   6. Parse out suggested comment + points
 *   7. Return { suggestion, suggestedPoints }
 *
 * The suggestion is NOT auto-saved — Henry decides what to do with it.
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const NUM_EXAMPLES = 5

export async function POST(request: Request) {
  try {
    const { submissionId } = await request.json()
    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId is required' }, { status: 400 })
    }

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

    // ── Step 1: Load the target submission ────────────────────────────────────
    const { data: target, error: targetErr } = await supabase
      .from('challenge_submissions')
      .select(`
        id, content, points,
        daily_challenges:challenge_id ( title, description )
      `)
      .eq('id', submissionId)
      .single()

    if (targetErr || !target) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // ── Step 2: Fetch recent graded examples with teacher comments ─────────────
    // Get graded submissions (points IS NOT NULL), excluding the target itself
    const { data: candidates } = await supabase
      .from('challenge_submissions')
      .select(`
        id, content, points,
        daily_challenges:challenge_id ( title, description )
      `)
      .not('points', 'is', null)
      .neq('id', submissionId)
      .order('submitted_at', { ascending: false })
      .limit(NUM_EXAMPLES * 3)

    // For each candidate, try to get a teacher comment
    const exampleIds = (candidates ?? []).map((c: any) => c.id)
    let teacherIds = new Set<string>()
    let commentsMap: Record<string, string> = {}

    if (exampleIds.length > 0) {
      // Identify teacher user IDs from all commenters
      const { data: allComments } = await supabase
        .from('submission_comments')
        .select('id, submission_id, user_id, content, created_at')
        .in('submission_id', exampleIds)
        .order('created_at', { ascending: true })

      const commenterIds = [...new Set((allComments ?? []).map((c: any) => c.user_id as string))]
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

      // Pick the last teacher comment for each submission
      for (const c of (allComments ?? []) as any[]) {
        if (teacherIds.has(c.user_id)) {
          commentsMap[c.submission_id] = c.content  // last one wins (chronological order)
        }
      }
    }

    // Build examples: only those with a teacher comment
    const examples: Array<{ title: string; desc: string; answer: string; comment: string; points: number }> = []
    for (const sub of (candidates ?? []) as any[]) {
      if (examples.length >= NUM_EXAMPLES) break
      const teacherComment = commentsMap[sub.id]
      if (!teacherComment) continue
      examples.push({
        title: sub.daily_challenges?.title ?? 'Math Challenge',
        desc:  sub.daily_challenges?.description ?? '',
        answer: sub.content,
        comment: teacherComment,
        points: sub.points,
      })
    }

    // ── Step 3: Build the prompt ──────────────────────────────────────────────
    const targetChallenge = (target as any).daily_challenges
    const targetTitle = targetChallenge?.title ?? 'Math Challenge'
    const targetDesc  = targetChallenge?.description ?? ''

    const systemPrompt = `You are Henry's math grading assistant. Henry is an encouraging math teacher who gives concise, specific feedback. Study how Henry grades and communicates below, then grade the new submission in exactly the same style.

Always end your response with a line in this exact format:
Points: <number>`

    const exampleMessages: Array<{ role: string; content: string }> = []

    for (const ex of examples) {
      exampleMessages.push({
        role: 'user',
        content:
          `Challenge: ${ex.title}\n` +
          (ex.desc ? `Description: ${ex.desc}\n` : '') +
          `\nStudent's answer:\n${ex.answer}`,
      })
      exampleMessages.push({
        role: 'assistant',
        content: `${ex.comment}\nPoints: ${ex.points}`,
      })
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...exampleMessages,
      {
        role: 'user',
        content:
          `Challenge: ${targetTitle}\n` +
          (targetDesc ? `Description: ${targetDesc}\n` : '') +
          `\nStudent's answer:\n${(target as any).content}`,
      },
    ]

    // ── Step 4: Call OpenAI chat completions ──────────────────────────────────
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 300,
        temperature: 0.4,
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: `OpenAI error: ${err?.error?.message ?? openaiRes.statusText}` },
        { status: 502 }
      )
    }

    const openaiData = await openaiRes.json()
    const raw: string = openaiData.choices?.[0]?.message?.content ?? ''

    // ── Step 5: Parse suggested points from last line ─────────────────────────
    const lines = raw.trim().split('\n')
    let suggestedPoints: number | null = null
    let commentLines = lines

    const lastLine = lines[lines.length - 1].trim()
    const pointsMatch = lastLine.match(/^Points:\s*(\d+(?:\.\d+)?)$/i)
    if (pointsMatch) {
      suggestedPoints = parseFloat(pointsMatch[1])
      commentLines = lines.slice(0, -1)
    }

    const suggestion = commentLines.join('\n').trim()

    return NextResponse.json({
      suggestion,
      suggestedPoints,
      examplesUsed: examples.length,
    })

  } catch (e: any) {
    console.error('ai-suggest error:', e)
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 })
  }
}
