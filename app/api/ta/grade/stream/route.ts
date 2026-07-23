/**
 * GET /api/ta/grade/stream?submission_id=...
 *
 * Server-Sent Events (SSE) endpoint for real-time TA grading progress.
 * Streams step completion events as each agent finishes, so the client
 * can show a live progress bar.
 *
 * Events emitted:
 *   { type: "step", step: 1, label: "...", pct: 10 }
 *   { type: "step", step: 2, label: "...", pct: 40 }
 *   { type: "step", step: 3, label: "...", pct: 70 }
 *   { type: "step", step: 4, label: "...", pct: 90 }
 *   { type: "done",  grade: { ...full result... } }
 *   { type: "error", message: "..." }
 *
 * Also supports test_mode via query params:
 *   ?test_mode=1&problem_title=...&student_submission=...&max_points=3
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const OPENAI_KEY   = process.env.OPENAI_API_KEY!
const TA_DIR       = join(process.cwd(), 'TA-agent')

export const maxDuration = 120

// ── Knowledge helpers ─────────────────────────────────────────────────────

function readKnowledge(filename: string): string {
  try { return readFileSync(join(TA_DIR, filename), 'utf-8') } catch { return `(${filename} not found)` }
}
function readTopicFile(slug: string, fname: string): string {
  const p = join(TA_DIR, 'topics', slug, fname)
  try { return existsSync(p) ? readFileSync(p, 'utf-8') : '' } catch { return '' }
}

const GRADING_PROTOCOL = readKnowledge('grading-protocol.md')
const GRADING_STYLE    = readKnowledge('grading-style.md')
const MATH_CORRECTNESS = readKnowledge('math-correctness.md')
const CORRECTION_LOG   = readKnowledge('correction-log.md').slice(0, 4000)

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'equation-solving': ['解方程','方程化简','方程','solve','equation','求解','化简','求x','求a','求b','找x','找a'],
}

function classifyTopic(title: string, desc: string): string | null {
  const text = (title + ' ' + desc).toLowerCase()
  for (const [slug, kws] of Object.entries(TOPIC_KEYWORDS)) {
    if (kws.some(kw => text.includes(kw.toLowerCase()))) return slug
  }
  return null
}

function buildSystemPrompt(topicSlug: string | null): string {
  const topicSection = topicSlug ? `\n---\n## TOPIC MATH KNOWLEDGE\n${readTopicFile(topicSlug, 'math-knowledge.md')}\n\n---\n## TOPIC GRADING RULES\n${readTopicFile(topicSlug, 'grading-rules.md')}\n---` : ''
  return `You are Henry's math Teaching Assistant. Grade submissions exactly as Henry would.

## GRADING PROTOCOL
${GRADING_PROTOCOL}

## HENRY'S GRADING STYLE
${GRADING_STYLE}

## MATH CORRECTNESS RULES
${MATH_CORRECTNESS}

## REAL EXAMPLES OF HENRY'S GRADES
${CORRECTION_LOG}
${topicSection}

IMPORTANT: Output ONLY valid JSON — no markdown, no code blocks:
{
  "suggested_solution": "The TA's own clean solution to this problem (2-4 sentences, written as if explaining to a student)",
  "step1_math_understanding": "...",
  "step2_student_approach": "...",
  "step3_deviation": "where student went wrong, or null if correct",
  "step4_henry_perspective": "...",
  "step5_path_continuation": "...",
  "score": <int>,
  "max_score": <int>,
  "confidence": <float 0-1>,
  "comment": "Henry's comment to the student",
  "failed_at_step": "free text or null",
  "topic_module_used": "${topicSlug ?? null}"
}`
}

const CRITIC_PROMPT = `You are a senior math educator reviewing a TA's draft grade. Challenge it.
Ask: Did the TA read the student charitably? Is the grade proportional? Is the score consistent with the reasoning?
Output ONLY valid JSON:
{
  "upheld": <bool>,
  "final_score": <int>,
  "critic_reasoning": "...",
  "what_student_actually_did": "...",
  "revised_comment": ""
}`

const ANQI_PROMPT = `You are Anqi, reviewing whether the TA's comment will actually help the student learn.
Ask: Does it acknowledge the good idea first? Does it ask a question rather than give the answer? Is there a deeper question worth adding?
Output ONLY valid JSON:
{
  "upheld": <bool>,
  "comment_assessment": "helpful|too_vague|too_direct|misses_opportunity",
  "revised_comment": "",
  "anqi_question": "deeper question Henry could ask the student",
  "what_ta_missed": null
}`

async function callGPT(system: string, user: string, maxTokens = 1200): Promise<any> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTokens, temperature: 0.2 }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const raw = (await res.json()).choices[0].message.content as string
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  return JSON.parse(cleaned)
}

// ── SSE helper ────────────────────────────────────────────────────────────

function sseEvent(controller: ReadableStreamDefaultController, data: object) {
  const encoded = new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
  controller.enqueue(encoded)
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const submissionId = searchParams.get('submission_id')
  const testMode     = searchParams.get('test_mode') === '1'
  const token        = req.headers.get('authorization')?.replace('Bearer ', '') || searchParams.get('token') || ''
  const bootstrapSecret = process.env.BOOTSTRAP_SECRET

  // Auth
  const isSecretAuth = bootstrapSecret && token === bootstrapSecret
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  if (!isSecretAuth && !testMode) {
    const supabaseUser = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  // Collect problem info
  let problemTitle = '', problemDesc = '', studentSubmission = '', maxPoints = 3, realSubmissionId = submissionId

  if (testMode) {
    problemTitle       = searchParams.get('problem_title') || ''
    problemDesc        = searchParams.get('problem_description') || ''
    studentSubmission  = searchParams.get('student_submission') || ''
    maxPoints          = parseInt(searchParams.get('max_points') || '3')
  } else if (submissionId) {
    const { data: sub } = await supabase
      .from('challenge_submissions')
      .select('id, user_id, content, image_url, challenge_id, daily_challenges:challenge_id(title, description, max_points, source_bank_id)')
      .eq('id', submissionId)
      .single()

    if (!sub) return new Response('Submission not found', { status: 404 })

    const ch = (sub as any).daily_challenges
    problemTitle      = ch?.title || ''
    problemDesc       = ch?.description || ''
    maxPoints         = ch?.max_points ?? 100
    studentSubmission = (sub as any).content || ''
    realSubmissionId  = sub.id

    // Try to get richer info from bank item
    if (ch?.source_bank_id) {
      const { data: bi } = await supabase.from('challenge_bank').select('title, description, max_points').eq('id', ch.source_bank_id).single()
      if (bi) { problemTitle = bi.title; problemDesc = bi.description; maxPoints = bi.max_points ?? maxPoints }
    }
  } else {
    return new Response('submission_id required', { status: 400 })
  }

  const topicSlug   = classifyTopic(problemTitle, problemDesc)
  const systemPrompt = buildSystemPrompt(topicSlug)
  const userMessage  = [`Problem: ${problemTitle}`, problemDesc ? `Description: ${problemDesc}` : null, `Max points: ${maxPoints}`, ``, `Student submission:`, studentSubmission || '(image only — treat as potentially complete)'].filter(Boolean).join('\n')

  // Stream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1 — topic classification (instant)
        sseEvent(controller, { type: 'step', step: 1, pct: 8, label: topicSlug ? `Topic: ${topicSlug} ✓` : 'General math problem' })

        // Step 2 — TA grades
        sseEvent(controller, { type: 'step', step: 2, pct: 15, label: 'TA solving and reading student work...' })
        const draft = await callGPT(systemPrompt, userMessage, 1500)
        const draftScore = Math.max(0, Math.min(maxPoints, Math.round(draft.score ?? 0)))
        sseEvent(controller, { type: 'step', step: 2, pct: 50, label: `TA grade: ${draftScore}/${maxPoints} (${Math.round((draft.confidence ?? 0.7) * 100)}% confident)` })

        // Step 3 — Critic
        sseEvent(controller, { type: 'step', step: 3, pct: 52, label: 'Critic checking the grade...' })
        let criticResult: any = null
        try {
          const criticUser = [`Problem: ${problemTitle}`, `Max: ${maxPoints}`, `Student: ${studentSubmission}`, ``, `TA draft: Score ${draftScore}/${maxPoints}`, `TA's read: "${draft.step2_student_approach}"`, `TA's deviation: "${draft.step3_deviation}"`, `TA's comment: "${draft.comment}"`].join('\n')
          criticResult = await callGPT(CRITIC_PROMPT, criticUser, 600)
        } catch (_) {}
        const gradeChanged = criticResult && !criticResult.upheld && typeof criticResult.final_score === 'number' && criticResult.final_score !== draftScore
        const finalScore = gradeChanged ? Math.max(0, Math.min(maxPoints, Math.round(criticResult.final_score))) : draftScore
        sseEvent(controller, { type: 'step', step: 3, pct: 75, label: gradeChanged ? `Critic revised: ${draftScore}→${finalScore}` : 'Critic upheld grade ✓' })

        // Step 4 — Anqi
        sseEvent(controller, { type: 'step', step: 4, pct: 77, label: 'Anqi reviewing the comment...' })
        let anqiResult: any = null
        try {
          const baseComment = (gradeChanged && criticResult?.revised_comment) ? criticResult.revised_comment : (draft.comment || '')
          const anqiUser = [`Problem: ${problemTitle}`, `Student: ${studentSubmission}`, ``, `TA comment: "${baseComment}"`, `Grade: ${finalScore}/${maxPoints}`].join('\n')
          anqiResult = await callGPT(ANQI_PROMPT, anqiUser, 600)
        } catch (_) {}

        const baseConf = Math.max(0, Math.min(1, draft.confidence ?? 0.7))
        const finalConf = gradeChanged ? Math.max(0.5, baseConf - 0.2) : baseConf
        const baseComment = (gradeChanged && criticResult?.revised_comment) ? criticResult.revised_comment : (draft.comment || '')
        const finalComment = (anqiResult && !anqiResult.upheld && anqiResult.revised_comment) ? anqiResult.revised_comment : baseComment

        let displayScore = finalScore
        if (anqiResult?.grade_revision?.new_score != null) {
          displayScore = Math.max(0, Math.min(maxPoints, Math.round(anqiResult.grade_revision.new_score)))
        }

        sseEvent(controller, { type: 'step', step: 4, pct: 95, label: anqiResult?.comment_assessment === 'helpful' ? 'Anqi: comment is helpful ✓' : 'Anqi: comment improved ✓' })

        // Save to DB
        let savedId: string | null = null
        if (realSubmissionId && !testMode) {
          try {
            const { data: subRow } = await supabase.from('challenge_submissions').select('user_id, challenge_id').eq('id', realSubmissionId).single()
            const { data: saved } = await supabase.from('ta_grades').upsert({
              submission_id: realSubmissionId,
              challenge_id: (subRow as any)?.challenge_id,
              student_id: (subRow as any)?.user_id,
              suggested_score: displayScore,
              max_score: maxPoints,
              confidence: finalConf,
              suggested_comment: finalComment,
              reasoning: { ...draft, draft_score: draftScore, critic_upheld: criticResult?.upheld ?? true, critic_reasoning: criticResult?.critic_reasoning, grade_changed_by_critic: gradeChanged, topic_module_used: topicSlug, anqi_assessment: anqiResult?.comment_assessment },
              status: 'pending',
            }, { onConflict: 'submission_id' }).select().single()
            savedId = (saved as any)?.id
          } catch (_) {}
        }

        // Final done event
        sseEvent(controller, {
          type: 'done',
          grade: {
            id: savedId,
            suggested_score: displayScore,
            max_score: maxPoints,
            confidence: finalConf,
            comment: finalComment,
            suggested_solution: draft.suggested_solution || draft.step1_math_understanding || '',
            high_confidence: finalConf >= 0.85,
            topic_module_used: topicSlug,
            failed_at_step: draft.failed_at_step ?? null,
            reasoning: {
              step1_math_understanding: draft.step1_math_understanding,
              step3_deviation: draft.step3_deviation,
              step4_henry_perspective: draft.step4_henry_perspective,
              step5_path_continuation: draft.step5_path_continuation,
            },
            critic: criticResult ? { upheld: criticResult.upheld, draft_score: draftScore, final_score: finalScore, grade_changed: gradeChanged, reasoning: criticResult.critic_reasoning } : null,
            anqi: anqiResult ? { upheld: anqiResult.upheld, comment_assessment: anqiResult.comment_assessment, revised_comment: anqiResult.revised_comment, anqi_question: anqiResult.anqi_question } : null,
          },
        })
      } catch (err: any) {
        sseEvent(controller, { type: 'error', message: err.message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
