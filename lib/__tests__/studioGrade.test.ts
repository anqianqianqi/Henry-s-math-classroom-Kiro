import { describe, it, expect } from 'vitest'
import { gradeSubmission, requestTaGrade, sendTaFeedback, StudioError, validateScore } from '@/lib/studio/grade'
import { fakeSupabase } from './helpers/fakeSupabase'

/**
 * What one saved grade writes, asserted table by table: the score, the
 * comment as a row on the answer, and the notifications the grading page
 * forgot and the challenge page remembered.
 */

const input = {
  submissionId: 'sub-1',
  studentId: 'student-1',
  teacherId: 'teacher-1',
  teacherName: 'Henry',
  score: 7,
  maxPoints: 10,
  comment: '',
  problemTitle: 'Exponent 11',
  link: '/challenges/ch-1',
}

function calls(db: ReturnType<typeof fakeSupabase>, table: string) {
  return db.calls.filter(c => c.table === table)
}

describe('validateScore', () => {
  it('accepts whole numbers from zero to the maximum, as numbers or typed text', () => {
    expect(validateScore(0, 10)).toBe(0)
    expect(validateScore('10', 10)).toBe(10)
    expect(validateScore(' 7 ', 10)).toBe(7)
  })

  it('refuses fractions, negatives, blanks, and anything above the maximum', () => {
    for (const bad of [2.5, -1, 11, '', 'seven', null, undefined]) {
      expect(() => validateScore(bad, 10)).toThrow(StudioError)
    }
  })
})

describe('gradeSubmission', () => {
  it('writes the score and only the score when there is no comment', async () => {
    const db = fakeSupabase()

    const result = await gradeSubmission(db as any, input)

    expect(result).toEqual({ score: 7, commentId: null, notified: true })
    const update = calls(db, 'challenge_submissions')[0]
    expect(update.op).toBe('update')
    expect(update.payload).toEqual({ points: 7 })
    expect(update.filters).toEqual([['id', 'eq', 'sub-1']])
    expect(calls(db, 'submission_comments')).toHaveLength(0)
  })

  it('tells the student their grade is waiting', async () => {
    const db = fakeSupabase()

    await gradeSubmission(db as any, input)

    const notify = calls(db, 'notifications')[0]
    expect(notify.op).toBe('insert')
    expect(notify.payload).toEqual([{
      user_id: 'student-1',
      type: 'homework_graded',
      title: 'Challenge graded',
      message: 'You received 7/10 on "Exponent 11"',
      link: '/challenges/ch-1',
      is_read: false,
    }])
  })

  it('posts a comment as the teacher and tells the student about that too', async () => {
    const db = fakeSupabase()

    const result = await gradeSubmission(db as any, { ...input, comment: '  Nice use of the identity.  ' })

    const comment = calls(db, 'submission_comments')[0]
    expect(comment.op).toBe('insert')
    expect(comment.payload).toEqual({ submission_id: 'sub-1', user_id: 'teacher-1', content: 'Nice use of the identity.' })
    expect(result.commentId).toBe('submission_comments-1')
    const [graded, commented] = calls(db, 'notifications')[0].payload
    expect(graded.type).toBe('homework_graded')
    expect(commented).toMatchObject({ type: 'new_comment', user_id: 'student-1', link: '/challenges/ch-1' })
    expect(commented.message).toContain('Henry commented')
  })

  it('does not notify a teacher grading their own test hand-in', async () => {
    const db = fakeSupabase()

    const result = await gradeSubmission(db as any, { ...input, studentId: 'teacher-1' })

    expect(result.notified).toBe(false)
    expect(calls(db, 'notifications')).toHaveLength(0)
  })

  it('refuses a bad score before touching the database', async () => {
    const db = fakeSupabase()

    await expect(gradeSubmission(db as any, { ...input, score: '12' })).rejects.toMatchObject({ code: 'score' })
    expect(db.calls).toHaveLength(0)
  })

  it('reports a failed score write and writes nothing else', async () => {
    const db = fakeSupabase({ failures: { challenge_submissions: { update: 'row is locked' } } })

    await expect(gradeSubmission(db as any, { ...input, comment: 'hi' })).rejects.toMatchObject({ code: 'save', detail: 'row is locked' })
    expect(calls(db, 'submission_comments')).toHaveLength(0)
    expect(calls(db, 'notifications')).toHaveLength(0)
  })

  it('says the score was saved when only the comment failed', async () => {
    const db = fakeSupabase({ failures: { submission_comments: { insert: 'comments closed' } } })

    await expect(gradeSubmission(db as any, { ...input, comment: 'hi' })).rejects.toMatchObject({ code: 'comment' })
    expect(calls(db, 'challenge_submissions')).toHaveLength(1)
  })

  it('keeps a saved grade when the notification cannot be written', async () => {
    const db = fakeSupabase({ failures: { notifications: { insert: 'no' } } })

    const result = await gradeSubmission(db as any, input)

    expect(result.notified).toBe(false)
    expect(result.score).toBe(7)
  })

  it('sends no link when the challenge is gone', async () => {
    const db = fakeSupabase()

    await gradeSubmission(db as any, { ...input, link: null, problemTitle: '' })

    const [graded] = calls(db, 'notifications')[0].payload
    expect(graded.link).toBeNull()
    expect(graded.message).toBe('You received 7/10 on "a problem"')
  })
})

function fetcher(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, init: init || {} })
    return { ok: status < 400, status, json: async () => body } as unknown as Response
  }
  return Object.assign(fn, { calls })
}

describe('requestTaGrade', () => {
  it('asks the route as the teacher and reads the suggestion', async () => {
    const f = fetcher(200, {
      ok: true,
      grade: {
        id: 'ta-1', suggested_score: 8, max_score: 10, confidence: 0.91, comment: 'Well reasoned.',
        suggested_solution: 'Factor first.',
        reasoning: { step3_deviation: 'Dropped a sign.', step4_henry_perspective: 'The idea is there.' },
        critic: { grade_changed: true, draft_score: 9, final_score: 8, reasoning: 'One case missed.' },
      },
    })

    const ta = await requestTaGrade(f, 'tok', 'sub-1')

    expect(f.calls[0].url).toBe('/api/ta/grade')
    expect((f.calls[0].init.headers as any).Authorization).toBe('Bearer tok')
    expect(JSON.parse(String(f.calls[0].init.body))).toEqual({ submission_id: 'sub-1' })
    expect(ta).toMatchObject({
      id: 'ta-1', suggestedScore: 8, maxScore: 10, confidence: 0.91, comment: 'Well reasoned.',
      gap: 'Dropped a sign.', view: 'The idea is there.', solution: 'Factor first.',
      criticChanged: true, criticFrom: 9, criticTo: 8, criticReason: 'One case missed.', status: 'pending',
    })
  })

  it('surfaces the route\'s reason when it refuses', async () => {
    const f = fetcher(404, { error: 'Challenge not found' })

    await expect(requestTaGrade(f, 'tok', 'sub-1')).rejects.toMatchObject({ code: 'ta', detail: 'Challenge not found' })
  })
})

describe('sendTaFeedback', () => {
  it('reports an override with the teacher\'s score, comment, and note', async () => {
    const f = fetcher(200, { ok: true })

    const outcome = await sendTaFeedback(f, 'tok', { taGradeId: 'ta-1', action: 'overridden', score: 6, comment: 'See line 3.', note: 'Missed the second root.' })

    expect(outcome).toBe('ok')
    expect(JSON.parse(String(f.calls[0].init.body))).toEqual({
      ta_grade_id: 'ta-1', action: 'overridden', henry_score: 6, henry_comment: 'See line 3.',
      what_ta_missed: 'Missed the second root.', lesson_type: 'override',
    })
  })

  it('sends nulls rather than empty strings, and calls an acceptance correct', async () => {
    const f = fetcher(200, { ok: true })

    await sendTaFeedback(f, 'tok', { taGradeId: 'ta-1', action: 'accepted', score: 8, comment: '  ' })

    expect(JSON.parse(String(f.calls[0].init.body))).toMatchObject({ henry_comment: null, what_ta_missed: null, lesson_type: 'correct' })
  })

  it('treats an already reviewed grade as settled, not as an error', async () => {
    const f = fetcher(409, { error: 'already_resolved' })

    expect(await sendTaFeedback(f, 'tok', { taGradeId: 'ta-1', action: 'accepted', score: 8, comment: '' })).toBe('already_resolved')
  })
})
