/**
 * A stand-in for supabase-js that records every call and answers from a small
 * script, so the import sequence can be asserted without a database.
 *
 * Only the surface the bank import uses is modelled: chained query builders
 * that are awaited, auth.getUser, and storage upload / getPublicUrl. Each
 * builder is thenable, which is how supabase-js's real ones behave.
 */

export interface FakeCall {
  table: string
  op: 'select' | 'insert' | 'update'
  payload?: any
  select?: string
  filters: Array<[column: string, op: string, value: unknown]>
  single?: boolean
}

export interface FakeUpload {
  bucket: string
  path: string
  bytes: Uint8Array
  options: any
}

export interface FakeOptions {
  /** Existing tags with their localized names. */
  tags?: Array<{ id: string; names: Array<{ language: string; name: string }> }>
  /** Who a token resolves to; null means every token is rejected. */
  user?: { id: string } | null
  /** Global role names for that user. */
  roles?: string[]
  /** Make every challenge_tags insert fail. */
  failTagInsert?: boolean
  /** Make every storage upload fail. */
  failUpload?: boolean
  /** Make an update match no row. */
  updateMissing?: boolean
  /** Rows a challenge_bank select returns. */
  bankRows?: any[]
  /** Make a write on a table fail: { challenge_submissions: { update: 'message' } }. */
  failures?: Record<string, Partial<Record<'select' | 'insert' | 'update', string>>>
}

export function fakeSupabase(opts: FakeOptions = {}) {
  const calls: FakeCall[] = []
  const uploads: FakeUpload[] = []
  let tagSeq = 0

  let rowSeq = 0

  function respond(call: FakeCall): { data: any; error: any } {
    const failure = opts.failures?.[call.table]?.[call.op]
    if (failure) return { data: null, error: { message: failure } }
    switch (call.table) {
      case 'user_roles':
        return { data: (opts.roles ?? ['teacher']).map(name => ({ roles: { name } })), error: null }
      case 'challenge_tags':
        if (call.op === 'select') {
          return {
            data: (opts.tags ?? []).map(t => ({ id: t.id, challenge_tag_names: t.names })),
            error: null,
          }
        }
        if (opts.failTagInsert) return { data: null, error: { message: 'tags are read-only today' } }
        tagSeq += 1
        return { data: { id: `tag-new-${tagSeq}` }, error: null }
      case 'challenge_tag_names':
        return { data: null, error: null }
      case 'challenge_bank':
        if (call.op === 'insert') return { data: { id: call.payload.id }, error: null }
        if (call.op === 'update') {
          if (opts.updateMissing) {
            return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } }
          }
          const id = call.filters.find(f => f[0] === 'id')?.[2]
          return { data: { id }, error: null }
        }
        return { data: opts.bankRows ?? [], error: null }
    }
    // Any other table: an insert echoes its row with an id, an update names
    // the row it matched, a select is empty.
    if (call.op === 'insert') {
      rowSeq += 1
      const withId = (row: any) => ({ id: `${call.table}-${rowSeq}`, ...row })
      return { data: Array.isArray(call.payload) ? call.payload.map(withId) : withId(call.payload), error: null }
    }
    if (call.op === 'update') return { data: { id: call.filters.find(f => f[0] === 'id')?.[2] }, error: null }
    return { data: [], error: null }
  }

  function from(table: string) {
    const call: FakeCall = { table, op: 'select', filters: [] }
    calls.push(call)
    const builder: any = {
      select(columns: string) {
        if (call.op === 'select') call.select = columns
        return builder
      },
      insert(payload: any) {
        call.op = 'insert'
        call.payload = payload
        return builder
      },
      update(payload: any) {
        call.op = 'update'
        call.payload = payload
        return builder
      },
      eq(column: string, value: unknown) {
        call.filters.push([column, 'eq', value])
        return builder
      },
      is(column: string, value: unknown) {
        call.filters.push([column, 'is', value])
        return builder
      },
      not(column: string, op: string, value: unknown) {
        call.filters.push([column, `not.${op}`, value])
        return builder
      },
      order() {
        return builder
      },
      limit() {
        return builder
      },
      single() {
        call.single = true
        return builder
      },
      then(resolve: (v: any) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve(respond(call)).then(resolve, reject)
      },
    }
    return builder
  }

  const client = {
    calls,
    uploads,
    auth: {
      async getUser(token?: string) {
        const known = opts.user === undefined ? { id: 'teacher-1' } : opts.user
        const user = token && token !== 'bad-token' ? known : null
        return { data: { user }, error: null }
      },
    },
    from,
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, bytes: Uint8Array, options: any) {
            uploads.push({ bucket, path, bytes, options })
            return opts.failUpload
              ? { data: null, error: { message: 'storage is down' } }
              : { data: { path }, error: null }
          },
          getPublicUrl(path: string) {
            return {
              data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}` },
            }
          },
        }
      },
    },
  }

  return client
}

export type FakeSupabase = ReturnType<typeof fakeSupabase>

/** Shaped like a real snapshot from tools/problem_snapshot.py, Studio edition. */
export function studioSnapshot(overrides: Record<string, any> = {}) {
  const { problem: problemOverrides, ...envelopeOverrides } = overrides
  return {
    format: 'henry-math-editable-problem',
    version: 1,
    created_at: '2026-08-29T14:41:02-04:00',
    updated_at: '2026-08-29T14:41:02-04:00',
    output_basename: 'Custom Function 1',
    output_format: 'snapshot',
    source_file: 'C:\\Users\\shinn\\Dropbox\\Math Class\\Daily Problems\\Pasted Problem.png',
    preview_file: 'C:\\Users\\shinn\\OneDrive\\Documents\\Prettify Homework\\tmp\\page-1.png',
    problem: {
      mode: 'no_graph',
      title: 'Custom Function 1',
      score: '3',
      tags: ['Algebra', 'Function'],
      english: 'If $F(x)=x^2+|x|$, find where the graph meets the x-axis.',
      chinese: '假设有一个函数 $F(x)=x^2+|x|$，求它与 x 轴的交点。',
      notes: '',
      // The Math Typer's rich document; the site keeps only the strings.
      editor_documents: { english: { version: 1, blocks: [] }, chinese: { version: 1, blocks: [] } },
      ...(problemOverrides || {}),
    },
    graph: null,
    ...envelopeOverrides,
  }
}

/** Base64 of the eight-byte PNG signature; enough to stand in for a picture. */
export const TINY_PNG = 'iVBORw0KGgo='

export const PARTIAL_CROP = { left: 0.1, top: 0.1, right: 0.9, bottom: 0.9 }
