/**
 * /api/studio/import — the door through which problems enter the bank.
 *
 * Any tool that produces .henryproblem files can send them here: the Python
 * Henry Problem Studio, a script, or another app with an Upload button. The
 * database write lives in one place, lib/challenges/bank.ts, so a caller
 * never learns a table name. The full contract, with examples, is in
 * docs/STUDIO_IMPORT_API.md. Who may call is decided in lib/studio/auth.ts:
 * the import key, or a teacher's own token.
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

import { NextRequest, NextResponse } from 'next/server'
import { HenryProblemError, parseHenryProblem, parseHenryProblemValue } from '@/lib/henryproblem'
import { BankImportError, importProblemToBank, type BankImportImage } from '@/lib/challenges/bank'
import { UUID, authenticateStudio, studioFail, studioJson, studioPreflight } from '@/lib/studio/auth'

/** Keeps the whole request under Vercel's body limit, base64 overhead included. */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

export const maxDuration = 60

export async function OPTIONS() {
  return studioPreflight()
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
  if (!body || typeof body !== 'object') return studioFail('The request body must be a JSON object.', 400)

  let parsed
  try {
    parsed = typeof body.snapshot === 'string'
      ? parseHenryProblem(body.snapshot)
      : parseHenryProblemValue(body.snapshot)
  } catch (err) {
    if (err instanceof HenryProblemError) return studioFail(err.message, 400)
    throw err
  }

  let image: BankImportImage | null = null
  if (body.image != null) {
    const base64 = body.image?.base64
    if (typeof base64 !== 'string' || !base64) return studioFail('image.base64 must be a base64 string.', 400)
    const bytes = Buffer.from(base64, 'base64')
    if (bytes.length === 0) return studioFail('image.base64 did not decode to any data.', 400)
    if (bytes.length > MAX_IMAGE_BYTES) {
      return studioFail(
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
  if (bankId && !UUID.test(bankId)) return studioFail('bankId is not a valid id.', 400)

  const maxPoints = body.maxPoints == null ? undefined : Number(body.maxPoints)
  if (maxPoints !== undefined && (!Number.isInteger(maxPoints) || maxPoints <= 0)) {
    return studioFail('maxPoints must be a whole number above zero.', 400)
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
    return studioJson(result, result.created ? 201 : 200)
  } catch (err) {
    if (err instanceof BankImportError) return studioFail(err.message, 400)
    console.error('[studio/import]', err)
    return studioFail('The import failed on the server. Try again, and check the server log if it keeps failing.', 500)
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateStudio(req)
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
    return studioFail('The bank could not be read. Try again.', 500)
  }

  const items = ((data as any[] | null) || []).map(row => ({
    id: row.id,
    title: row.title,
    sourceBasename: row.henryproblem?.source_basename ?? null,
    sourceRevision: row.henryproblem?.source_revision ?? null,
    imageUrl: row.image_url ?? null,
    updatedAt: row.updated_at ?? null,
  }))
  return studioJson({ items }, 200)
}
