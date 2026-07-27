/**
 * POST /api/ta/grade
 *
 * Grades a student challenge submission using a multi-agent pipeline:
 *   1A. Submission Reader — reads only student work, extracts what they did
 *   1B. Grader           — verifies extracted values, assigns score
 *   2.  Grade Reviewer   — adversarially challenges the grade (max 3 rounds)
 *   3.  Pedagogy Reviewer — challenges comment quality and helpfulness
 *
 * Suggested solution caching:
 *   - Checks ta_suggested_solutions DB table before generating
 *   - If found: uses cached solution (skips generation cost)
 *   - If not found: generates, saves to DB for next time
 *
 * Body (normal mode):   { submission_id: string }
 * Body (test mode):     { test_mode: true, problem_title, problem_description,
 *                         student_submission, max_points }
 * Auth: teacher/admin session token OR BOOTSTRAP_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const OPENAI_KEY   = process.env.OPENAI_API_KEY!
const TA_DIR       = join(process.cwd(), 'TA-agent')

export const maxDuration = 120

// ── Topic classifier ──────────────────────────────────────────────────────

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'equation-solving': [
    '解方程', '方程化简', '方程', 'solve', 'equation', '求解', '化简',
    '求x', '求a', '求b', '找x', '找a', '= 0', '等于0', 'simplify',
  ],
}

function classifyTopic(tagNames: string[], title: string, description: string): {
  slug: string | null; confidence: number; method: 'tag' | 'keyword' | 'none'
} {
  const lowerTitle = title.toLowerCase()
  const lowerDesc  = (description || '').toLowerCase()
  for (const slug of Object.keys(TOPIC_KEYWORDS)) {
    if (tagNames.some(t => t.toLowerCase().replace(/\s+/g, '-') === slug ||
                          t.toLowerCase().includes(slug.replace(/-/g, ' ')))) {
      return { slug, confidence: 1.0, method: 'tag' }
    }
  }
  for (const [slug, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => lowerTitle.includes(kw.toLowerCase()) || lowerDesc.includes(kw.toLowerCase()))) {
      return { slug, confidence: 0.8, method: 'keyword' }
    }
  }
  return { slug: null, confidence: 0, method: 'none' }
}

function readTopicKnowledge(slug: string): { mathKnowledge: string; gradingRules: string } {
  const base = join(TA_DIR, 'topics', slug)
  const mkPath = join(base, 'math-knowledge.md')
  const grPath = join(base, 'grading-rules.md')
  return {
    mathKnowledge: existsSync(mkPath) ? readFileSync(mkPath, 'utf-8') : '',
    gradingRules:  existsSync(grPath) ? readFileSync(grPath, 'utf-8') : '',
  }
}

// ── GPT helper ────────────────────────────────────────────────────────────

async function callGPT(systemPrompt: string, userMessage: string, maxTokens = 1500): Promise<any> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`)
  const raw = (await res.json()).choices[0].message.content as string
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  try { return JSON.parse(cleaned) } catch { throw new Error(`GPT returned non-JSON: ${raw.slice(0, 200)}`) }
}

// ── Pass 1A — Submission Reader ───────────────────────────────────────────
// Only sees the problem and student's raw submission. Does NOT know the answer.
// Returns a structured extraction of what the student did.

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
  hasImage: boolean,
): Promise<{ student_approach: string; student_values: any; student_final_answers: string; notation_issues: string | null }> {
  const userMsg = [
    `Problem: ${problemTitle}`,
    problemDesc ? `Problem description: ${problemDesc}` : null,
    ``,
    `Student submission:`,
    studentSubmission || '(no text — student submitted an image)',
    hasImage ? `[Note: Student also submitted an image.]` : null,
  ].filter(Boolean).join('\n')
  return callGPT(SUBMISSION_READER_PROMPT, userMsg, 800)
}

// ── Pass 1B — Grader ──────────────────────────────────────────────────────
// Receives problem + max_score + Reader's structured interpretation.
// Verifies student's stated values by substitution, then scores.

const GRADER_PROMPT = `You are a math grader for Henry's math classroom. You have been given a problem and a structured interpretation of a student's work (extracted by a separate reader). You did NOT read the student's raw submission — trust the reader's extraction.

## Henry's classroom philosophy
This is not a standard math class. Henry values creative thinking and novel approaches over complete step-by-step write-ups. A student who leaps to the right answer using an unconventional shortcut is showing mathematical intuition — that is exactly what we want to reward.

- Skipped steps are fine. If a student jumps from the problem to a correct answer without showing every intermediate step, assume they did the steps mentally. Do NOT penalize for missing steps.
- If steps are missing but the final answer is correct, reconstruct the most likely path the student took and give them full credit.
- Creativity and novelty get bonus recognition in the comment, not penalized.
- The comment should NOT tell the student they need to show more work. This is Henry's classroom — we care about ideas, not procedure.
- A good comment here: acknowledges the clever move, asks a question that deepens the idea, or points toward the next interesting thing to explore.

## Your job
1. Solve the problem yourself from scratch to find the correct answer(s)
2. Take the student's final answers (from the reader) and verify them against the problem's requirements:
   - For equations: substitute back and check if they satisfy all equations
   - For geometry: check measurements are consistent
   - For proofs: check if the conclusion follows from the premises
   - For any problem: ask "do these answers actually work?"
3. Write out your verification step by step — show the arithmetic
4. If the final answers are correct: FULL MARKS — regardless of how the student got there or how many steps they showed
5. If the final answers are wrong: identify the exact point where they went wrong

CRITICAL: Step 3 (verification) is mandatory. You must show the check explicitly. Do not claim an answer is wrong without showing the failed check with actual numbers.

CRITICAL: An unusual or non-standard method, a shortcut, or a leap in reasoning is NOT wrong. What matters is whether the final answer is correct.

CRITICAL: The comment must NOT ask the student to show more steps or be more thorough. Comments should acknowledge the idea and spark further curiosity.

Output ONLY valid JSON — no markdown, no code blocks:
{
  "my_solution": "your own clean solution in 2-4 sentences",
  "correct_answer": "what the correct final answer(s) are",
  "verification": "show your check: plug the student's final answers into the original problem requirements, step by step with arithmetic",
  "answers_correct": true,
  "step1_math_understanding": "what the problem asks and what a correct solution looks like",
  "step2_student_approach": "what the student did (use the reader's description) — if steps were skipped, reconstruct the likely path",
  "step3_deviation": "exactly where the student went wrong, citing specific values — or null if answers_correct is true",
  "step4_henry_perspective": "what Henry would observe: the interesting idea, the creative move, or the insight in this submission",
  "step5_path_continuation": "if we follow the student's method forward, does it lead to the right answer?",
  "step6_better_solution": "",
  "score": <int>,
  "max_score": <int>,
  "confidence": <float 0-1>,
  "comment": "encouraging comment that celebrates the idea or approach — do NOT ask for more steps or more thoroughness. Ask a deeper question instead.",
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
    problemDesc ? `Problem description: ${problemDesc}` : null,
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

// ── Grade Reviewer (iterative, max 3 rounds) ──────────────────────────────

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

## The five review questions
1. Are the student's final answers correct? (verify by substitution)
2. Did the TA understand what the student was actually saying?
3. Does the student's answer capture the correct mathematical insight?
4. Did the TA penalize an unexpected but valid method?
5. Is the deduction proportional to the actual error?

Output ONLY valid JSON:
{
  "upheld": <bool>,
  "original_score": <int>,
  "final_score": <int>,
  "max_score": <int>,
  "critic_reasoning": "2-3 sentences explaining the critique decision",
  "what_student_actually_did": "the reviewer's own interpretation of the student's answer",
  "main_issue": "the single most important thing the TA got right or wrong",
  "revised_comment": "improved comment for the student (only if grade changed, otherwise empty string)"
}`

async function callGradeReviewer(
  problemTitle: string,
  problemDescription: string,
  submissionText: string,
  hasImage: boolean,
  maxPoints: number,
  draftResult: any,
): Promise<any> {
  let currentDraft = { ...draftResult }
  let lastReviewerResult: any = null
  const MAX_ROUNDS = 3

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const userMessage = [
      `Problem: ${problemTitle}`,
      problemDescription ? `Problem description: ${problemDescription}` : null,
      `Max points: ${maxPoints}`,
      ``,
      `Student submission:`,
      submissionText || '(no text — student submitted an image)',
      hasImage ? `[Note: Student also submitted an image.]` : null,
      ``,
      `--- TA DRAFT GRADE (Round ${round}) ---`,
      `Score: ${currentDraft.score}/${maxPoints}`,
      `TA's interpretation: "${currentDraft.step2_student_approach}"`,
      `TA's deviation analysis: "${currentDraft.step3_deviation}"`,
      `TA's verification: "${currentDraft.verification || ''}"`,
      `TA's comment: "${currentDraft.comment}"`,
      `TA's confidence: ${Math.round((currentDraft.confidence || 0.5) * 100)}%`,
      round > 1 && lastReviewerResult
        ? `\n--- PREVIOUS REVIEW (Round ${round - 1}) ---\nVerdict: ${lastReviewerResult.upheld ? 'upheld' : 'overridden'}\nReasoning: ${lastReviewerResult.critic_reasoning}`
        : null,
    ].filter(Boolean).join('\n')

    let reviewerResult: any
    try {
      reviewerResult = await callGPT(GRADE_REVIEWER_PROMPT, userMessage, 800)
    } catch {
      reviewerResult = {
        upheld: true, original_score: currentDraft.score, final_score: currentDraft.score, max_score: maxPoints,
        critic_reasoning: 'Grade Reviewer response could not be parsed — original grade stands.',
        what_student_actually_did: currentDraft.step2_student_approach, main_issue: '', revised_comment: '',
      }
    }

    lastReviewerResult = reviewerResult
    if (reviewerResult.upheld) break
    if (typeof reviewerResult.final_score === 'number') {
      currentDraft = { ...currentDraft, score: Math.max(0, Math.min(maxPoints, Math.round(reviewerResult.final_score))) }
    }
  }

  return lastReviewerResult
}

// ── Pedagogy Reviewer ─────────────────────────────────────────────────────

const PEDAGOGY_REVIEWER_PROMPT = `You are the Pedagogy Reviewer for Henry's math classroom. Your job is to check whether the TA's comment will actually help the student grow — not whether it's thorough or standard.

Henry's classroom values: creativity, novel approaches, and ideas over procedure. Students are NOT expected to show every step. A student who skips steps but gets the right answer is doing well.

Check the TA's comment against these standards:

1. Does it celebrate the interesting idea or approach first?
2. Does it avoid asking the student to show more steps or be more thorough? (If it does, that is a failure — Henry does not want this.)
3. Does it ask a question that deepens the thinking rather than correcting process?
4. Would a curious student know what to explore next after reading this?

A BAD comment: "Great start! Next time, try showing all your steps so we can follow your reasoning."
A GOOD comment: "Love the way you jumped straight to the key relationship here! What if the equations were slightly different — would your shortcut still work?"

OUTPUT RULES:
- Output ONLY valid JSON, no markdown, no extra text
{
  "upheld": <true if comment celebrates ideas and asks a good question; false if it's too procedural or asks for more steps>,
  "grade_revision": null | { "new_score": <integer>, "reason": "..." },
  "comment_assessment": "helpful" | "too_vague" | "too_direct" | "misses_opportunity" | "too_procedural",
  "revised_comment": "improved comment if needed — must NOT ask for more steps (empty string if comment is already good)",
  "anqi_question": "the deeper question worth asking this student to extend their thinking",
  "what_ta_missed": "the interesting thing the TA overlooked, or null"
}`

async function callPedagogyReviewer(
  problemTitle: string,
  problemDescription: string,
  submissionText: string,
  maxPoints: number,
  draftResult: any,
  gradeReviewerResult: any,
): Promise<any> {
  const userMessage = [
    `Problem: ${problemTitle}`,
    problemDescription ? `Problem description: ${problemDescription}` : null,
    `Max points: ${maxPoints}`,
    ``,
    `Student submission:`,
    submissionText || '(no text — student submitted an image)',
    ``,
    `--- TA DRAFT GRADE ---`,
    `Score: ${draftResult.score ?? draftResult.suggested_score}/${maxPoints}`,
    `TA's understanding: "${draftResult.step1_math_understanding}"`,
    `TA's read of student: "${draftResult.step2_student_approach}"`,
    `TA's deviation: "${draftResult.step3_deviation}"`,
    `TA's comment: "${draftResult.comment}"`,
    gradeReviewerResult ? `Grade Reviewer revised: ${gradeReviewerResult.grade_changed ? `yes (${gradeReviewerResult.draft_score}→${gradeReviewerResult.final_score})` : 'no'}` : null,
    gradeReviewerResult?.reasoning ? `Grade Reviewer note: "${gradeReviewerResult.reasoning}"` : null,
  ].filter(Boolean).join('\n')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: PEDAGOGY_REVIEWER_PROMPT }, { role: 'user', content: userMessage }],
      max_tokens: 700, temperature: 0.4,
    }),
  })
  if (!res.ok) throw new Error(`Pedagogy Reviewer error ${res.status}`)
  const raw = (await res.json()).choices[0].message.content as string
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  try { return JSON.parse(cleaned) } catch {
    return { upheld: true, grade_revision: null, comment_assessment: 'helpful', revised_comment: '', anqi_question: '', what_ta_missed: null }
  }
}

// ── Suggested solution cache helpers ─────────────────────────────────────

async function getCachedSolution(
  supabase: any,
  challengeId: string | null,
  bankItemId: string | null,
): Promise<string | null> {
  if (!challengeId && !bankItemId) return null
  let query = (supabase as any).from('ta_suggested_solutions').select('solution_text').order('created_at', { ascending: true }).limit(1)
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
  await (supabase as any).from('ta_suggested_solutions').insert({ challenge_id: challengeId, bank_item_id: bankItemId, solution_text: solutionText })
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      .from('user_roles').select('roles!inner(name)').eq('user_id', user.id).is('class_id', null)
    const isTeacher = (roles as any[])?.some((r: any) => ['teacher', 'administrator'].includes(r.roles?.name))
    if (!isTeacher) return NextResponse.json({ error: 'Teacher only' }, { status: 403 })
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: { submission_id?: string; test_mode?: boolean; problem_title?: string; problem_description?: string; student_submission?: string; max_points?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  // ── Test mode ─────────────────────────────────────────────────────────
  if (body.test_mode) {
    if (!body.problem_title || body.student_submission === undefined) {
      return NextResponse.json({ error: 'test_mode requires problem_title and student_submission' }, { status: 400 })
    }
    const testTitle       = body.problem_title
    const testDescription = body.problem_description || ''
    const testSubmission  = body.student_submission
    const testMaxPoints   = body.max_points ?? 3

    try {
      // 2-pass grading in test mode
      const readerResult = await callSubmissionReader(testTitle, testDescription, testSubmission, false)
      const draftResult  = await callGrader(testTitle, testDescription, testMaxPoints, readerResult)
      const draftScore   = Math.max(0, Math.min(testMaxPoints, Math.round(draftResult.score ?? 0)))

      let criticResult: any = null
      try { criticResult = await callGradeReviewer(testTitle, testDescription, testSubmission, false, testMaxPoints, { ...draftResult, score: draftScore }) } catch (_) {}

      const gradeChanged = criticResult && !criticResult.upheld && typeof criticResult.final_score === 'number' && criticResult.final_score !== draftScore
      const finalScore   = gradeChanged ? Math.max(0, Math.min(testMaxPoints, Math.round(criticResult.final_score))) : draftScore
      const baseConf     = Math.max(0, Math.min(1, draftResult.confidence ?? 0.7))
      const finalConf    = gradeChanged ? Math.max(0.5, baseConf - 0.2) : baseConf
      const finalComment = (gradeChanged && criticResult?.revised_comment) ? criticResult.revised_comment : (draftResult.comment || '')

      let anqiResult: any = null
      try {
        anqiResult = await callPedagogyReviewer(testTitle, testDescription, testSubmission, testMaxPoints,
          { ...draftResult, score: draftScore },
          criticResult ? { grade_changed: gradeChanged, draft_score: draftScore, final_score: finalScore, reasoning: criticResult.critic_reasoning } : null)
      } catch (_) {}

      let displayScore = finalScore
      let displayComment = finalComment
      if (anqiResult?.grade_revision && !anqiResult.upheld) {
        displayScore = Math.max(0, Math.min(testMaxPoints, Math.round(anqiResult.grade_revision.new_score)))
      }
      if (anqiResult?.revised_comment && anqiResult.comment_assessment !== 'helpful') {
        displayComment = anqiResult.revised_comment
      }

      const classification = classifyTopic([], testTitle, testDescription)
      return NextResponse.json({
        ok: true,
        grade: {
          suggested_score: displayScore, max_score: testMaxPoints, confidence: finalConf,
          comment: displayComment, high_confidence: finalConf >= 0.85,
          failed_at_step: draftResult.failed_at_step ?? null,
          topic_module_used: classification.slug,
          suggested_solution: draftResult.suggested_solution || '',
          reasoning: {
            reader_interpretation: readerResult,
            step3_deviation: draftResult.step3_deviation,
            step4_henry_perspective: draftResult.step4_henry_perspective,
            step5_path_continuation: draftResult.step5_path_continuation,
            verification: draftResult.verification,
          },
          critic: criticResult ? { upheld: criticResult.upheld, draft_score: draftScore, final_score: finalScore, grade_changed: gradeChanged, reasoning: criticResult.critic_reasoning, what_student_did: criticResult.what_student_actually_did, main_issue: criticResult.main_issue } : null,
          anqi: anqiResult ? { upheld: anqiResult.upheld, comment_assessment: anqiResult.comment_assessment, revised_comment: anqiResult.revised_comment, anqi_question: anqiResult.anqi_question, what_ta_missed: anqiResult.what_ta_missed, grade_revision: anqiResult.grade_revision } : null,
        },
      })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  // ── Normal mode ───────────────────────────────────────────────────────
  const { submission_id } = body
  if (!submission_id) return NextResponse.json({ error: 'submission_id is required' }, { status: 400 })

  try {
    // Fetch submission + challenge
    const { data: submission, error: subError } = await supabase
      .from('challenge_submissions')
      .select(`id, user_id, content, image_url, points, submitted_at, challenge_id,
               daily_challenges:challenge_id(id, title, description, max_points, source_bank_id)`)
      .eq('id', submission_id)
      .single()

    if (subError || !submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

    const challenge = (submission as any).daily_challenges
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })

    let problemTitle = challenge.title
    let problemDescription = challenge.description
    let maxPoints = challenge.max_points ?? 100
    let challengeId: string | null = (submission as any).challenge_id ?? null
    let bankItemId: string | null = challenge.source_bank_id ?? null

    if (bankItemId) {
      const { data: bankItem } = await supabase.from('challenge_bank').select('title, description, max_points').eq('id', bankItemId).single()
      if (bankItem) { problemTitle = bankItem.title; problemDescription = bankItem.description; maxPoints = bankItem.max_points ?? maxPoints }
    }

    const submissionText = (submission as any).content || ''
    const hasImage = !!(submission as any).image_url
    const classification = classifyTopic([], problemTitle, problemDescription)

    // Check cached suggested solution
    let cachedSolution: string | null = null
    try { cachedSolution = await getCachedSolution(supabase, challengeId, bankItemId) } catch (_) {}

    // Pass 1A — Read the student's submission
    const readerResult = await callSubmissionReader(problemTitle, problemDescription, submissionText, hasImage)

    // Pass 1B — Verify and grade
    const draftResult = await callGrader(problemTitle, problemDescription, maxPoints, readerResult)

    if (typeof draftResult.score !== 'number' || typeof draftResult.confidence !== 'number') {
      throw new Error('GPT response missing required score or confidence fields')
    }

    const draftScore = Math.max(0, Math.min(maxPoints, Math.round(draftResult.score)))

    // Save suggested solution to cache if it's new
    if (!cachedSolution && draftResult.suggested_solution) {
      try { await saveSolution(supabase, challengeId, bankItemId, draftResult.suggested_solution) } catch (_) {}
    }
    const suggestedSolution = cachedSolution || draftResult.suggested_solution || ''

    // Grade Reviewer (iterative)
    let criticResult: any = null
    try {
      criticResult = await callGradeReviewer(problemTitle, problemDescription, submissionText, hasImage, maxPoints, { ...draftResult, score: draftScore })
    } catch (criticErr: any) {
      console.error('Grade Reviewer call failed:', criticErr.message)
    }

    const gradeChanged = criticResult && !criticResult.upheld && typeof criticResult.final_score === 'number' && criticResult.final_score !== draftScore
    const finalScore = gradeChanged ? Math.max(0, Math.min(maxPoints, Math.round(criticResult.final_score))) : draftScore
    const baseConfidence = Math.max(0, Math.min(1, draftResult.confidence))
    const finalConfidence = gradeChanged ? Math.max(0.5, baseConfidence - 0.2) : baseConfidence
    const finalComment = (gradeChanged && criticResult.revised_comment) ? criticResult.revised_comment : (draftResult.comment || '')

    // Pedagogy Reviewer
    let anqiResult: any = null
    try {
      anqiResult = await callPedagogyReviewer(problemTitle, problemDescription, submissionText, maxPoints,
        { ...draftResult, score: draftScore },
        criticResult ? { grade_changed: gradeChanged, draft_score: draftScore, final_score: finalScore, reasoning: criticResult?.critic_reasoning } : null)
    } catch (anqiErr: any) { console.error('Pedagogy Reviewer failed:', anqiErr.message) }

    let displayScore = finalScore
    let displayComment = finalComment
    let displayConf = finalConfidence
    if (anqiResult && !anqiResult.upheld) {
      if (anqiResult.grade_revision?.new_score != null) {
        displayScore = Math.max(0, Math.min(maxPoints, Math.round(anqiResult.grade_revision.new_score)))
        displayConf  = Math.max(0.5, displayConf - 0.1)
      }
      if (anqiResult.revised_comment && anqiResult.comment_assessment !== 'helpful') {
        displayComment = anqiResult.revised_comment
      }
    }

    const { data: saved, error: saveError } = await supabase
      .from('ta_grades')
      .upsert({
        submission_id,
        challenge_id:      (submission as any).challenge_id,
        student_id:        (submission as any).user_id,
        suggested_score:   displayScore,
        max_score:         maxPoints,
        confidence:        displayConf,
        suggested_comment: displayComment,
        reasoning: {
          reader_interpretation:    readerResult,
          step1_math_understanding: draftResult.step1_math_understanding,
          step2_student_approach:   draftResult.step2_student_approach,
          step3_deviation:          draftResult.step3_deviation,
          step4_henry_perspective:  draftResult.step4_henry_perspective,
          step5_path_continuation:  draftResult.step5_path_continuation,
          step6_better_solution:    draftResult.step6_better_solution,
          verification:             draftResult.verification,
          draft_score:              draftScore,
          critic_upheld:            criticResult ? criticResult.upheld : true,
          critic_reasoning:         criticResult?.critic_reasoning ?? null,
          critic_what_student_did:  criticResult?.what_student_actually_did ?? null,
          grade_changed_by_critic:  gradeChanged,
          topic_module_used:        classification.slug,
          failed_at_step:           draftResult.failed_at_step ?? null,
          anqi_upheld:              anqiResult?.upheld ?? true,
          anqi_comment_assessment:  anqiResult?.comment_assessment ?? null,
          anqi_what_ta_missed:      anqiResult?.what_ta_missed ?? null,
          solution_from_cache:      !!cachedSolution,
        },
        status: 'pending',
      }, { onConflict: 'submission_id' })
      .select()
      .single()

    if (saveError) console.error('Failed to save ta_grade:', saveError)

    return NextResponse.json({
      ok: true,
      grade: {
        id:                   (saved as any)?.id,
        suggested_score:      displayScore,
        max_score:            maxPoints,
        confidence:           displayConf,
        comment:              displayComment,
        high_confidence:      displayConf >= 0.85,
        failed_at_step:       draftResult.failed_at_step ?? null,
        topic_module_used:    classification.slug,
        suggested_solution:   suggestedSolution,
        solution_from_cache:  !!cachedSolution,
        reasoning: {
          reader_interpretation:   readerResult,
          step3_deviation:         draftResult.step3_deviation,
          step4_henry_perspective: draftResult.step4_henry_perspective,
          step5_path_continuation: draftResult.step5_path_continuation,
          verification:            draftResult.verification,
        },
        critic: criticResult ? {
          upheld: criticResult.upheld, draft_score: draftScore, final_score: finalScore,
          grade_changed: gradeChanged, reasoning: criticResult.critic_reasoning,
          what_student_did: criticResult.what_student_actually_did, main_issue: criticResult.main_issue,
        } : null,
        anqi: anqiResult ? {
          upheld: anqiResult.upheld, comment_assessment: anqiResult.comment_assessment,
          revised_comment: anqiResult.revised_comment, anqi_question: anqiResult.anqi_question,
          what_ta_missed: anqiResult.what_ta_missed, grade_revision: anqiResult.grade_revision,
        } : null,
      },
    })

  } catch (err: any) {
    console.error('TA grading error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
