/**
 * What the grading desk writes, and how it talks to the assistant.
 *
 * The score write is the same single UPDATE the grading page makes. The rest
 * is what the challenge page does around it and the grading page forgot: the
 * comment as a row on the answer, and the notification that tells the student
 * a grade is waiting. The wallet needs nothing from here; a database trigger
 * recalculates it whenever points change.
 *
 * Errors carry a code rather than a sentence, because the sentence belongs to
 * the catalog: the page turns the code into the teacher's language.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { taFromResponse, type TaSuggestion } from './queue'

type Db = SupabaseClient<any, any, any>

export type StudioErrorCode = 'score' | 'save' | 'comment' | 'ta' | 'feedback'

export class StudioError extends Error {
  code: StudioErrorCode
  detail: string

  constructor(code: StudioErrorCode, detail = '') {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'StudioError'
    this.code = code
    this.detail = detail
  }
}

/**
 * A whole number from 0 to the maximum, or a 'score' error.
 *
 * Digits only, checked as text: Number('') is 0, and a blank box saved as a
 * zero would be a grade the teacher never gave.
 */
export function validateScore(value: unknown, maxPoints: number): number {
  const text = typeof value === 'number' ? String(value) : String(value ?? '').trim()
  if (!/^\d+$/.test(text)) throw new StudioError('score')
  const n = Number(text)
  if (n > maxPoints) throw new StudioError('score')
  return n
}

export interface GradeInput {
  submissionId: string
  studentId: string
  teacherId: string
  teacherName: string
  score: number | string
  maxPoints: number
  /** Empty for no comment. */
  comment: string
  problemTitle: string
  /** Where the notification sends the student; null when the challenge is gone. */
  link: string | null
}

export interface GradeResult {
  score: number
  commentId: string | null
  notified: boolean
}

export async function gradeSubmission(supabase: Db, input: GradeInput): Promise<GradeResult> {
  const score = validateScore(input.score, input.maxPoints)

  const { error: saveError } = await supabase
    .from('challenge_submissions')
    .update({ points: score })
    .eq('id', input.submissionId)
  if (saveError) throw new StudioError('save', saveError.message)

  let commentId: string | null = null
  const comment = input.comment.trim()
  if (comment) {
    const { data, error: commentError } = await supabase
      .from('submission_comments')
      .insert({ submission_id: input.submissionId, user_id: input.teacherId, content: comment })
      .select('id')
      .single()
    // The score is already saved at this point; the caller says so.
    if (commentError) throw new StudioError('comment', commentError.message)
    commentId = data?.id ? String(data.id) : null
  }

  let notified = false
  if (input.studentId && input.studentId !== input.teacherId) {
    const title = input.problemTitle || 'a problem'
    const rows: Record<string, unknown>[] = [{
      user_id: input.studentId,
      type: 'homework_graded',
      title: 'Challenge graded',
      message: `You received ${score}/${input.maxPoints} on "${title}"`,
      link: input.link,
      is_read: false,
    }]
    if (comment) {
      rows.push({
        user_id: input.studentId,
        type: 'new_comment',
        title: 'New comment',
        message: `${input.teacherName || 'Your teacher'} commented on your solution for "${title}"`,
        link: input.link,
        is_read: false,
      })
    }
    // A failed notification must not undo a saved grade, so it only reports.
    const { error: notifyError } = await supabase.from('notifications').insert(rows)
    notified = !notifyError
  }

  return { score, commentId, notified }
}

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

function authed(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function bodyOf(res: Response): Promise<any> {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

/** Ask the assistant to grade one submission. Slow: several model calls. */
export async function requestTaGrade(fetcher: Fetcher, token: string, submissionId: string): Promise<TaSuggestion> {
  const res = await fetcher('/api/ta/grade', {
    method: 'POST',
    headers: authed(token),
    body: JSON.stringify({ submission_id: submissionId }),
  })
  const body = await bodyOf(res)
  if (!res.ok || !body?.grade) throw new StudioError('ta', String(body?.error || `HTTP ${res.status}`))
  return taFromResponse(body.grade)
}

export interface FeedbackInput {
  taGradeId: string
  action: 'accepted' | 'overridden' | 'flagged'
  score: number
  comment: string
  /** What the assistant missed, for an override or a flag. */
  note?: string
}

/** Tell the assistant what happened to its suggestion, so the correction log grows. */
export async function sendTaFeedback(fetcher: Fetcher, token: string, input: FeedbackInput): Promise<'ok' | 'already_resolved'> {
  const res = await fetcher('/api/ta/feedback', {
    method: 'POST',
    headers: authed(token),
    body: JSON.stringify({
      ta_grade_id: input.taGradeId,
      action: input.action,
      henry_score: input.score,
      henry_comment: input.comment.trim() || null,
      what_ta_missed: input.note?.trim() || null,
      lesson_type: input.action === 'accepted' ? 'correct' : 'override',
    }),
  })
  if (res.status === 409) return 'already_resolved'
  if (!res.ok) {
    const body = await bodyOf(res)
    throw new StudioError('feedback', String(body?.error || `HTTP ${res.status}`))
  }
  return 'ok'
}
