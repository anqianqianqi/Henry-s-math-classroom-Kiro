/**
 * POST /api/ta/feedback
 *
 * Records Henry's feedback on a TA grade — whether he accepted, overrode,
 * or flagged it. Appends to correction-log.md for future learning.
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
const TA_DIR       = join(process.cwd(), 'TA-agent')
const LOG_PATH     = join(TA_DIR, 'correction-log.md')

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

  // Append to correction log if this is an override or flagged
  if (action === 'overridden' || action === 'flagged') {
    try {
      const reasoning = taGrade.reasoning || {}
      const problemTitle = (taGrade as any).challenge_submissions?.daily_challenges?.title || 'Unknown problem'
      const studentSub   = (taGrade as any).challenge_submissions?.content || '(see submission)'
      const today        = new Date().toISOString().split('T')[0]
      const topicModule  = reasoning.topic_module_used || 'unclassified'

      let existingLog = existsSync(LOG_PATH) ? readFileSync(LOG_PATH, 'utf-8') : '# Correction Log\n\n'

      // Count existing corrections to number new one
      const correctionCount = (existingLog.match(/^### (Correction|Example) #/gm) || []).length + 1

      const newEntry = [
        ``,
        `---`,
        ``,
        `### Correction #${correctionCount} — ${today}`,
        `**Topic module**: ${topicModule}`,
        `**Problem**: ${problemTitle}`,
        `**Student submission**: ${String(studentSub).slice(0, 300)}${studentSub.length > 300 ? '…' : ''}`,
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
      // Non-fatal — the DB update already succeeded
    }
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
