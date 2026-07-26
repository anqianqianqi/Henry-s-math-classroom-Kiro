/**
 * GET /api/ta/grade/stream?submission_id=...
 *
 * Server-Sent Events (SSE) endpoint for real-time TA grading progress.
 * Streams step completion events as each agent finishes, so the client
 * can show a live progress bar.
 *
 * Two-pass grading architecture:
 *   Pass 1A — Submission Reader: reads only the student's work, extracts what they did
 *   Pass 1B — Grader: receives the reader's interpretation + max_score, verifies & scores
 *
 * Suggested solution caching:
 *   - Before generating a suggested solution, check ta_suggested_solutions in DB
 *   - If found: use cached (skip generation)
 *   - If not found: generate from Pass 1A, save to DB for next time
 *
 * Events emitted:
 *   { type: "step", step: 1, label: "...", pct: 10 }
 *   { type: "step", step: 2, label: "...", pct: 25 }   ← Reading submission
 *   { type: "step", step: 3, label: "...", pct: 50 }   ← Grading
 *   { type: "step", step: 4, label: "...", pct: 70 }   ← Grade Reviewer
 *   { type: "step", step: 5, label: "...", pct: 90 }   ← Pedagogy Reviewer
 *   { type: "done",  grade: { ...full result... } }
 *   { type: "error", message: "..." }
 *
 * Also supports test_mode via query params:
 *   ?test_mode=1&problem_title=...&student_submission=...&max_points=3
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const OPENAI_KEY   = process.env.OPENAI_API_KEY!

export const maxDuration = 120

// ── Topic classifier ──────────────────────────────────────────────────────

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

// ── GPT helper ────────────────────────────────────────────────────────────

async function callGPT(system: string, user: string, maxTokens = 1200): Promise<any> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const raw = (await res.json()).choices[0].message.content as string
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  return JSON.parse(cleaned)
}

// ── Pass 1A — Submission Reader ───────────────────────────────────────────
// Only sees the problem and the student's raw submission.
// Does NOT know what the correct answer is.
// Returns a structured interpretation of what the student did.

const SUBMISSION_READER_PROMPT = `You are a Submission Reader. Your ONLY job is to describe what the student wrote — not to judge correctness.

Rules:
- Do NOT solve the problem yourself
- Do NOT compare to any correct answer
- Trace through the student's work exactly as they wrote it
- Extract every value they stated or computed, in the order they wrote them
- If notation is ambiguous, pick the most reasonable literal reading
- Your job is like a court reporter: record what happened, not whether it was right

Output ONLY valid JSON — no markdown, no code blocks:
{
  "student_approach": "2-4 sentences: what method did the student use? what were their steps?",
  "student_values": {
    "intermediate": { "<name>": "<value>" },
    "final": { "<name>": "<value>" }
  },
  "student_final_answers": "the student's final stated result(s), as written",
  "notation_issues": "any places the student's notation was informal or ambiguous, or null"
}`

async function callSubmissionReader(
  problemTitle: string,
  problemDesc: string,
  studentSubmission: string,
): Promise<{ student_approach: string; student_values: any; student_final_answers: string; notation_issues: string | null }> {
  const userMsg = [
    `Problem: ${problemTitle}`,
    problemDesc ? `Description: ${problemDesc}` : null,
    ``,
    `Student submission:`,
    studentSubmission || '(image only — describe as potentially complete)',
  ].filter(Boolean).join('\n')

  return callGPT(SUBMISSION_READER_PROMPT, userMsg, 800)
}

// ── Pass 1B — Grader ──────────────────────────────────────────────────────
// Receives: problem + max_score + the Reader's structured interpretation.
// Does NOT see the student's raw text — only the interpreted values.
// Task: verify those values by substituting into original equations, then score.

const GRADER_PROMPT = `You are a math grader. You have been given a problem and a structured interpretation of a student's work (extracted by a separate reader). You did NOT read the student's raw submission — trust the reader's extraction.

Your job:
1. Solve the problem yourself from scratch to find the correct answer(s)
2. Take the student's final answers (from the reader) and verify them against the problem's requirements:
   - For equations: substitute back and check if they satisfy all equations
   - For geometry: check measurements are consistent
   - For proofs: check if the conclusion follows from the premises
   - For any problem: ask "do these answers actually work?"
3. Write out your verification step by step — show the arithmetic
4. If the final answers are correct: FULL MARKS — regardless of how the student got there
5. If the final answers are wrong: identify the exact point where they went wrong

CRITICAL: Step 3 (verification) is mandatory. You must show the check explicitly. Do not claim an answer is wrong without showing the failed check with actual numbers.

CRITICAL: An unusual or non-standard method is NOT wrong. What matters is whether the final answer is correct.

Output ONLY valid JSON — no markdown, no code blocks:
{
  "suggested_solution": "your own clean solution in 2-4 sentences",
  "correct_answer": "what the correct final answer(s) are",
  "verification": "show your check: plug the student's final answers into the original problem requirements, step by step with arithmetic",
  "answers_correct": true,
  "step1_math_understanding": "what the problem asks and what a correct solution looks like",
  "step2_student_approach": "what the student did (use the reader's description)",
  "step3_deviation": "exactly where the student went wrong, citing specific values — or null if answers_correct is true",
  "step4_henry_perspective": "what a good teacher would observe about this submission",
  "step5_path_continuation": "if we follow the student's method forward, does it lead to the right answer?",
  "score": <int>,
  "max_score": <int>,
  "confidence": <float 0-1>,
  "comment": "warm encouraging comment — acknowledge what they did well first, then guide toward the error if any",
  "failed_at_step": "description of the error, or null if correct",
  "topic_module_used": null
}`

async function callGrader(
  problemTitle: string,
  problemDesc: string,
  maxPoints: number,
  studentInterpretation: { student_approach: string; student_values: any; student_final_answers: string; notation_issues: string | null },
): Promise<any> {
  const userMsg = [
    `Problem: ${problemTitle}`,
    problemDesc ? `Description: ${problemDesc}` : null,
    `Max points: ${maxPoints}`,
    ``,
    `--- READER'S INTERPRETATION OF STUDENT WORK ---`,
    `Student's approach: ${studentInterpretation.student_approach}`,
    `Student's computed values: ${JSON.stringify(studentInterpretation.student_values)}`,
    `Student's final answers: ${studentInterpretation.student_final_answers}`,
    studentInterpretation.notation_issues ? `Notation notes: ${studentInterpretation.notation_issues}` : null,
    ``,
    `Now verify these final answers by substitution and assign a grade.`,
  ].filter(Boolean).join('\n')

  return callGPT(GRADER_PROMPT, userMsg, 1500)
}

// ── Grade Reviewer prompt ─────────────────────────────────────────────────

const GRADE_REVIEWER_PROMPT = `You are the Grade Reviewer — a senior math educator reviewing a TA's draft grade.

Your job has TWO modes depending on whether the TA graded generously or harshly:

**If the TA gave a HIGH score (close to full marks):** Challenge it.
- Did the TA miss an error? Did the student actually reach the right answer?
- Verify the final answers are correct by substituting back into the original equations if possible.

**If the TA gave a LOW score (0 or far below what the method deserves):** Defend the student.
- Did the TA understand what the student was actually trying to do?
- Read the submission charitably. The most important question is: are the student's final answers correct?
- If the final answers are correct, the grade should be full marks regardless of notation issues.

## CRITICAL CONSTRAINT — You may only LOWER a grade if you can cite a specific error

Before lowering any grade, you MUST be able to state:
- The specific step where the student went wrong
- What the student computed or wrote at that step
- What the correct value should be at that step

If you CANNOT point to a specific numerical or logical error in the student's work,
you MUST uphold the TA's grade. You may NOT lower a grade based on:
- A suspicion that the method is unusual
- The TA's comment being imperfect
- The notation looking informal or ambiguous
- A general feeling that something seems wrong without being able to name what

## CRITICAL CONSTRAINT — Verify before overriding a correct grade

If the TA's own reasoning indicates the student's answer is correct, you need
extraordinary evidence to lower the grade. If the TA says "the student correctly
identified..." or "the approach is sound," uphold unless you can name a specific error.

## The five review questions

**1. Are the student's final answers correct?**
   - If the problem asks for a, b, c — compute or verify those values yourself.
   - Substitute them back into the original equations. Do they satisfy all equations?
   - If yes → the answer is correct, full marks.

**2. Did the TA understand what the student was actually saying?**
   - Read the student submission fresh, without being biased by the TA's interpretation.

**3. Does the student's answer capture the correct mathematical insight?**
   - Imprecise notation is NOT an error if the computed numbers are correct.

**4. Did the TA penalize an unexpected but valid method?**
   - An unconventional correct method earns full credit.

**5. Is the deduction proportional to the actual error?**
   - Correct final answers → full marks, regardless of path

Output ONLY valid JSON:
{
  "upheld": <bool>,
  "final_score": <int>,
  "critic_reasoning": "...",
  "what_student_actually_did": "...",
  "revised_comment": ""
}`

const PEDAGOGY_REVIEWER_PROMPT = `You are the Pedagogy Reviewer — reviewing whether the TA's comment will actually help the student learn.
Ask: Does it acknowledge the good idea first? Does it ask a question rather than give the answer? Is there a deeper question worth adding?
Output ONLY valid JSON:
{
  "upheld": <bool>,
  "comment_assessment": "helpful|too_vague|too_direct|misses_opportunity",
  "revised_comment": "",
  "anqi_question": "deeper question Henry could ask the student",
  "what_ta_missed": null
}`

// ── Suggested solution cache helpers ─────────────────────────────────────

async function getCachedSolution(
  supabase: any,
  challengeId: string | null,
  bankItemId: string | null,
): Promise<string | null> {
  if (!challengeId && !bankItemId) return null

  let query = (supabase as any)
    .from('ta_suggested_solutions')
    .select('solution_text')
    .order('created_at', { ascending: true })
    .limit(1)

  // Prefer bank item lookup (more stable across challenge copies)
  if (bankItemId) {
    query = query.eq('bank_item_id', bankItemId)
  } else if (challengeId) {
    query = query.eq('challenge_id', challengeId)
  }

  const { data } = await query.single()
  return (data as any)?.solution_text ?? null
}

async function saveSolution(
  supabase: any,
  challengeId: string | null,
  bankItemId: string | null,
  solutionText: string,
): Promise<void> {
  await (supabase as any).from('ta_suggested_solutions').insert({
    challenge_id: challengeId,
    bank_item_id: bankItemId,
    solution_text: solutionText,
  })
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
  let challengeId: string | null = null
  let bankItemId: string | null = null

  if (testMode) {
    problemTitle      = searchParams.get('problem_title') || ''
    problemDesc       = searchParams.get('problem_description') || ''
    studentSubmission = searchParams.get('student_submission') || ''
    maxPoints         = parseInt(searchParams.get('max_points') || '3')
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
    challengeId       = (sub as any).challenge_id ?? null
    bankItemId        = ch?.source_bank_id ?? null

    // Prefer bank item title/description if available
    if (bankItemId) {
      const { data: bi } = await supabase.from('challenge_bank').select('title, description, max_points').eq('id', bankItemId).single()
      if (bi) { problemTitle = bi.title; problemDesc = bi.description; maxPoints = bi.max_points ?? maxPoints }
    }
  } else {
    return new Response('submission_id required', { status: 400 })
  }

  const topicSlug = classifyTopic(problemTitle, problemDesc)

  // Stream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1 — topic classification (instant)
        sseEvent(controller, { type: 'step', step: 1, pct: 8, label: topicSlug ? `Topic: ${topicSlug} ✓` : 'General math problem' })

        // Check for cached suggested solution
        let cachedSolution: string | null = null
        if (!testMode) {
          try {
            cachedSolution = await getCachedSolution(supabase, challengeId, bankItemId)
          } catch (_) {}
        }

        // Step 2 — Pass 1A: Read the student's submission
        sseEvent(controller, { type: 'step', step: 2, pct: 15, label: 'Reading student submission...' })
        const readerResult = await callSubmissionReader(problemTitle, problemDesc, studentSubmission)
        sseEvent(controller, { type: 'step', step: 2, pct: 35, label: `Submission read: ${readerResult.student_final_answers || 'extracted'}` })

        // Step 3 — Pass 1B: Verify and grade
        sseEvent(controller, { type: 'step', step: 3, pct: 38, label: 'Verifying and grading...' })
        const draft = await callGrader(problemTitle, problemDesc, maxPoints, readerResult)
        const draftScore = Math.max(0, Math.min(maxPoints, Math.round(draft.score ?? 0)))
        sseEvent(controller, { type: 'step', step: 3, pct: 55, label: `Grade: ${draftScore}/${maxPoints} (${Math.round((draft.confidence ?? 0.7) * 100)}% confident)` })

        // Save suggested solution to cache if it's new
        if (!testMode && !cachedSolution && draft.suggested_solution) {
          try {
            await saveSolution(supabase, challengeId, bankItemId, draft.suggested_solution)
          } catch (_) {}
        }
        const suggestedSolution = cachedSolution || draft.suggested_solution || draft.step1_math_understanding || ''

        // Step 4 — Grade Reviewer (iterative, max 3 rounds)
        sseEvent(controller, { type: 'step', step: 4, pct: 57, label: 'Grade Reviewer checking the grade...' })
        let criticResult: any = null
        try {
          let currentDraft = { ...draft, score: draftScore }
          let lastResult: any = null
          const MAX_ROUNDS = 3

          for (let round = 1; round <= MAX_ROUNDS; round++) {
            if (round > 1) {
              sseEvent(controller, { type: 'step', step: 4, pct: 57 + round * 4, label: `Grade Reviewer round ${round}...` })
            }
            const criticUser = [
              `Problem: ${problemTitle}`, `Max: ${maxPoints}`, `Student: ${studentSubmission}`,
              ``,
              `TA draft (Round ${round}): Score ${currentDraft.score}/${maxPoints}`,
              `TA's read: "${currentDraft.step2_student_approach}"`,
              `TA's deviation: "${currentDraft.step3_deviation}"`,
              `TA's comment: "${currentDraft.comment}"`,
              `TA's verification: "${(currentDraft as any).verification || ''}"`,
              round > 1 && lastResult ? `Previous review: ${lastResult.upheld ? 'upheld' : 'overridden'} — ${lastResult.critic_reasoning}` : null,
            ].filter(Boolean).join('\n')
            const roundResult = await callGPT(GRADE_REVIEWER_PROMPT, criticUser, 600)
            lastResult = roundResult
            if (roundResult.upheld) break
            if (typeof roundResult.final_score === 'number') {
              currentDraft = { ...currentDraft, score: Math.max(0, Math.min(maxPoints, Math.round(roundResult.final_score))) }
            }
          }
          criticResult = lastResult
        } catch (_) {}
        const gradeChanged = criticResult && !criticResult.upheld && typeof criticResult.final_score === 'number' && criticResult.final_score !== draftScore
        const finalScore = gradeChanged ? Math.max(0, Math.min(maxPoints, Math.round(criticResult.final_score))) : draftScore
        sseEvent(controller, { type: 'step', step: 4, pct: 78, label: gradeChanged ? `Grade Reviewer revised: ${draftScore}→${finalScore}` : 'Grade Reviewer upheld ✓' })

        // Step 5 — Pedagogy Reviewer
        sseEvent(controller, { type: 'step', step: 5, pct: 80, label: 'Pedagogy Reviewer checking the comment...' })
        let anqiResult: any = null
        try {
          const baseComment = (gradeChanged && criticResult?.revised_comment) ? criticResult.revised_comment : (draft.comment || '')
          const anqiUser = [`Problem: ${problemTitle}`, `Student: ${studentSubmission}`, ``, `TA comment: "${baseComment}"`, `Grade: ${finalScore}/${maxPoints}`].join('\n')
          anqiResult = await callGPT(PEDAGOGY_REVIEWER_PROMPT, anqiUser, 600)
        } catch (_) {}

        const baseConf = Math.max(0, Math.min(1, draft.confidence ?? 0.7))
        const finalConf = gradeChanged ? Math.max(0.5, baseConf - 0.2) : baseConf
        const baseComment = (gradeChanged && criticResult?.revised_comment) ? criticResult.revised_comment : (draft.comment || '')
        const finalComment = (anqiResult && !anqiResult.upheld && anqiResult.revised_comment) ? anqiResult.revised_comment : baseComment

        let displayScore = finalScore
        if (anqiResult?.grade_revision?.new_score != null) {
          displayScore = Math.max(0, Math.min(maxPoints, Math.round(anqiResult.grade_revision.new_score)))
        }

        sseEvent(controller, { type: 'step', step: 5, pct: 95, label: anqiResult?.comment_assessment === 'helpful' ? 'Pedagogy Reviewer: comment is helpful ✓' : 'Pedagogy Reviewer: comment improved ✓' })

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
              reasoning: {
                ...draft,
                reader_interpretation: readerResult,
                draft_score: draftScore,
                critic_upheld: criticResult?.upheld ?? true,
                critic_reasoning: criticResult?.critic_reasoning,
                grade_changed_by_critic: gradeChanged,
                topic_module_used: topicSlug,
                anqi_assessment: anqiResult?.comment_assessment,
                solution_from_cache: !!cachedSolution,
              },
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
            suggested_solution: suggestedSolution,
            solution_from_cache: !!cachedSolution,
            high_confidence: finalConf >= 0.85,
            topic_module_used: topicSlug,
            failed_at_step: draft.failed_at_step ?? null,
            reasoning: {
              reader_interpretation: readerResult,
              step1_math_understanding: draft.step1_math_understanding,
              step3_deviation: draft.step3_deviation,
              step4_henry_perspective: draft.step4_henry_perspective,
              step5_path_continuation: draft.step5_path_continuation,
              verification: draft.verification,
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
