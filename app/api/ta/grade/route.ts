/**
 * POST /api/ta/grade
 *
 * Grades a student challenge submission using:
 *   1. TA Agent (8-step protocol + topic knowledge)
 *   2. Math Critic (challenges the grade)  
 *   3. Anqi Critique Agent (challenges the comment + pedagogy)
 *
 * Body (normal mode):
 *   { submission_id: string }
 *
 * Body (test mode — for eval script, no DB needed):
 *   { test_mode: true, problem_title, problem_description, student_submission, max_points }
 *
 * Auth: teacher/admin session token OR BOOTSTRAP_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const OPENAI_KEY   = process.env.OPENAI_API_KEY!
const TA_DIR       = join(process.cwd(), 'TA-agent')

// ── Topic classifier ──────────────────────────────────────────────────────

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'equation-solving': [
    '解方程', '方程化简', '方程', 'solve', 'equation', '求解', '化简',
    '求x', '求a', '求b', '找x', '找a', '= 0', '等于0', 'simplify',
  ],
}

function classifyTopic(tagNames: string[], title: string, description: string): {
  slug: string | null
  confidence: number
  method: 'tag' | 'keyword' | 'none'
} {
  const lowerTitle = title.toLowerCase()
  const lowerDesc  = (description || '').toLowerCase()

  // Priority 1: exact tag match
  for (const slug of Object.keys(TOPIC_KEYWORDS)) {
    if (tagNames.some(t => t.toLowerCase().replace(/\s+/g, '-') === slug ||
                          t.toLowerCase().includes(slug.replace(/-/g, ' ')))) {
      return { slug, confidence: 1.0, method: 'tag' }
    }
  }

  // Priority 2: keyword match
  for (const [slug, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const matches = keywords.filter(kw =>
      lowerTitle.includes(kw.toLowerCase()) || lowerDesc.includes(kw.toLowerCase())
    )
    if (matches.length >= 1) {
      return { slug, confidence: 0.8, method: 'keyword' }
    }
  }

  return { slug: null, confidence: 0, method: 'none' }
}

// ── Topic knowledge loader (per-request) ─────────────────────────────────

function readTopicKnowledge(slug: string): { mathKnowledge: string; gradingRules: string } {
  const base = join(TA_DIR, 'topics', slug)
  const mkPath = join(base, 'math-knowledge.md')
  const grPath = join(base, 'grading-rules.md')
  return {
    mathKnowledge: existsSync(mkPath) ? readFileSync(mkPath, 'utf-8') : '',
    gradingRules:  existsSync(grPath) ? readFileSync(grPath, 'utf-8') : '',
  }
}

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
const CORRECTION_LOG = CORRECTION_LOG_RAW.slice(0, 4000)

// ── Dynamic system prompt (includes topic module when available) ───────────

function buildSystemPrompt(topicModule: { mathKnowledge: string; gradingRules: string } | null): string {
  const topicSection = topicModule?.mathKnowledge ? `
---
## TOPIC-SPECIFIC MATH KNOWLEDGE
Read this before looking at the student's work. Use it to understand what a
complete solution looks like and what habits a good mathematician applies here.

${topicModule.mathKnowledge}

---
## TOPIC-SPECIFIC GRADING RULES
Use this to calibrate your grade and write your comment.

${topicModule.gradingRules}

---` : ''

  return `You are Henry's math Teaching Assistant (TA). Your job is to grade student submissions exactly as Henry would.

You have the following knowledge sources:

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
${topicSection}

IMPORTANT OUTPUT RULES:
- Output ONLY a valid JSON object, no markdown code blocks, no extra text
- The JSON must match this exact structure:
{
  "step1_math_understanding": "what the problem asks and what a complete solution looks like",
  "step2_student_approach": "what the student did, described neutrally",
  "step3_deviation": "where exactly the student's path diverged, and why",
  "step4_henry_perspective": "what henry would see — what's right, what's the gap",
  "step5_path_continuation": "if we follow the student's method correctly, does it work?",
  "step6_better_solution": "optional: more elegant approach (empty string if none)",
  "score": <integer>,
  "max_score": <integer>,
  "confidence": <float 0.0-1.0>,
  "comment": "the comment henry would write to the student",
  "failed_at_step": "free-text description of where the student went wrong, or null if correct",
  "topic_module_used": "equation-solving or null"
}`
}

// ── Anqi Critique Agent prompt ────────────────────────────────────────────

const ANQI_CRITIQUE_PROMPT = `You are Anqi, a senior math educator reviewing a TA's draft grade and comment.
Your job is NOT to re-grade the math. Your job is to challenge whether the TA's
response will actually help the student learn.

Anqi's five questions:

1. Did the TA understand what the student was actually trying to do?
   Read the submission charitably. Is there a reasonable interpretation the TA missed?
   Did the TA assume incompetence when the student might have understood concisely?

2. Is the grade proportional to the actual gap?
   If the TA said "missing one case" but gave 0/3, that is too harsh.
   If the student showed the right method with a small slip, was partial credit given?

3. Does the comment actually help the student take the next step?
   A good comment: acknowledges the good idea → "但是" / "but" → asks a question.
   A bad comment: only says what's wrong, or gives the answer directly.
   Henry's pattern: "除以b是一個很棒的想法!! 但是....還有一種可能"

4. Is there a more interesting question to ask?
   Can the comment nudge toward a deeper insight, not just correct the error?
   Example: "你找到了 a=1,2,3 — 為什麼不可能有第4個解呢?" (Why can't there be a 4th solution?)

5. What would a student who read this comment actually do next?
   Imagine the student reading the TA's comment. Would they know what to do?
   Or would they just resubmit the same thing?

OUTPUT RULES:
- Output ONLY valid JSON, no markdown, no extra text
{
  "upheld": <true if grade and comment are both good, false if either should change>,
  "grade_revision": null | { "new_score": <integer>, "reason": "..." },
  "comment_assessment": "helpful" | "too_vague" | "too_direct" | "misses_opportunity",
  "revised_comment": "improved comment (empty string if comment_assessment is helpful)",
  "anqi_question": "the deeper question Anqi would ask to extend the student's thinking",
  "what_ta_missed": "..." | null
}`

// ── Critic system prompt ──────────────────────────────────────────────────

const CRITIC_PROMPT = `You are a senior math educator reviewing a TA's draft grade. Your job is to challenge it.

You will receive:
- The math problem
- The student's submission  
- The TA's draft grade and reasoning

Your task is to challenge the grade by asking these specific questions in order:

**1. Did the TA understand what the student was actually saying?**
   - Read the student submission fresh, without looking at the TA's interpretation first.
   - What is the most charitable reasonable interpretation of what this student wrote?
   - Did the TA read it that way, or did it read it more harshly?

**2. Does the student's answer capture the correct mathematical insight?**
   - Even if stated briefly, clumsily, or incompletely — is the core idea right?
   - A student writing "3进制大" (base-3 is bigger) is correct. Don't penalize brevity.
   - A student writing the right answer in Chinese when the problem is in English is still correct.

**3. Did the TA penalize an unexpected but valid method?**
   - If the student used a different approach than expected, was it mathematically valid?
   - An unconventional correct method should earn full credit.

**4. Is the TA's score consistent with its own stated reasoning?**
   - If the TA said "mostly correct" but gave 40%, that is internally inconsistent.
   - If the TA said "missing one case" but gave 0%, that is too harsh.

**5. Is the deduction proportional to the actual error?**
   - Missing b=0 case → partial deduction (not zero)
   - Correct concept, no full working → depends on what the problem asks for
   - Completely wrong approach → larger deduction

After challenging the grade:
- If the grade is FAIR: explain clearly why each criticism doesn't apply
- If the grade should change: state the revised score and explain exactly what the TA got wrong

OUTPUT RULES:
- Output ONLY valid JSON, no markdown, no extra text
- Structure:
{
  "upheld": <true if grade stands, false if it should change>,
  "original_score": <the TA's score>,
  "final_score": <revised score, same as original if upheld>,
  "max_score": <max points>,
  "critic_reasoning": "2-3 sentences explaining the critique decision",
  "what_student_actually_did": "the critic's own interpretation of the student's answer",
  "main_issue": "the single most important thing the TA got right or wrong",
  "revised_comment": "improved comment for the student (only if grade changed, otherwise empty string)"
}`

// ── Critic call ───────────────────────────────────────────────────────────

async function callCritic(
  problemTitle: string,
  problemDescription: string,
  submissionText: string,
  hasImage: boolean,
  maxPoints: number,
  draftResult: any
): Promise<any> {
  const userMessage = [
    `Problem: ${problemTitle}`,
    problemDescription ? `Problem description: ${problemDescription}` : null,
    `Max points: ${maxPoints}`,
    ``,
    `Student submission:`,
    submissionText || '(no text — student submitted an image)',
    hasImage ? `[Note: Student also submitted an image.]` : null,
    ``,
    `--- TA DRAFT GRADE ---`,
    `Score: ${draftResult.score}/${maxPoints}`,
    `TA's interpretation of student: "${draftResult.step2_student_approach}"`,
    `TA's deviation analysis: "${draftResult.step3_deviation}"`,
    `TA's Henry-perspective: "${draftResult.step4_henry_perspective}"`,
    `TA's comment to student: "${draftResult.comment}"`,
    `TA's confidence: ${Math.round((draftResult.confidence || 0.5) * 100)}%`,
  ].filter(Boolean).join('\n')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: CRITIC_PROMPT },
        { role: 'user',   content: userMessage },
      ],
      max_tokens: 800,
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Critic OpenAI error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const raw = data.choices[0].message.content as string
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    // If critic fails to parse, return a pass-through that upholds the original
    return {
      upheld: true,
      original_score: draftResult.score,
      final_score: draftResult.score,
      max_score: maxPoints,
      critic_reasoning: 'Critic response could not be parsed — original grade stands.',
      what_student_actually_did: draftResult.step2_student_approach,
      main_issue: '',
      revised_comment: '',
    }
  }
}



// ── GPT calls ─────────────────────────────────────────────────────────────

async function callGPT(systemPrompt: string, userMessage: string): Promise<any> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      max_tokens: 1500,
      temperature: 0.2,
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

// ── Anqi Critique call (Call 3) ───────────────────────────────────────────

async function callAnqiCritique(
  problemTitle: string,
  problemDescription: string,
  submissionText: string,
  maxPoints: number,
  draftResult: any,
  criticResult: any
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
    criticResult ? `Critic revised: ${criticResult.grade_changed ? `yes (${criticResult.draft_score}→${criticResult.final_score})` : 'no'}` : null,
    criticResult?.reasoning ? `Critic note: "${criticResult.reasoning}"` : null,
  ].filter(Boolean).join('\n')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: ANQI_CRITIQUE_PROMPT },
        { role: 'user',   content: userMessage },
      ],
      max_tokens: 700,
      temperature: 0.4,
    }),
  })

  if (!res.ok) throw new Error(`Anqi critique error ${res.status}`)
  const data = await res.json()
  const raw = data.choices[0].message.content as string
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    return {
      upheld: true,
      grade_revision: null,
      comment_assessment: 'helpful',
      revised_comment: '',
      anqi_question: '',
      what_ta_missed: null,
    }
  }
}



export const maxDuration = 120  // 120s — two sequential GPT-4o calls

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
  let body: { submission_id?: string; test_mode?: boolean; problem_title?: string; problem_description?: string; student_submission?: string; max_points?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Test mode: directly accept problem/submission text (for eval script) ──
  if (body.test_mode) {
    if (!body.problem_title || body.student_submission === undefined) {
      return NextResponse.json({ error: 'test_mode requires problem_title and student_submission' }, { status: 400 })
    }
    const testTitle       = body.problem_title
    const testDescription = body.problem_description || ''
    const testSubmission  = body.student_submission
    const testMaxPoints   = body.max_points ?? 3

    const testClassification = classifyTopic([], testTitle, testDescription)
    const testTopicModule = testClassification.slug ? readTopicKnowledge(testClassification.slug) : null
    const testPrompt = buildSystemPrompt(testTopicModule)
    const testUserMsg = [
      `Problem: ${testTitle}`,
      testDescription ? `Problem description: ${testDescription}` : null,
      `Max points: ${testMaxPoints}`,
      ``,
      `Student submission:`,
      testSubmission || '(no text)',
    ].filter(Boolean).join('\n')

    try {
      const draftResult = await callGPT(testPrompt, testUserMsg)
      const draftScore = Math.max(0, Math.min(testMaxPoints, Math.round(draftResult.score ?? 0)))

      let criticResult: any = null
      try {
        criticResult = await callCritic(testTitle, testDescription, testSubmission, false, testMaxPoints, { ...draftResult, score: draftScore })
      } catch (_) {}

      const gradeChanged = criticResult && !criticResult.upheld && typeof criticResult.final_score === 'number' && criticResult.final_score !== draftScore
      const finalScore = gradeChanged ? Math.max(0, Math.min(testMaxPoints, Math.round(criticResult.final_score))) : draftScore
      const baseConf = Math.max(0, Math.min(1, draftResult.confidence ?? 0.7))
      const finalConf = gradeChanged ? Math.max(0.5, baseConf - 0.2) : baseConf
      const finalComment = (gradeChanged && criticResult?.revised_comment) ? criticResult.revised_comment : (draftResult.comment || '')

      let anqiResult: any = null
      try {
        anqiResult = await callAnqiCritique(testTitle, testDescription, testSubmission, testMaxPoints, { ...draftResult, score: draftScore }, criticResult ? { grade_changed: gradeChanged, draft_score: draftScore, final_score: finalScore, reasoning: criticResult.critic_reasoning } : null)
      } catch (_) {}

      // Apply Anqi grade revision if any
      let displayScore = finalScore
      let displayComment = finalComment
      if (anqiResult?.grade_revision && !anqiResult.upheld) {
        displayScore = Math.max(0, Math.min(testMaxPoints, Math.round(anqiResult.grade_revision.new_score)))
      }
      if (anqiResult?.revised_comment && anqiResult.comment_assessment !== 'helpful') {
        displayComment = anqiResult.revised_comment
      }

      return NextResponse.json({
        ok: true,
        grade: {
          suggested_score: displayScore,
          max_score: testMaxPoints,
          confidence: finalConf,
          comment: displayComment,
          high_confidence: finalConf >= 0.85,
          failed_at_step: draftResult.failed_at_step ?? null,
          topic_module_used: testClassification.slug,
          reasoning: {
            step3_deviation:         draftResult.step3_deviation,
            step4_henry_perspective: draftResult.step4_henry_perspective,
            step5_path_continuation: draftResult.step5_path_continuation,
          },
          critic: criticResult ? {
            upheld: criticResult.upheld,
            draft_score: draftScore,
            final_score: finalScore,
            grade_changed: gradeChanged,
            reasoning: criticResult.critic_reasoning,
            what_student_did: criticResult.what_student_actually_did,
            main_issue: criticResult.main_issue,
          } : null,
          anqi: anqiResult ? {
            upheld: anqiResult.upheld,
            comment_assessment: anqiResult.comment_assessment,
            revised_comment: anqiResult.revised_comment,
            anqi_question: anqiResult.anqi_question,
            what_ta_missed: anqiResult.what_ta_missed,
            grade_revision: anqiResult.grade_revision,
          } : null,
        },
      })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
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

    // ── Classify topic + load topic module ────────────────────────────
    const classification = classifyTopic([], problemTitle, problemDescription)
    const topicModule = classification.slug ? readTopicKnowledge(classification.slug) : null
    const systemPrompt = buildSystemPrompt(topicModule)

    // ── Call GPT Grader (Call 1) ───────────────────────────────────────
    const draftResult = await callGPT(systemPrompt, userMessage)

    // Validate required fields
    if (typeof draftResult.score !== 'number' || typeof draftResult.confidence !== 'number') {
      throw new Error('GPT response missing required score or confidence fields')
    }

    const draftScore = Math.max(0, Math.min(maxPoints, Math.round(draftResult.score)))

    // ── Call GPT Critic (Call 2) — adversarial self-critique ──────────
    let criticResult: any = null
    try {
      criticResult = await callCritic(
        problemTitle,
        problemDescription,
        submissionText,
        hasImage,
        maxPoints,
        { ...draftResult, score: draftScore }
      )
    } catch (criticErr: any) {
      // Critic failure is non-fatal — use draft result
      console.error('Critic call failed:', criticErr.message)
    }

    // ── Resolve final score ────────────────────────────────────────────
    // If the critic overrides, use its score; else use the draft
    const gradeChanged = criticResult && !criticResult.upheld &&
      typeof criticResult.final_score === 'number' &&
      criticResult.final_score !== draftScore

    const finalScore = gradeChanged
      ? Math.max(0, Math.min(maxPoints, Math.round(criticResult.final_score)))
      : draftScore

    // Confidence: if grader and critic agreed → keep grader confidence
    //             if critic overrode → lower confidence (needs Henry review)
    const baseConfidence = Math.max(0, Math.min(1, draftResult.confidence))
    const finalConfidence = gradeChanged
      ? Math.max(0.5, baseConfidence - 0.2)  // penalise confidence when critic disagrees
      : baseConfidence

    // Best comment: use critic's revised comment if grade changed, else grader's
    const finalComment = (gradeChanged && criticResult.revised_comment)
      ? criticResult.revised_comment
      : (draftResult.comment || '')

    // ── Call Anqi Critique Agent (Call 3) ─────────────────────────────
    let anqiResult: any = null
    try {
      anqiResult = await callAnqiCritique(
        problemTitle, problemDescription, submissionText, maxPoints,
        { ...draftResult, score: draftScore },
        criticResult ? { grade_changed: gradeChanged, draft_score: draftScore, final_score: finalScore, reasoning: criticResult?.critic_reasoning } : null
      )
    } catch (anqiErr: any) {
      console.error('Anqi critique failed:', anqiErr.message)
    }

    // Apply Anqi grade revision if it disagrees
    let displayScore   = finalScore
    let displayComment = finalComment
    let displayConf    = finalConfidence
    if (anqiResult && !anqiResult.upheld) {
      if (anqiResult.grade_revision?.new_score != null) {
        displayScore = Math.max(0, Math.min(maxPoints, Math.round(anqiResult.grade_revision.new_score)))
        displayConf  = Math.max(0.5, displayConf - 0.1) // further reduce confidence
      }
      if (anqiResult.revised_comment && anqiResult.comment_assessment !== 'helpful') {
        displayComment = anqiResult.revised_comment
      }
    }

    const { data: saved, error: saveError } = await supabase
      .from('ta_grades')
      .upsert({
        submission_id,
        challenge_id:       (submission as any).challenge_id,
        student_id:         (submission as any).user_id,
        suggested_score:    displayScore,
        max_score:          maxPoints,
        confidence:         displayConf,
        suggested_comment:  displayComment,
        reasoning: {
          step1_math_understanding: draftResult.step1_math_understanding,
          step2_student_approach:   draftResult.step2_student_approach,
          step3_deviation:          draftResult.step3_deviation,
          step4_henry_perspective:  draftResult.step4_henry_perspective,
          step5_path_continuation:  draftResult.step5_path_continuation,
          step6_better_solution:    draftResult.step6_better_solution,
          draft_score:              draftScore,
          critic_upheld:            criticResult ? criticResult.upheld : true,
          critic_reasoning:         criticResult?.critic_reasoning || null,
          critic_what_student_did:  criticResult?.what_student_actually_did || null,
          grade_changed_by_critic:  gradeChanged,
          topic_module_used:        classification.slug,
          failed_at_step:           draftResult.failed_at_step ?? null,
          anqi_upheld:              anqiResult?.upheld ?? true,
          anqi_comment_assessment:  anqiResult?.comment_assessment ?? null,
          anqi_what_ta_missed:      anqiResult?.what_ta_missed ?? null,
        },
        status: 'pending',
      }, {
        onConflict: 'submission_id',
      })
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save ta_grade:', saveError)
    }

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
        reasoning: {
          step3_deviation:         draftResult.step3_deviation,
          step4_henry_perspective: draftResult.step4_henry_perspective,
          step5_path_continuation: draftResult.step5_path_continuation,
        },
        critic: criticResult ? {
          upheld:            criticResult.upheld,
          draft_score:       draftScore,
          final_score:       finalScore,
          grade_changed:     gradeChanged,
          reasoning:         criticResult.critic_reasoning,
          what_student_did:  criticResult.what_student_actually_did,
          main_issue:        criticResult.main_issue,
        } : null,
        anqi: anqiResult ? {
          upheld:             anqiResult.upheld,
          comment_assessment: anqiResult.comment_assessment,
          revised_comment:    anqiResult.revised_comment,
          anqi_question:      anqiResult.anqi_question,
          what_ta_missed:     anqiResult.what_ta_missed,
          grade_revision:     anqiResult.grade_revision,
        } : null,
      },
    })

  } catch (err: any) {
    console.error('TA grading error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
