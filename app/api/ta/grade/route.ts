/**
 * POST /api/ta/grade
 *
 * Grades a single student challenge submission using the TA's 8-step
 * thinking protocol. Saves the suggested grade to `ta_grades` for
 * Henry to review.
 *
 * Body:
 *   { submission_id: string }
 *
 * Returns:
 *   { ok: true, grade: { suggested_score, max_score, confidence, comment, reasoning } }
 *
 * Auth: teacher/admin session token OR BOOTSTRAP_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const OPENAI_KEY   = process.env.OPENAI_API_KEY!
const TA_DIR       = join(process.cwd(), 'TA-agent')

// ── Load knowledge files (cached per cold start) ──────────────────────────

function readKnowledge(filename: string): string {
  try {
    return readFileSync(join(TA_DIR, filename), 'utf-8')
  } catch {
    return `(${filename} not found)`
  }
}

const GRADING_PROTOCOL   = readKnowledge('grading-protocol.md')
const GRADING_STYLE      = readKnowledge('grading-style.md')
const MATH_CORRECTNESS   = readKnowledge('math-correctness.md')
const CORRECTION_LOG_RAW = readKnowledge('correction-log.md')

// Use first 4000 chars of correction log to stay within context
const CORRECTION_LOG = CORRECTION_LOG_RAW.slice(0, 4000)

// ── System prompt ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Henry's math Teaching Assistant (TA). Your job is to grade student submissions exactly as Henry would.

You have four knowledge sources to guide you:

---
## GRADING PROTOCOL (8-step thinking process — follow this exactly, in order)
${GRADING_PROTOCOL}

---
## HENRY'S GRADING STYLE
${GRADING_STYLE}

---
## MATH CORRECTNESS RULES (fatal errors and valid approaches)
${MATH_CORRECTNESS}

---
## REAL EXAMPLES OF HENRY'S GRADES (correction log)
${CORRECTION_LOG}

---

IMPORTANT OUTPUT RULES:
- Output ONLY a valid JSON object, no markdown code blocks, no extra text
- The JSON must match this exact structure:
{
  "step1_math_understanding": "what the problem asks and correct solution",
  "step2_student_approach": "what the student did, described neutrally",
  "step3_deviation": "where exactly the student's path diverged, and why",
  "step4_henry_perspective": "what henry would see — what's right, what's the gap",
  "step5_path_continuation": "if we follow the student's method correctly, does it work?",
  "step6_better_solution": "optional: more elegant approach (empty string if none)",
  "score": <integer>,
  "max_score": <integer>,
  "confidence": <float 0.0-1.0>,
  "comment": "the comment henry would write to the student"
}`

// ── OpenAI call ───────────────────────────────────────────────────────────

async function callGPT(userMessage: string): Promise<any> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
      max_tokens: 1500,
      temperature: 0.2,  // Low temperature for consistent grading
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const raw = data.choices[0].message.content as string

  // Strip markdown code blocks if GPT wraps in them despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error(`GPT returned non-JSON: ${raw.slice(0, 200)}`)
  }
}

// ── Route handler ─────────────────────────────────────────────────────────

export const maxDuration = 60  // 60s timeout for Vercel

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const bootstrapSecret = process.env.BOOTSTRAP_SECRET
  const isSecretAuth = bootstrapSecret && token === bootstrapSecret

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  if (!isSecretAuth) {
    const supabaseUser = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const { data: roles } = await supabase
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', user.id)
      .is('class_id', null)

    const isTeacher = (roles as any[])?.some((r: any) =>
      ['teacher', 'administrator'].includes(r.roles?.name)
    )
    if (!isTeacher) return NextResponse.json({ error: 'Teacher only' }, { status: 403 })
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: { submission_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { submission_id } = body
  if (!submission_id) {
    return NextResponse.json({ error: 'submission_id is required' }, { status: 400 })
  }

  try {
    // ── Fetch submission + challenge ────────────────────────────────────
    const { data: submission, error: subError } = await supabase
      .from('challenge_submissions')
      .select(`
        id, user_id, content, image_url, points, submitted_at,
        challenge_id,
        daily_challenges:challenge_id(
          id, title, description, max_points, source_bank_id
        )
      `)
      .eq('id', submission_id)
      .single()

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    const challenge = (submission as any).daily_challenges
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // If source_bank_id, get bank item for better title/description
    let problemTitle = challenge.title
    let problemDescription = challenge.description
    let maxPoints = challenge.max_points ?? 100

    if (challenge.source_bank_id) {
      const { data: bankItem } = await supabase
        .from('challenge_bank')
        .select('title, description, max_points')
        .eq('id', challenge.source_bank_id)
        .single()
      if (bankItem) {
        problemTitle = bankItem.title
        problemDescription = bankItem.description
        maxPoints = bankItem.max_points ?? maxPoints
      }
    }

    // ── Build the user message ─────────────────────────────────────────
    const submissionText = (submission as any).content || ''
    const hasImage = !!(submission as any).image_url

    const userMessage = [
      `Problem: ${problemTitle}`,
      problemDescription ? `Problem description: ${problemDescription}` : null,
      `Max points: ${maxPoints}`,
      ``,
      `Student submission:`,
      submissionText || '(no text — student submitted an image)',
      hasImage ? `[Note: Student also submitted an image. Treat this as a potentially complete answer.]` : null,
    ].filter(Boolean).join('\n')

    // ── Call GPT ───────────────────────────────────────────────────────
    const result = await callGPT(userMessage)

    // Validate required fields
    if (typeof result.score !== 'number' || typeof result.confidence !== 'number') {
      throw new Error('GPT response missing required score or confidence fields')
    }

    // Clamp score to valid range
    const score    = Math.max(0, Math.min(maxPoints, Math.round(result.score)))
    const confidence = Math.max(0, Math.min(1, result.confidence))

    // ── Save to ta_grades ──────────────────────────────────────────────
    const { data: saved, error: saveError } = await supabase
      .from('ta_grades')
      .upsert({
        submission_id,
        challenge_id:       (submission as any).challenge_id,
        student_id:         (submission as any).user_id,
        suggested_score:    score,
        max_score:          maxPoints,
        confidence,
        suggested_comment:  result.comment || '',
        reasoning: {
          step1_math_understanding: result.step1_math_understanding,
          step2_student_approach:   result.step2_student_approach,
          step3_deviation:          result.step3_deviation,
          step4_henry_perspective:  result.step4_henry_perspective,
          step5_path_continuation:  result.step5_path_continuation,
          step6_better_solution:    result.step6_better_solution,
        },
        status: 'pending',
      }, {
        onConflict: 'submission_id',
      })
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save ta_grade:', saveError)
      // Still return the result even if save failed
    }

    return NextResponse.json({
      ok: true,
      grade: {
        id:               (saved as any)?.id,
        suggested_score:  score,
        max_score:        maxPoints,
        confidence,
        comment:          result.comment,
        reasoning:        result,
        high_confidence:  confidence >= 0.85,
      },
    })

  } catch (err: any) {
    console.error('TA grading error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
