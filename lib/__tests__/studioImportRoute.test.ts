import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { fakeSupabase, studioSnapshot, PARTIAL_CROP, TINY_PNG, type FakeOptions } from './helpers/fakeSupabase'

/**
 * The route's contract with the Studio: who may call it, how a request turns
 * into an import, and what comes back. supabase-js is replaced with the fake,
 * so these never touch a database.
 */

const ORIGINAL_ENV = { ...process.env }
let fake: ReturnType<typeof fakeSupabase>

async function load(opts: FakeOptions = {}) {
  vi.resetModules()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  fake = fakeSupabase(opts)
  const createClient = vi.fn(() => fake)
  vi.doMock('@supabase/supabase-js', () => ({ createClient }))
  const route = await import('@/app/api/studio/import/route')
  return { ...route, createClient }
}

function post(body: unknown, token: string | null = 'good-token') {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return new NextRequest('http://localhost/api/studio/import', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function get(query = '', token: string | null = 'good-token') {
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  return new NextRequest(`http://localhost/api/studio/import${query}`, { method: 'GET', headers })
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.doUnmock('@supabase/supabase-js')
  vi.restoreAllMocks()
})

const TAGS = [{ id: 'tag-algebra', names: [{ language: 'en', name: 'Algebra' }] }]

describe('POST /api/studio/import', () => {
  it('refuses a call with no token before touching anything', async () => {
    const { POST, createClient } = await load()

    const res = await POST(post({ snapshot: studioSnapshot() }, null))

    expect(res.status).toBe(401)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('refuses a token that does not resolve to a user', async () => {
    const { POST } = await load()

    const res = await POST(post({ snapshot: studioSnapshot() }, 'bad-token'))

    expect(res.status).toBe(401)
    expect(fake.calls).toHaveLength(0)
  })

  it('refuses a signed-in student', async () => {
    const { POST } = await load({ roles: ['student'] })

    const res = await POST(post({ snapshot: studioSnapshot() }))

    expect(res.status).toBe(403)
    expect(fake.calls.map(c => c.table)).toEqual(['user_roles'])
  })

  it('imports as the caller, never with a service key, and reports the new row', async () => {
    const { POST, createClient } = await load({ tags: TAGS })

    const res = await POST(post({ snapshot: studioSnapshot(), revision: 'rev-1' }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.created).toBe(true)
    expect(body.tagIds).toEqual(['tag-algebra', 'tag-new-1'])
    expect(body.skippedTags).toEqual([])
    expect(body.imageUrl).toBeNull()

    const [url, key, options] = createClient.mock.calls[0] as unknown as [string, string, any]
    expect(url).toBe('https://example.supabase.co')
    expect(key).toBe('anon-key')
    expect(options.global.headers.Authorization).toBe('Bearer good-token')

    const insert = fake.calls.find(c => c.table === 'challenge_bank' && c.op === 'insert')!
    expect(insert.payload.id).toBe(body.id)
    expect(insert.payload.created_by).toBe('teacher-1')
    expect(insert.payload.henryproblem.source_revision).toBe('rev-1')
  })

  it('accepts the raw file text as the snapshot', async () => {
    const { POST } = await load()

    const res = await POST(post({ snapshot: JSON.stringify(studioSnapshot()) }))

    expect(res.status).toBe(201)
  })

  it('decodes the cropped picture and uploads it under the caller', async () => {
    const { POST } = await load()
    const snapshot = studioSnapshot({ problem: { mode: 'graph', graph_crop: PARTIAL_CROP } })

    const res = await POST(post({
      snapshot,
      image: { base64: Buffer.from([1, 2, 3]).toString('base64') },
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(fake.uploads).toHaveLength(1)
    expect(Array.from(fake.uploads[0].bytes)).toEqual([1, 2, 3])
    expect(fake.uploads[0].path).toBe(`teacher-1/${body.id}.png`)
    expect(body.imageUrl).toContain(`teacher-1/${body.id}.png`)
  })

  it('tells the teacher when a partial crop arrives without its picture', async () => {
    const { POST } = await load()
    const snapshot = studioSnapshot({
      problem: { mode: 'graph', graph_crop: PARTIAL_CROP },
      graph: { format: 'png', encoding: 'base64', data: TINY_PNG },
    })

    const res = await POST(post({ snapshot }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/cropping/)
    expect(fake.uploads).toHaveLength(0)
  })

  it('rejects a picture over 3 MB with advice', async () => {
    const { POST } = await load()
    const big = Buffer.alloc(3 * 1024 * 1024 + 1).toString('base64')

    const res = await POST(post({ snapshot: studioSnapshot(), image: { base64: big } }))

    expect(res.status).toBe(413)
    expect((await res.json()).error).toMatch(/1600/)
  })

  it('rejects a snapshot that is not one, with the reader\'s message', async () => {
    const { POST } = await load()

    const res = await POST(post({ snapshot: { hello: 'world' } }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/not a Henry Math editable problem file/)
  })

  it('rejects a body that is not JSON', async () => {
    const { POST } = await load()

    const res = await POST(post('{not json'))

    expect(res.status).toBe(400)
  })

  it('updates when a bank id is given', async () => {
    const { POST } = await load()
    const id = '11111111-2222-4333-8444-555555555555'

    const res = await POST(post({ snapshot: studioSnapshot(), bankId: id, revision: 'rev-2' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id, created: false })
    const update = fake.calls.find(c => c.table === 'challenge_bank')!
    expect(update.op).toBe('update')
    expect(update.filters).toEqual([['id', 'eq', id]])
  })

  it('rejects a malformed bank id and bad points before importing', async () => {
    const { POST } = await load()

    expect((await POST(post({ snapshot: studioSnapshot(), bankId: 'nope' }))).status).toBe(400)
    expect((await POST(post({ snapshot: studioSnapshot(), maxPoints: 0 }))).status).toBe(400)
    expect((await POST(post({ snapshot: studioSnapshot(), maxPoints: 'three' }))).status).toBe(400)
    expect(fake.calls.some(c => c.table === 'challenge_bank')).toBe(false)
  })

  it('passes overrides through', async () => {
    const { POST } = await load({ tags: TAGS })

    const res = await POST(post({
      snapshot: studioSnapshot(),
      title: 'Renamed',
      maxPoints: 7,
      extraTagIds: ['tag-daily', 42],
    }))

    expect(res.status).toBe(201)
    const row = fake.calls.find(c => c.table === 'challenge_bank')!.payload
    expect(row.title).toBe('Renamed')
    expect(row.max_points).toBe(7)
    expect(row.tag_ids).toContain('tag-daily')
    expect(row.tag_ids).not.toContain(42)
  })
})

describe('GET /api/studio/import', () => {
  const row = {
    id: 'bank-1',
    title: 'Custom Function 1',
    image_url: null,
    updated_at: '2026-09-09T00:00:00Z',
    henryproblem: { source_basename: 'Custom Function 1', source_revision: 'rev-1' },
  }

  it('requires a teacher like POST does', async () => {
    const { GET } = await load({ roles: [] })

    expect((await GET(get('', null))).status).toBe(401)
    expect((await GET(get())).status).toBe(403)
  })

  it('finds the rows imported from one snapshot name', async () => {
    const { GET } = await load({ bankRows: [row] })

    const res = await GET(get('?basename=Custom%20Function%201'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      items: [{
        id: 'bank-1',
        title: 'Custom Function 1',
        sourceBasename: 'Custom Function 1',
        sourceRevision: 'rev-1',
        imageUrl: null,
        updatedAt: '2026-09-09T00:00:00Z',
      }],
    })
    const select = fake.calls.find(c => c.table === 'challenge_bank')!
    expect(select.filters).toEqual([['henryproblem->>source_basename', 'eq', 'Custom Function 1']])
  })

  it('lists every snapshot-born row when no name is given', async () => {
    const { GET } = await load({ bankRows: [row, { ...row, id: 'bank-2', henryproblem: { source_basename: 'Angle 3' } }] })

    const res = await GET(get())

    const { items } = await res.json()
    expect(items.map((i: any) => [i.id, i.sourceBasename, i.sourceRevision]))
      .toEqual([['bank-1', 'Custom Function 1', 'rev-1'], ['bank-2', 'Angle 3', null]])
    const select = fake.calls.find(c => c.table === 'challenge_bank')!
    expect(select.filters).toEqual([['henryproblem->>source_basename', 'not.is', null]])
  })
})
