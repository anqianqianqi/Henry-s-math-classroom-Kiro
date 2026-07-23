/**
 * POST /api/ta/feedback
 *
 * Records Henry's feedback on a TA grade — whether he accepted, overrode,
 * or flagged it. Appends to correction-log.md for future learning.
 *
 * For overrides/flags, also runs a Knowledge Base Updater agent that
 * automatically patches grading-rules.md and/or math-knowledge.md for the
 * relevant topic based on what the TA got wrong.
 *
 * Body:
 * {
 *   ta_grade_id: string
 *   action: "accepted" | "overridden" | "flagged"
 *   henry_score?: number          // required if action = overridden
 *   henry_comment?: string        // the comment Henry is posting to the student
 *   what_ta_missed?: string       // optional: Henry's explanation of what was wrong
 *   lesson_type?: "math-knowledge" | "grading-rules" | "grading-style" | "correct"
 * }
 *
 * Uses PATCH semantics (updates existing ta_grades row).
 * Uses optimistic lock: UPDATE WHERE status = 'pending' — returns 409 if race.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const OPENAI_KEY   = process.env.OPENAI_API_KEY!
const TA_DIR       = join(process.cwd(), 'TA-agent')
const LOG_PATH     = join(TA_DIR, 'correction-log.md')

// ── Knowledge Base Updater prompt ─────────────────────────────────────────
//
// This agent reads the current grading-rules.md for a topic and Henry's
// correction, then decides what (if anything) needs to change in the file.
// It produces a complete updated version of the file — not a diff.

const KB_UPDATER_PROMPT = `You are the Knowledge Base Updater for a math TA grading system.

Your job: given a correction that Henry (the teacher) just made to the TA's grade,
update the grading-rules.md file for the relevant topic to prevent this kind of
mistake from happening again.

You will receive:
- The problem
- The student's submission
- The TA's grade and reasoning
- Henry's correct grade
- What Henry says the TA missed (if provided)
- The current contents of grading-rules.md

Your task:
1. Decide whether the correction reveals a gap in the grading rules.
   - If the TA made a clear systematic error that the rules should prevent: update the file.
   - If the TA's error was a one-off reasoning failure that no rule could prevent: return unchanged.
   - If Henry's note suggests a specific principle: distill it into a precise, actionable rule.

2. If updating, make a TARGETED change:
   - Add a new rule section if the error type isn't covered at all
   - Refine an existing rule if it exists but wasn't clear enough
   - Add a concrete example from this correction to an existing section
   - Do NOT rewrite unrelated sections, do NOT change the overall tone/structure

3. Rules for writing new rules:
   - Concrete, not abstract: "Award 2/3 when the student divides by a variable without checking b=0" not "check for edge cases"
   - Grounded in Henry's behavior: cite the correction that motivated the rule
   - Brief: a rule should be 1-4 sentences, not a paragraph

OUTPUT RULES:
- Output ONLY valid JSON, no markdown, no extra text:
{
  "should_update": <true|false>,
  "reason": "1-2 sentences explaining what the TA got wrong and why a rule update helps",
  "updated_grading_rules": "<complete updated file content as a string, or empty string if should_update is false>"
}`

// ── Knowledge Base Updater call ───────────────────────────────────────────

async function callKnowledgeBaseUpdater(
  problemTitle: string,
  studentSubmission: string,
  taGrade: number,
  maxScore: number,
  henryGrade: number,
  taReasoning: any,
  whatTAMissed: string | undefined,
  currentGradingRules: string,
  topicSlug: string
): Promise<{ should_update: boolean; reason: string; updated_grading_rules: string } | null> {
  const userMessage = [
    `Problem: ${problemTitle}`,
    ``,
    `Student submission: ${String(studentSubmission).slice(0, 500)}`,
    ``,
    `TA grade: ${taGrade}/${maxScore}`,
    `TA's read of student: "${taReasoning?.step2_student_approach || 'not recorded'}"`,
    `TA's deviation analysis: "${taReasoning?.step3_deviation || 'not recorded'}"`,
    `TA's confidence: ${Math.round((taReasoning?.confidence || 0.5) * 100)}%`,
    ``,
    `Henry's correct grade: ${henryGrade}/${maxScore}`,
    whatTAMissed ? `Henry's explanation of what TA missed: "${whatTAMissed}"` : null,
    `Topic module: ${topicSlug}`,
    ``,
    `--- CURRENT grading-rules.md ---`,
    currentGradingRules,
  ].filter(Boolean).join('\n')

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: KB_UPDATER_PROMPT },
          { role: 'user',   content: userMessage },
        ],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    })

    if (!res.ok) {
      console.error(`KB Updater OpenAI error ${res.status}: ${await res.text()}`)
      return null
    }

    const data = await res.json()
    const raw = data.choices[0].message.content as string
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
    return JSON.parse(cleaned)
  } catch (err: any) {
    console.error('KB Updater failed:', err.message)
    return null
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  const bootstrapSecret = process.env.BOOTSTRAP_SECRET
  const isSecretAuth = bootstrapSecret && token === bootstrapSecret

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  if (!isSecretAuth) {
    const supabaseUser = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: roles } = await supabase.from('user_roles').select('roles!inner(name)').eq('user_id', user.id).is('class_id', null)
    const isTeacher = (roles as any[])?.some((r: any) => ['teacher', 'administrator'].includes(r.roles?.name))
    if (!isTeacher) return NextResponse.json({ error: 'Teacher only' }, { status: 403 })
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { ta_grade_id, action, henry_score, henry_comment, what_ta_missed, lesson_type } = body
  if (!ta_grade_id || !action) return NextResponse.json({ error: 'ta_grade_id and action required' }, { status: 400 })
  if (action === 'overridden' && henry_score == null) return NextResponse.json({ error: 'henry_score required when overriding' }, { status: 400 })

  // Fetch the existing ta_grade row
  const { data: taGrade } = await supabase
    .from('ta_grades')
    .select('*, challenge_submissions!submission_id(content, challenge_id, user_id, daily_challenges:challenge_id(title))')
    .eq('id', ta_grade_id)
    .single()

  if (!taGrade) return NextResponse.json({ error: 'TA grade not found' }, { status: 404 })

  // Optimistic lock — only update if still pending
  const newStatus = action === 'accepted' ? 'accepted' : action === 'overridden' ? 'overridden' : 'accepted'
  const { data: updated, error: updateError } = await supabase
    .from('ta_grades')
    .update({
      status: newStatus,
      henry_score: action === 'overridden' ? henry_score : taGrade.suggested_score,
      henry_comment: henry_comment || null,
      override_reason: what_ta_missed || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', ta_grade_id)
    .eq('status', 'pending')  // optimistic lock
    .select()
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: 'already_resolved', message: 'This grade was already reviewed.' }, { status: 409 })
  }

  // Append to correction log + auto-update knowledge base for overrides/flags
  let kbUpdateResult: { should_update: boolean; reason: string; updated_grading_rules: string } | null = null

  if (action === 'overridden' || action === 'flagged') {
    const reasoning    = taGrade.reasoning || {}
    const problemTitle = (taGrade as any).challenge_submissions?.daily_challenges?.title || 'Unknown problem'
    const studentSub   = (taGrade as any).challenge_submissions?.content || '(see submission)'
    const today        = new Date().toISOString().split('T')[0]
    const topicModule  = reasoning.topic_module_used || 'unclassified'

    // 1. Append to correction log
    try {
      let existingLog = existsSync(LOG_PATH) ? readFileSync(LOG_PATH, 'utf-8') : '# Correction Log\n\n'
      const correctionCount = (existingLog.match(/^### (Correction|Example) #/gm) || []).length + 1

      const newEntry = [
        ``,
        `---`,
        ``,
        `### Correction #${correctionCount} — ${today}`,
        `**Topic module**: ${topicModule}`,
        `**Problem**: ${problemTitle}`,
        `**Student submission**: ${String(studentSub).slice(0, 300)}${String(studentSub).length > 300 ? '…' : ''}`,
        `**AI grade**: ${taGrade.suggested_score}/${taGrade.max_score}`,
        `**AI's read of student**: "${reasoning.step2_student_approach || 'not recorded'}"`,
        `**AI's failed_at_step**: ${reasoning.failed_at_step || 'none identified'}`,
        `**Henry's grade**: ${henry_score || taGrade.suggested_score}/${taGrade.max_score}`,
        `**Henry's comment**: ${henry_comment || '(none recorded)'}`,
        what_ta_missed ? `**What the TA missed**: ${what_ta_missed}` : null,
        lesson_type ? `**Lesson type**: ${lesson_type}` : null,
      ].filter(Boolean).join('\n')

      writeFileSync(LOG_PATH, existingLog.trimEnd() + newEntry + '\n', 'utf-8')
    } catch (logErr: any) {
      console.error('Failed to append correction log:', logErr.message)
    }

    // 2. Auto-update grading-rules.md for the topic if we have a topic module
    //    Run this only for overrides and flags with a known topic.
    //    "accepted" corrections mean the TA was right — no update needed.
    if (topicModule !== 'unclassified') {
      try {
        const gradingRulesPath = join(TA_DIR, 'topics', topicModule, 'grading-rules.md')
        const currentGradingRules = existsSync(gradingRulesPath)
          ? readFileSync(gradingRulesPath, 'utf-8')
          : '(grading-rules.md not found for this topic)'

        kbUpdateResult = await callKnowledgeBaseUpdater(
          problemTitle,
          studentSub,
          taGrade.suggested_score,
          taGrade.max_score,
          henry_score ?? taGrade.suggested_score,
          reasoning,
          what_ta_missed,
          currentGradingRules,
          topicModule
        )

        if (kbUpdateResult?.should_update && kbUpdateResult.updated_grading_rules) {
          writeFileSync(gradingRulesPath, kbUpdateResult.updated_grading_rules, 'utf-8')
          console.log(`KB Updater patched grading-rules.md for topic: ${topicModule}. Reason: ${kbUpdateResult.reason}`)
        }
      } catch (kbErr: any) {
        console.error('KB Updater failed (non-fatal):', kbErr.message)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    status: newStatus,
    kb_update: kbUpdateResult ? {
      updated: kbUpdateResult.should_update,
      reason: kbUpdateResult.reason,
    } : null,
  })
}
