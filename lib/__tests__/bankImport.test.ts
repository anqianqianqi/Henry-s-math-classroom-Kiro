import { describe, it, expect } from 'vitest'
import { parseHenryProblemValue } from '@/lib/henryproblem'
import {
  BANK_IMAGE_BUCKET,
  BankImportError,
  importProblemToBank,
  loadKnownTags,
} from '@/lib/challenges/bank'
import { fakeSupabase, studioSnapshot, PARTIAL_CROP, TINY_PNG } from './helpers/fakeSupabase'

/**
 * The write sequence, asserted call by call. These pin the three choices that
 * differ from the batch-import page: one insert with the picture in place, a
 * failed picture failing the import, and updating by id.
 */

const uid = 'teacher-1'
const TAGS = [
  { id: 'tag-algebra', names: [{ language: 'zh', name: '代数' }, { language: 'en', name: 'Algebra' }] },
]
const graph = { format: 'png', encoding: 'base64', data: TINY_PNG }

describe('importProblemToBank', () => {
  it('inserts once, with the diagram uploaded first and its url in the row', async () => {
    const db = fakeSupabase({ tags: TAGS })
    const parsed = parseHenryProblemValue(studioSnapshot({ problem: { mode: 'graph' }, graph }))

    const result = await importProblemToBank(db as any, { parsed, userId: uid, sourceRevision: 'rev-1' })

    expect(result.created).toBe(true)
    const bankCalls = db.calls.filter(c => c.table === 'challenge_bank')
    expect(bankCalls).toHaveLength(1)
    const insert = bankCalls[0]
    expect(insert.op).toBe('insert')
    expect(insert.payload.id).toBe(result.id)
    expect(insert.payload.created_by).toBe(uid)
    expect(insert.payload.image_url).toBe(
      `https://example.supabase.co/storage/v1/object/public/${BANK_IMAGE_BUCKET}/${uid}/${result.id}.png`
    )
    expect(db.uploads).toHaveLength(1)
    expect(db.uploads[0].path).toBe(`${uid}/${result.id}.png`)
    expect(db.uploads[0].options).toMatchObject({ upsert: true, contentType: 'image/png' })
    // The full-frame embedded picture is what got uploaded.
    expect(Array.from(db.uploads[0].bytes)).toEqual(Array.from(Buffer.from(TINY_PNG, 'base64')))
  })

  it('stores the snapshot without the rich editor documents or local paths', async () => {
    const db = fakeSupabase({ tags: TAGS })
    const parsed = parseHenryProblemValue(studioSnapshot())

    await importProblemToBank(db as any, { parsed, userId: uid, sourceRevision: 'rev-1' })

    const stored = db.calls.find(c => c.table === 'challenge_bank')!.payload.henryproblem
    expect(stored.source_revision).toBe('rev-1')
    expect(stored.source_basename).toBe('Custom Function 1')
    expect(stored.problem.editor_documents).toBeUndefined()
    expect(stored.source_file).toBeUndefined()
    expect(stored.preview_file).toBeUndefined()
    expect(stored.graph).toBeUndefined()
  })

  it('takes title, wording, and points from the snapshot', async () => {
    const db = fakeSupabase({ tags: TAGS })
    const parsed = parseHenryProblemValue(studioSnapshot())

    await importProblemToBank(db as any, { parsed, userId: uid })

    const row = db.calls.find(c => c.table === 'challenge_bank')!.payload
    expect(row.title).toBe('Custom Function 1')
    expect(row.max_points).toBe(3)
    expect(row.description).toContain('find where the graph')
    expect(row.description).toContain('假设有一个函数')
  })

  it('reuses an existing tag under any language and creates the rest once', async () => {
    const db = fakeSupabase({ tags: TAGS })
    const parsed = parseHenryProblemValue(
      studioSnapshot({ problem: { tags: ['algebra', 'Function', 'function'] } })
    )

    const result = await importProblemToBank(db as any, { parsed, userId: uid })

    expect(result.tagIds).toEqual(['tag-algebra', 'tag-new-1'])
    expect(result.skippedTags).toEqual([])
    const tagInserts = db.calls.filter(c => c.table === 'challenge_tags' && c.op === 'insert')
    expect(tagInserts).toHaveLength(1)
    expect(tagInserts[0].payload).toEqual({ name: 'function', created_by: uid })
    const nameInsert = db.calls.find(c => c.table === 'challenge_tag_names')!
    expect(nameInsert.payload).toEqual({ tag_id: 'tag-new-1', language: 'en', name: 'Function' })
    expect(db.calls.find(c => c.table === 'challenge_bank')!.payload.tag_ids).toEqual(result.tagIds)
  })

  it('adds extra tag ids without duplicating one the snapshot already resolved', async () => {
    const db = fakeSupabase({ tags: TAGS })
    const parsed = parseHenryProblemValue(studioSnapshot({ problem: { tags: ['Algebra'] } }))

    const result = await importProblemToBank(db as any, {
      parsed, userId: uid, extraTagIds: ['tag-algebra', 'tag-daily'],
    })

    expect(result.tagIds).toEqual(['tag-algebra', 'tag-daily'])
  })

  it('reports a tag it could not create instead of failing the problem', async () => {
    const db = fakeSupabase({ failTagInsert: true })
    const parsed = parseHenryProblemValue(studioSnapshot({ problem: { tags: ['Brand New'] } }))

    const result = await importProblemToBank(db as any, { parsed, userId: uid })

    expect(result.created).toBe(true)
    expect(result.tagIds).toEqual([])
    expect(result.skippedTags).toEqual(['Brand New'])
  })

  it('refuses a partial crop with no cropped picture, before writing anything', async () => {
    const db = fakeSupabase()
    const parsed = parseHenryProblemValue(
      studioSnapshot({ problem: { mode: 'graph', graph_crop: PARTIAL_CROP }, graph })
    )

    await expect(importProblemToBank(db as any, { parsed, userId: uid }))
      .rejects.toBeInstanceOf(BankImportError)
    expect(db.calls).toHaveLength(0)
    expect(db.uploads).toHaveLength(0)
  })

  it('uploads the cropped picture it is given rather than the embedded original', async () => {
    const db = fakeSupabase()
    const parsed = parseHenryProblemValue(
      studioSnapshot({ problem: { mode: 'graph', graph_crop: PARTIAL_CROP }, graph })
    )
    const bytes = new Uint8Array([1, 2, 3])

    const result = await importProblemToBank(db as any, {
      parsed, userId: uid, image: { bytes, contentType: 'image/jpeg' },
    })

    expect(db.uploads).toHaveLength(1)
    expect(db.uploads[0].bytes).toBe(bytes)
    expect(db.uploads[0].path).toBe(`${uid}/${result.id}.jpg`)
    expect(db.uploads[0].options.contentType).toBe('image/jpeg')
    expect(result.imageUrl).toContain(`${uid}/${result.id}.jpg`)
  })

  it('allows a graph problem whose diagram has not been attached yet', async () => {
    const db = fakeSupabase()
    const parsed = parseHenryProblemValue(studioSnapshot({ problem: { mode: 'graph' }, graph: null }))

    const result = await importProblemToBank(db as any, { parsed, userId: uid })

    expect(db.uploads).toHaveLength(0)
    expect(result.imageUrl).toBeNull()
  })

  it('stores no picture for a problem without a diagram', async () => {
    const db = fakeSupabase()
    const parsed = parseHenryProblemValue(studioSnapshot())

    const result = await importProblemToBank(db as any, { parsed, userId: uid })

    expect(db.uploads).toHaveLength(0)
    expect(result.imageUrl).toBeNull()
    expect(db.calls.find(c => c.table === 'challenge_bank')!.payload.image_url).toBeNull()
  })

  it('fails the import when the diagram upload fails, leaving no row behind', async () => {
    const db = fakeSupabase({ failUpload: true })
    const parsed = parseHenryProblemValue(studioSnapshot({ problem: { mode: 'graph' }, graph }))

    await expect(importProblemToBank(db as any, { parsed, userId: uid }))
      .rejects.toThrow(/could not be uploaded/)
    expect(db.calls.filter(c => c.table === 'challenge_bank')).toHaveLength(0)
  })

  it('updates the existing row when given its id', async () => {
    const db = fakeSupabase()
    const parsed = parseHenryProblemValue(studioSnapshot())
    const id = '11111111-2222-4333-8444-555555555555'

    const result = await importProblemToBank(db as any, {
      parsed, userId: uid, bankId: id, sourceRevision: 'rev-2',
    })

    expect(result).toMatchObject({ id, created: false })
    const update = db.calls.find(c => c.table === 'challenge_bank' && c.op === 'update')!
    expect(update.filters).toEqual([['id', 'eq', id]])
    expect(update.payload.created_by).toBeUndefined()
    expect(update.payload.id).toBeUndefined()
    expect(update.payload.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(update.payload.henryproblem.source_revision).toBe('rev-2')
    expect(db.calls.some(c => c.table === 'challenge_bank' && c.op === 'insert')).toBe(false)
  })

  it('keeps the picture at the same path on update, so the old url stays valid', async () => {
    const db = fakeSupabase()
    const parsed = parseHenryProblemValue(studioSnapshot({ problem: { mode: 'graph' }, graph }))
    const id = '11111111-2222-4333-8444-555555555555'

    await importProblemToBank(db as any, { parsed, userId: uid, bankId: id })

    expect(db.uploads[0].path).toBe(`${uid}/${id}.png`)
    expect(db.uploads[0].options.upsert).toBe(true)
  })

  it('says so when the row to update is gone', async () => {
    const db = fakeSupabase({ updateMissing: true })
    const parsed = parseHenryProblemValue(studioSnapshot())

    await expect(importProblemToBank(db as any, {
      parsed, userId: uid, bankId: '11111111-2222-4333-8444-555555555555',
    })).rejects.toThrow(/could not be updated/)
  })

  it('takes title and points overrides and rejects points that are not whole', async () => {
    const db = fakeSupabase()
    const parsed = parseHenryProblemValue(studioSnapshot())

    await importProblemToBank(db as any, { parsed, userId: uid, title: '  Renamed  ', maxPoints: 5 })

    const row = db.calls.find(c => c.table === 'challenge_bank')!.payload
    expect(row.title).toBe('Renamed')
    expect(row.max_points).toBe(5)

    await expect(importProblemToBank(fakeSupabase() as any, { parsed, userId: uid, maxPoints: 0 }))
      .rejects.toThrow(/whole number/)
    await expect(importProblemToBank(fakeSupabase() as any, { parsed, userId: uid, maxPoints: 2.5 }))
      .rejects.toThrow(/whole number/)
  })

  it('falls back to the default points when the snapshot has no score', async () => {
    const db = fakeSupabase()
    const parsed = parseHenryProblemValue(studioSnapshot({ problem: { score: '' } }))

    await importProblemToBank(db as any, { parsed, userId: uid })

    expect(db.calls.find(c => c.table === 'challenge_bank')!.payload.max_points).toBe(100)
  })

  it('names an untitled problem after its file', async () => {
    const db = fakeSupabase()
    const parsed = parseHenryProblemValue(studioSnapshot({ problem: { title: '' } }))

    await importProblemToBank(db as any, { parsed, userId: uid })

    expect(db.calls.find(c => c.table === 'challenge_bank')!.payload.title).toBe('Custom Function 1')
  })

  it('skips the tag lookup when the caller already has the tags', async () => {
    const db = fakeSupabase()
    const parsed = parseHenryProblemValue(studioSnapshot({ problem: { tags: ['Algebra'] } }))

    const result = await importProblemToBank(db as any, { parsed, userId: uid }, [
      { id: 'tag-algebra', names: ['Algebra'] },
    ])

    expect(result.tagIds).toEqual(['tag-algebra'])
    expect(db.calls.some(c => c.table === 'challenge_tags')).toBe(false)
  })
})

describe('loadKnownTags', () => {
  it('shapes every localized name onto its tag', async () => {
    const db = fakeSupabase({ tags: TAGS })

    expect(await loadKnownTags(db as any)).toEqual([{ id: 'tag-algebra', names: ['代数', 'Algebra'] }])
  })
})
