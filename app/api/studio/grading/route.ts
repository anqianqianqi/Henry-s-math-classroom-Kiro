/**
 * /api/studio/grading — the grading desk's data, for a tool outside the site.
 *
 * The desk at app/studio reads Supabase straight from the browser as the
 * signed-in teacher. The Python Henry Problem Studio cannot do that: it holds
 * the import key, not a session, and it draws the problem itself. So this
 * route serves the same reads the desk makes and performs the same write,
 * through the same code (lib/studio/queue.ts and lib/studio/grade.ts), so
 * the two never disagree about what a grade is.
 *
 * Who may call is decided in lib/studio/auth.ts: the import key, or a
 * teacher's own token. With the key, the writes are made by the configured
 * teacher through the service role.
 *
 * GET ?what=queue&mode=pending|graded
 *   { rows: [...], classes: [{ id, name }] }   rows shaped like the desk's queue,
 *   each with the assistant's suggestion attached when one exists
 * GET ?what=problem&challengeId=…  or  &bankItemId=…
 *   { problem: { key, title, description, henryproblem, imageUrl, maxPoints,
 *                challengeId, bankItemId, gone } | null }
 * GET ?what=comments&submissionId=…
 *   { comments: [{ id, userId, content, createdAt, authorName }] }
 * GET ?what=members&classId=…
 *   { userIds: [...] }
 *
 * POST { action: "grade", submissionId, score, comment?, note? }
 *   Writes the score, the comment as a row on the answer, and the student's
 *   notifications, then tells the assistant what happened to its suggestion
 *   through /api/ta/feedback. Answers { score, feedback, taStatus }.
 * POST { action: "flag", taGradeId, note }
 *   Flags the assistant's suggestion without grading. Answers { feedback }.
 *
 * Asking the assistant to grade is POST /api/ta/grade, which accepts the same
 * key; it is not proxied here because it runs for up to two minutes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateStudio, studioFail, studioJson, studioPreflight, UUID } from '@/lib/studio/auth'
import { attachTa, problemKey, rowFromRecord } from '@/lib/studio/queue'
import { gradeSubmission, StudioError } from '@/lib/studio/grade'

export const maxDuration = 60

const SUBMISSION_COLUMNS = `
  id, user_id, challenge_id, bank_item_id, content, image_url, points, is_locked, submitted_at,
  profiles:user_id(full_name, first_name, last_name, email),
  daily_challenges:challenge_id(title, challenge_date, max_points),
  challenge_bank:bank_item_id(title, max_points)
`
const TA_COLUMNS = 'id, submission_id, suggested_score, max_score, confidence, suggested_comment, reasoning, status, henry_score'
const PENDING_LIMIT = 400
const GRADED_LIMIT = 150

export async function OPTIONS() {
  return studioPreflight()
}

async function queue(supabase: any, mode: string) {
  const base = supabase.from('challenge_submissions').select(SUBMISSION_COLUMNS)
  const { data, error } = mode === 'graded'
    ? await base.not('points', 'is', null).order('updated_at', { ascending: false }).limit(GRADED_LIMIT)
    : await base.is('points', null).order('submitted_at', { ascending: false }).limit(PENDING_LIMIT)
  if (error) throw new Error(error.message)
  const rows = ((data as any[] | null) || []).map(rowFromRecord)

  const taRows: any[] = []
  const ids = rows.map(r => r.id)
  for (let i = 0; i < ids.length; i += 150) {
    const { data: ta } = await supabase.from('ta_grades').select(TA_COLUMNS).in('submission_id', ids.slice(i, i + 150))
    if (ta) taRows.push(...(ta as any[]))
  }

  const { data: classRows } = await supabase.from('classes').select('id, name').eq('is_active', true).order('name')
  const classes = ((classRows as any[] | null) || []).map(c => ({ id: String(c.id), name: String(c.name) }))
  return { rows: attachTa(rows, taRows), classes }
}

async function problem(supabase: any, challengeId: string | null, bankItemId: string | null) {
  let info: any = {
    key: problemKey({ challengeId, bankItemId }), title: '', description: null, henryproblem: null,
    imageUrl: null, maxPoints: 100, challengeId, bankItemId, gone: true,
  }
  if (challengeId) {
    const { data } = await supabase.from('daily_challenges')
      .select('id, title, challenge_date, description, henryproblem, image_url, max_points')
      .eq('id', challengeId).maybeSingle()
    if (data) {
      info = { ...info, title: data.title, description: data.description ?? null, henryproblem: data.henryproblem ?? null,
        imageUrl: data.image_url ?? null, maxPoints: data.max_points ?? 100, gone: false }
    }
  }
  if (info.gone && bankItemId) {
    const { data } = await supabase.from('challenge_bank')
      .select('id, title, description, henryproblem, image_url, max_points')
      .eq('id', bankItemId).maybeSingle()
    if (data) {
      info = { ...info, title: data.title, description: data.description ?? null, henryproblem: data.henryproblem ?? null,
        imageUrl: data.image_url ?? null, maxPoints: data.max_points ?? 100, gone: false }
    }
  }
  return info
}

async function comments(supabase: any, submissionId: string) {
  const { data } = await supabase.from('submission_comments')
    .select('id, user_id, content, created_at, profiles!inner(full_name, nickname)')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true })
  return ((data as any[] | null) || []).map(c => ({
    id: String(c.id), userId: String(c.user_id), content: String(c.content ?? ''),
    createdAt: String(c.created_at), authorName: String(c.profiles?.full_name || c.profiles?.nickname || ''),
  }))
}

export async function GET(req: NextRequest) {
  const auth = await authenticateStudio(req)
  if (auth instanceof NextResponse) return auth
  const params = req.nextUrl.searchParams
  const what = params.get('what') || 'queue'

  try {
    if (what === 'queue') {
      return studioJson(await queue(auth.supabase, params.get('mode') || 'pending'), 200)
    }
    if (what === 'problem') {
      const challengeId = params.get('challengeId') || null
      const bankItemId = params.get('bankItemId') || null
      if ((challengeId && !UUID.test(challengeId)) || (bankItemId && !UUID.test(bankItemId))) {
        return studioFail('challengeId and bankItemId must be ids.', 400)
      }
      if (!challengeId && !bankItemId) return studioJson({ problem: null }, 200)
      return studioJson({ problem: await problem(auth.supabase, challengeId, bankItemId) }, 200)
    }
    if (what === 'comments') {
      const submissionId = params.get('submissionId') || ''
      if (!UUID.test(submissionId)) return studioFail('submissionId must be an id.', 400)
      return studioJson({ comments: await comments(auth.supabase, submissionId) }, 200)
    }
    if (what === 'members') {
      const classId = params.get('classId') || ''
      if (!UUID.test(classId)) return studioFail('classId must be an id.', 400)
      const { data } = await auth.supabase.from('class_members').select('user_id').eq('class_id', classId)
      return studioJson({ userIds: ((data as any[] | null) || []).map(m => String(m.user_id)) }, 200)
    }
    return studioFail('Ask for queue, problem, comments, or members.', 400)
  } catch (err) {
    console.error('[studio/grading]', err)
    return studioFail('The site could not read that right now. Try again.', 500)
  }
}

/** Tell the assistant what became of its suggestion, through the route that owns that logic. */
async function feedback(req: NextRequest, body: Record<string, unknown>): Promise<'ok' | 'already_resolved' | 'failed'> {
  try {
    const res = await fetch(new URL('/api/ta/feedback', req.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('authorization') || '' },
      body: JSON.stringify(body),
    })
    if (res.status === 409) return 'already_resolved'
    return res.ok ? 'ok' : 'failed'
  } catch {
    return 'failed'
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateStudio(req)
  if (auth instanceof NextResponse) return auth

  let body: any
  try {
    body = await req.json()
  } catch {
    return studioFail('The request body is not valid JSON.', 400)
  }
  const action = body?.action

  if (action === 'flag') {
    const taGradeId = String(body.taGradeId || '')
    const note = String(body.note || '').trim()
    if (!UUID.test(taGradeId)) return studioFail('taGradeId must be an id.', 400)
    if (!note) return studioFail('Say what the assistant missed.', 400)
    const outcome = await feedback(req, { ta_grade_id: taGradeId, action: 'flagged', what_ta_missed: note, lesson_type: 'override' })
    return studioJson({ feedback: outcome }, outcome === 'failed' ? 502 : 200)
  }

  if (action !== 'grade') return studioFail('action must be grade or flag.', 400)

  const submissionId = String(body.submissionId || '')
  if (!UUID.test(submissionId)) return studioFail('submissionId must be an id.', 400)

  const { data: record } = await auth.supabase
    .from('challenge_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('id', submissionId)
    .maybeSingle()
  if (!record) return studioFail('That hand-in no longer exists.', 404)
  const row = rowFromRecord(record)

  const { data: profile } = await auth.supabase.from('profiles').select('full_name, nickname').eq('id', auth.userId).maybeSingle()
  const teacherName = String((profile as any)?.full_name || (profile as any)?.nickname || '')

  let score: number
  try {
    const result = await gradeSubmission(auth.supabase, {
      submissionId,
      studentId: row.userId,
      teacherId: auth.userId,
      teacherName,
      score: body.score,
      maxPoints: row.maxPoints,
      comment: String(body.comment || ''),
      problemTitle: row.problemTitle,
      link: row.challengeId ? `/challenges/${row.challengeId}` : null,
    })
    score = result.score
  } catch (err) {
    if (err instanceof StudioError) {
      if (err.code === 'score') return studioFail(`Enter a whole number between 0 and ${row.maxPoints}.`, 400)
      if (err.code === 'comment') return studioFail(`The grade was saved, but the comment was not: ${err.detail}`, 502)
      return studioFail(`The grade could not be saved: ${err.detail}`, 502)
    }
    throw err
  }

  const { data: ta } = await auth.supabase
    .from('ta_grades')
    .select('id, suggested_score, status')
    .eq('submission_id', submissionId)
    .maybeSingle()
  let outcome: 'ok' | 'already_resolved' | 'failed' | null = null
  let taStatus: string | null = (ta as any)?.status ?? null
  if (ta && (ta as any).status === 'pending') {
    const taAction = score === Number((ta as any).suggested_score) ? 'accepted' : 'overridden'
    outcome = await feedback(req, {
      ta_grade_id: (ta as any).id,
      action: taAction,
      henry_score: score,
      henry_comment: String(body.comment || '').trim() || null,
      what_ta_missed: String(body.note || '').trim() || null,
      lesson_type: taAction === 'accepted' ? 'correct' : 'override',
    })
    if (outcome !== 'failed') taStatus = taAction
  }

  return studioJson({ score, feedback: outcome, taStatus }, 200)
}
