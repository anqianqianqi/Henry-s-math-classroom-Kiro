import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { fakeSupabase, type FakeOptions } from './helpers/fakeSupabase'

/**
 * The grading route: what the Studio reads and the one write it makes,
 * asserted against the fake. The assistant's feedback route is reached by a
 * server-side fetch, stubbed here, so the forwarded key is visible.
 */

const ORIGINAL_ENV = { ...process.env }
let fake: ReturnType<typeof fakeSupabase>
let fetchMock: ReturnType<typeof vi.fn>

const TEACHER = '11111111-2222-4333-8444-555555555555'
const STUDENT = '22222222-2222-4333-8444-555555555555'
const SUBMISSION = '33333333-2222-4333-8444-555555555555'
const CHALLENGE = '44444444-2222-4333-8444-555555555555'
const BANK = '55555555-2222-4333-8444-555555555555'
const TA = '66666666-2222-4333-8444-555555555555'
const KEYED = { STUDIO_IMPORT_KEY: 'k-secret', STUDIO_IMPORT_TEACHER: TEACHER, SUPABASE_SERVICE_ROLE_KEY: 'service-key' }

const submission = {
  id: SUBMISSION, user_id: STUDENT, challenge_id: CHALLENGE, bank_item_id: null, content: '36', image_url: null,
  points: null, is_locked: false, submitted_at: '2026-09-12T10:00:00Z',
  profiles: { full_name: 'Ada Lovelace', email: 'ada@example.com' },
  daily_challenges: { title: 'Exponent 11', challenge_date: '2026-09-12', max_points: 10 },
  challenge_bank: null,
}
const taRow = { id: TA, submission_id: SUBMISSION, suggested_score: 8, max_score: 10, confidence: 0.9, suggested_comment: 'Nice.', reasoning: {}, status: 'pending', henry_score: null }

async function load(opts: FakeOptions = {}, env: Record<string, string> = KEYED, feedbackStatus = 200) {
  vi.resetModules()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  Object.assign(process.env, env)
  fake = fakeSupabase(opts)
  vi.doMock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => fake) }))
  fetchMock = vi.fn(async () => ({ ok: feedbackStatus < 400, status: feedbackStatus, json: async () => ({ ok: true }) }))
  vi.stubGlobal('fetch', fetchMock)
  return await import('@/app/api/studio/grading/route')
}

function get(query: string, token: string | null = 'k-secret') {
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  return new NextRequest(`https://site.test/api/studio/grading${query}`, { method: 'GET', headers })
}

function post(body: unknown, token: string | null = 'k-secret') {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return new NextRequest('https://site.test/api/studio/grading', { method: 'POST', headers, body: JSON.stringify(body) })
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.doUnmock('@supabase/supabase-js')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GET /api/studio/grading', () => {
  it('needs the key or a teacher, like the import route', async () => {
    const { GET } = await load()
    expect((await GET(get('?what=queue', null))).status).toBe(401)
    expect((await GET(get('?what=queue', 'bad-token'))).status).toBe(401)
  })

  it('serves the pending queue shaped like the desk, with the assistant attached and the classes', async () => {
    const { GET } = await load({ rows: { challenge_submissions: [submission], ta_grades: [taRow], classes: [{ id: 'c1', name: 'Algebra 1' }] } })

    const res = await GET(get('?what=queue&mode=pending'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows).toHaveLength(1)
    expect(body.rows[0]).toMatchObject({ id: SUBMISSION, studentName: 'Ada Lovelace', problemTitle: 'Exponent 11', maxPoints: 10, points: null })
    expect(body.rows[0].ta).toMatchObject({ id: TA, suggestedScore: 8, confidence: 0.9, status: 'pending' })
    expect(body.classes).toEqual([{ id: 'c1', name: 'Algebra 1' }])
    const select = fake.calls.find(c => c.table === 'challenge_submissions')!
    expect(select.filters).toEqual([['points', 'is', null]])
  })

  it('asks for graded rows the other way round', async () => {
    const { GET } = await load()

    await GET(get('?what=queue&mode=graded'))

    expect(fake.calls.find(c => c.table === 'challenge_submissions')!.filters).toEqual([['points', 'not.is', null]])
  })

  it('finds a problem by challenge, falls back to the bank, and admits when it is gone', async () => {
    let route = await load({ rows: { daily_challenges: [{ id: CHALLENGE, title: 'Exponent 11', description: 'Solve.', henryproblem: null, image_url: null, max_points: 10 }] } })
    let body = await (await route.GET(get(`?what=problem&challengeId=${CHALLENGE}`))).json()
    expect(body.problem).toMatchObject({ title: 'Exponent 11', maxPoints: 10, gone: false, key: `challenge:${CHALLENGE}` })

    route = await load({ rows: { challenge_bank: [{ id: BANK, title: 'Angle 3', description: null, henryproblem: { format: 'x' }, image_url: 'u', max_points: 5 }] } })
    body = await (await route.GET(get(`?what=problem&challengeId=${CHALLENGE}&bankItemId=${BANK}`))).json()
    expect(body.problem).toMatchObject({ title: 'Angle 3', maxPoints: 5, gone: false, imageUrl: 'u' })

    route = await load()
    body = await (await route.GET(get(`?what=problem&challengeId=${CHALLENGE}`))).json()
    expect(body.problem.gone).toBe(true)

    expect((await route.GET(get('?what=problem&challengeId=nope'))).status).toBe(400)
  })

  it('serves a hand-in\'s comments with their authors', async () => {
    const { GET } = await load({ rows: { submission_comments: [{ id: 'c1', user_id: STUDENT, content: 'hi', created_at: 't', profiles: { full_name: 'Ada' } }] } })

    const body = await (await GET(get(`?what=comments&submissionId=${SUBMISSION}`))).json()

    expect(body.comments).toEqual([{ id: 'c1', userId: STUDENT, content: 'hi', createdAt: 't', authorName: 'Ada' }])
  })

  it('serves a class\'s members and refuses anything else', async () => {
    const { GET } = await load({ rows: { class_members: [{ user_id: STUDENT }] } })

    expect(await (await GET(get(`?what=members&classId=${CHALLENGE}`))).json()).toEqual({ userIds: [STUDENT] })
    expect((await GET(get('?what=everything'))).status).toBe(400)
  })
})

describe('POST /api/studio/grading', () => {
  it('grades: writes the score, the comment, the notifications, and tells the assistant, key forwarded', async () => {
    const { POST } = await load({ rows: { challenge_submissions: [submission], ta_grades: [taRow] }, profileRow: { full_name: 'Henry' } })

    const res = await POST(post({ action: 'grade', submissionId: SUBMISSION, score: 7, comment: 'Check the sign.', note: 'Missed a case.' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ score: 7, feedback: 'ok', taStatus: 'overridden' })
    const update = fake.calls.find(c => c.table === 'challenge_submissions' && c.op === 'update')!
    expect(update.payload).toEqual({ points: 7 })
    const comment = fake.calls.find(c => c.table === 'submission_comments' && c.op === 'insert')!
    expect(comment.payload).toEqual({ submission_id: SUBMISSION, user_id: TEACHER, content: 'Check the sign.' })
    const notify = fake.calls.find(c => c.table === 'notifications')!
    expect(notify.payload.map((n: any) => n.type)).toEqual(['homework_graded', 'new_comment'])
    expect(notify.payload[0].user_id).toBe(STUDENT)

    const [url, init] = fetchMock.mock.calls[0] as any
    expect(String(url)).toBe('https://site.test/api/ta/feedback')
    expect(init.headers.Authorization).toBe('Bearer k-secret')
    expect(JSON.parse(init.body)).toEqual({
      ta_grade_id: TA, action: 'overridden', henry_score: 7, henry_comment: 'Check the sign.', what_ta_missed: 'Missed a case.', lesson_type: 'override',
    })
  })

  it('calls the same score an acceptance and leaves the assistant alone when nothing is pending', async () => {
    let route = await load({ rows: { challenge_submissions: [submission], ta_grades: [taRow] } })
    let body = await (await route.POST(post({ action: 'grade', submissionId: SUBMISSION, score: 8 }))).json()
    expect(body).toEqual({ score: 8, feedback: 'ok', taStatus: 'accepted' })
    expect(JSON.parse((fetchMock.mock.calls[0] as any)[1].body)).toMatchObject({ action: 'accepted', lesson_type: 'correct', henry_comment: null })

    route = await load({ rows: { challenge_submissions: [submission] } })
    body = await (await route.POST(post({ action: 'grade', submissionId: SUBMISSION, score: 8 }))).json()
    expect(body).toEqual({ score: 8, feedback: null, taStatus: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still saves the grade when the assistant cannot be told', async () => {
    const { POST } = await load({ rows: { challenge_submissions: [submission], ta_grades: [taRow] } }, KEYED, 500)

    const body = await (await POST(post({ action: 'grade', submissionId: SUBMISSION, score: 8 }))).json()

    expect(body).toEqual({ score: 8, feedback: 'failed', taStatus: 'pending' })
    expect(fake.calls.some(c => c.table === 'challenge_submissions' && c.op === 'update')).toBe(true)
  })

  it('refuses a bad score with the maximum, and a hand-in that is gone', async () => {
    const { POST } = await load({ rows: { challenge_submissions: [submission] } })

    let res = await POST(post({ action: 'grade', submissionId: SUBMISSION, score: 11 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/between 0 and 10/)
    expect(fake.calls.some(c => c.op === 'update')).toBe(false)

    const gone = await load()
    res = await gone.POST(post({ action: 'grade', submissionId: SUBMISSION, score: 5 }))
    expect(res.status).toBe(404)
  })

  it('flags without grading', async () => {
    const { POST } = await load()

    const res = await POST(post({ action: 'flag', taGradeId: TA, note: 'It read the fraction wrong.' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ feedback: 'ok' })
    expect(JSON.parse((fetchMock.mock.calls[0] as any)[1].body)).toMatchObject({ ta_grade_id: TA, action: 'flagged', what_ta_missed: 'It read the fraction wrong.' })
    expect(fake.calls.some(c => c.op === 'update')).toBe(false)
    expect((await POST(post({ action: 'flag', taGradeId: TA, note: '  ' }))).status).toBe(400)
  })

  it('answers preflight for any origin', async () => {
    const { OPTIONS } = await load()
    const res = await OPTIONS()
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })
})
