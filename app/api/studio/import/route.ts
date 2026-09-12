/**
 * /api/studio/import — the door through which problems enter the bank.
 *
 * Any tool that produces .henryproblem files can send them here: the Python
 * Henry Problem Studio, a script, or another app with an Upload button. The
 * database write lives in one place, lib/challenges/bank.ts, so a caller
 * never learns a table name. The full contract, with examples, is in
 * docs/STUDIO_IMPORT_API.md.
 *
 * Two ways to be let in:
 *
 *   1. A teacher's Supabase access token as the Bearer token. Every write
 *      then runs as that teacher under the site's own row-level policies.
 *      This is what the Studio does after the teacher signs in.
 *   2. The import key, STUDIO_IMPORT_KEY, as the Bearer token. For an app
 *      that should upload with one click and no sign-in. The rows belong to
 *      STUDIO_IMPORT_TEACHER, given as a user id or an email, and the writes
 *      use the service role because there is no session to carry them. The
 *      key is a full teacher's power over the bank, so it lives only in the
 *      site environment and in the app that needs it.
 *
 * The route reads only the Authorization header, never a cookie, which is
 * why it can answer cross-origin requests from anywhere without opening a
 * hole: a browser cannot make a signed-in call here by accident.
 *
 * POST body (JSON):
 *   snapshot   the .henryproblem contents: the parsed object, or the raw
 *              file text. The embedded graph may be omitted to keep the
 *              request small; it is only used when the crop is the full frame.
 *   image      { base64, contentType? }: the diagram, already cropped to the
 *              snapshot's crop rectangle. Required for a partial crop.
 *              At most 3 MB decoded; downscale to a long edge of ~1600 px.
 *   bankId     update this existing row instead of inserting a new one
 *   revision   the caller's content hash, stored on the row so a later sync
 *              can tell whether the row is current
 *   title, maxPoints, extraTagIds   optional overrides
 *
 * POST response: 201 on insert, 200 on update, both with
 *   { id, created, imageUrl, tagIds, skippedTags }
 *
 * GET ?basename=<output_basename>   rows imported from that snapshot name
 * GET                               every row that came from a snapshot
 *   { items: [{ id, title, sourceBasename, sourceRevision, imageUrl, updatedAt }] }
 *
 * Errors carry { error } with a sentence meant for a person: 400 for a bad
 * snapshot or a diagram that still needs cropping, 401 without a valid token
 * or key, 403 for a non-teacher, 413 for an oversized picture, 500 when the
 * import key is set but its teacher is not.
 */

import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { HenryProblemError, parseHenryProblem, parseHenryProblemValue } from '@/lib/henryproblem'
import { BankImportError, importProblemToBank, type BankImportImage } from '@/lib/challenges/bank'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const IMPORT_KEY = process.env.STUDIO_IMPORT_KEY || ''
const IMPORT_TEACHER = process.env.STUDIO_IMPORT_TEACHER || ''

/** Keeps the whole request under Vercel's body limit, base64 overhead included. */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Safe to open wide: nothing here is authorised by a cookie. */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}

export const maxDuration = 60

type Authed = { supabase: SupabaseClient<any, any, any>; userId: string }

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS })
}

function fail(message: string, status: number) {
  return json({ error: message }, status)
}

function isTeacherRole(roles: unknown): boolean {
  return ((roles as any[] | null) || []).some(
    (r: any) => r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
  )
}

/** Constant-time, so a wrong key takes as long to refuse as a nearly right one. */
function isImportKey(token: string): boolean {
  if (!IMPORT_KEY || !token) return false
  const given = Buffer.from(token)
  const expected = Buffer.from(IMPORT_KEY)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** The import key's teacher: STUDIO_IMPORT_TEACHER as an id, or looked up by email. */
async function importTeacher(supabase: SupabaseClient<any, any, any>): Promise<string | NextResponse> {
  const configured = IMPORT_TEACHER.trim()
  if (!configured) {
    return fail('The import key is set, but STUDIO_IMPORT_TEACHER is not. Set it to the teacher the uploads belong to.', 500)
  }
  let userId = configured
  if (!UUID.test(configured)) {
    const { data } = await supabase.from('profiles').select('id').eq('email', configured.toLowerCase()).maybeSingle()
    if (!data?.id) return fail(`STUDIO_IMPORT_TEACHER names ${configured}, but no account has that email.`, 500)
    userId = String((data as any).id)
  }
  const { data: roles } = await supabase
    .from('user_roles')
    .select('roles!inner(name)')
    .eq('user_id', userId)
    .is('class_id', null)
  if (!isTeacherRole(roles)) return fail('STUDIO_IMPORT_TEACHER is not a teacher or administrator.', 500)
  return userId
}

/** A client acting as the caller, plus who they are, or the refusal. */
async function authenticate(req: NextRequest): Promise<Authed | NextResponse> {
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
  if (!token) return fail('Sign in first and send the access token as a Bearer token, or send the import key.', 401)

  if (isImportKey(token)) {
    if (!SERVICE_KEY) return fail('The import key needs SUPABASE_SERVICE_ROLE_KEY in the site environment.', 500)
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const teacher = await importTeacher(supabase)
    if (teacher instanceof NextResponse) return teacher
    return { supabase, userId: teacher }
  }

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return fail('This token is not valid or has expired. Sign in again.', 401)

  const { data: roles } = await supabase
    .from('user_roles')
    .select('roles!inner(name)')
    .eq('user_id', user.id)
    .is('class_id', null)
  if (!isTeacherRole(roles)) return fail('Only teachers can import problems.', 403)

  return { supabase, userId: user.id }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req)
  if (auth instanceof NextResponse) return auth

  let body: any
  try {
    body = await req.json()
  } catch {
    return fail('The request body is not valid JSON.', 400)
  }
  if (!body || typeof body !== 'object') return fail('The request body must be a JSON object.', 400)

  let parsed
  try {
    parsed = typeof body.snapshot === 'string'
      ? parseHenryProblem(body.snapshot)
      : parseHenryProblemValue(body.snapshot)
  } catch (err) {
    if (err instanceof HenryProblemError) return fail(err.message, 400)
    throw err
  }

  let image: BankImportImage | null = null
  if (body.image != null) {
    const base64 = body.image?.base64
    if (typeof base64 !== 'string' || !base64) return fail('image.base64 must be a base64 string.', 400)
    const bytes = Buffer.from(base64, 'base64')
    if (bytes.length === 0) return fail('image.base64 did not decode to any data.', 400)
    if (bytes.length > MAX_IMAGE_BYTES) {
      return fail(
        'The picture is larger than 3 MB. Downscale it to a long edge of about 1600 px and send it again.',
        413
      )
    }
    const contentType = typeof body.image.contentType === 'string' && body.image.contentType
      ? body.image.contentType
      : 'image/png'
    image = { bytes: new Uint8Array(bytes), contentType }
  }

  const bankId = typeof body.bankId === 'string' && body.bankId ? body.bankId : null
  if (bankId && !UUID.test(bankId)) return fail('bankId is not a valid id.', 400)

  const maxPoints = body.maxPoints == null ? undefined : Number(body.maxPoints)
  if (maxPoints !== undefined && (!Number.isInteger(maxPoints) || maxPoints <= 0)) {
    return fail('maxPoints must be a whole number above zero.', 400)
  }

  try {
    const result = await importProblemToBank(auth.supabase, {
      parsed,
      userId: auth.userId,
      image,
      bankId,
      sourceRevision: typeof body.revision === 'string' && body.revision ? body.revision : null,
      title: typeof body.title === 'string' ? body.title : undefined,
      maxPoints,
      extraTagIds: Array.isArray(body.extraTagIds)
        ? body.extraTagIds.filter((v: unknown): v is string => typeof v === 'string')
        : [],
    })
    return json(result, result.created ? 201 : 200)
  } catch (err) {
    if (err instanceof BankImportError) return fail(err.message, 400)
    console.error('[studio/import]', err)
    return fail('The import failed on the server. Try again, and check the server log if it keeps failing.', 500)
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req)
  if (auth instanceof NextResponse) return auth

  const basename = req.nextUrl.searchParams.get('basename')
  let query = auth.supabase
    .from('challenge_bank')
    .select('id, title, image_url, updated_at, henryproblem')
    .order('updated_at', { ascending: false })
    .limit(1000)
  query = basename
    ? query.eq('henryproblem->>source_basename', basename)
    : query.not('henryproblem->>source_basename', 'is', null)

  const { data, error } = await query
  if (error) {
    console.error('[studio/import]', error)
    return fail('The bank could not be read. Try again.', 500)
  }

  const items = ((data as any[] | null) || []).map(row => ({
    id: row.id,
    title: row.title,
    sourceBasename: row.henryproblem?.source_basename ?? null,
    sourceRevision: row.henryproblem?.source_revision ?? null,
    imageUrl: row.image_url ?? null,
    updatedAt: row.updated_at ?? null,
  }))
  return json({ items }, 200)
}
