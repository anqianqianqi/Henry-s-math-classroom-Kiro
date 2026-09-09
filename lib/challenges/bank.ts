/**
 * Importing a .henryproblem snapshot into the challenge bank.
 *
 * One write sequence, shared by the Studio import route and eventually the
 * batch-import page, so the two can never drift on which columns a bank item
 * gets or where its diagram lives.
 *
 * Where this departs from the sequence app/challenges/batch-import/page.tsx
 * grew, and why:
 *   - The row id is generated here, so the diagram is uploaded first and the
 *     row inserted once with image_url already set. The page inserted, then
 *     uploaded, then updated, because it needed the id for the storage path.
 *   - A failed diagram upload fails the import. The page carried on and left a
 *     graph problem with no picture; the Studio's ledger would then record it
 *     as uploaded and nobody would notice until a student opened it.
 *   - Given a bank id it updates that row. That is how a snapshot edited after
 *     upload reaches the site without becoming a duplicate.
 *
 * Nothing here crops. The snapshot stores the whole original image plus a crop
 * rectangle, and the site displays image_url as-is (lib/henryproblem-graph.ts
 * applies the crop once, at upload). So the caller sends the cropped picture.
 * The one exception is a full-frame crop, where the embedded image already is
 * the picture and can be used directly.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { FULL_CROP, type HenryGraphCrop, type ParsedHenryProblem } from '../henryproblem'
import { createChallengeTags, resolveTagNames, type KnownTag } from '../challenge-tags'

/** Any client will do; the schema is not typed for these tables. */
type Db = SupabaseClient<any, any, any>

export const BANK_IMAGE_BUCKET = 'challenge-images'
export const DEFAULT_MAX_POINTS = 100

export class BankImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BankImportError'
  }
}

/** A diagram, already cropped to what the problem should show. */
export interface BankImportImage {
  bytes: Uint8Array
  /** Defaults to image/png, which is what every snapshot embeds. */
  contentType?: string
}

export interface BankImportInput {
  parsed: ParsedHenryProblem
  /** The teacher importing; becomes created_by and the storage folder. */
  userId: string
  /**
   * Cropped diagram. When absent and the snapshot's crop is the full frame,
   * the embedded image is used. When absent and the crop is partial, the
   * import is refused rather than showing an uncropped diagram.
   */
  image?: BankImportImage | null
  /** Update this bank row instead of inserting a new one. */
  bankId?: string | null
  /** Overrides the snapshot's own title. */
  title?: string
  /** Overrides the snapshot's own score. */
  maxPoints?: number | null
  /** Tag ids applied on top of the snapshot's own tag names. */
  extraTagIds?: string[]
  /** The Studio ledger's content hash, kept on the row as source_revision. */
  sourceRevision?: string | null
}

export interface BankImportResult {
  id: string
  /** false when an existing row was updated. */
  created: boolean
  imageUrl: string | null
  tagIds: string[]
  /** Tag names that could not be created and so are missing from tagIds. */
  skippedTags: string[]
}

/** Every tag with every name it is known by, shaped for resolveTagNames. */
export async function loadKnownTags(supabase: Db): Promise<KnownTag[]> {
  const { data, error } = await supabase
    .from('challenge_tags')
    .select('id, challenge_tag_names(language, name)')
    .order('created_at')
  if (error) throw new BankImportError(`Could not read the existing tags: ${error.message}`)
  return (data || []).map((t: any) => ({
    id: String(t.id),
    names: (t.challenge_tag_names || []).map((n: any) => String(n.name)),
  }))
}

function isFullCrop(crop: HenryGraphCrop): boolean {
  return (
    crop.left === FULL_CROP.left &&
    crop.top === FULL_CROP.top &&
    crop.right === FULL_CROP.right &&
    crop.bottom === FULL_CROP.bottom
  )
}

function decodeBase64(data: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(data, 'base64'))
  const binary = atob(data)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/** The file extension the bucket path gets, from what the picture is. */
function extensionFor(contentType: string): string {
  return contentType === 'image/jpeg' ? 'jpg' : 'png'
}

/**
 * The picture the bank item will show, or null when it has none. Decided
 * before any write so a refused import leaves nothing behind.
 */
function pictureFor(parsed: ParsedHenryProblem, image?: BankImportImage | null): BankImportImage | null {
  if (image && image.bytes && image.bytes.length > 0) {
    return { bytes: image.bytes, contentType: image.contentType || 'image/png' }
  }
  if (parsed.snapshot.problem.mode !== 'graph') return null
  // Graph mode with no diagram attached yet is a state the editor allows.
  if (!parsed.graphDataUrl) return null
  if (!isFullCrop(parsed.crop)) {
    throw new BankImportError(
      'This diagram needs cropping before it can be uploaded. Send the cropped picture with the snapshot.'
    )
  }
  const comma = parsed.graphDataUrl.indexOf(',')
  return { bytes: decodeBase64(parsed.graphDataUrl.slice(comma + 1)), contentType: 'image/png' }
}

export async function importProblemToBank(
  supabase: Db,
  input: BankImportInput,
  knownTags?: KnownTag[]
): Promise<BankImportResult> {
  const { parsed, userId } = input
  if (!userId) throw new BankImportError('An importing user is required.')

  const maxPoints = input.maxPoints ?? parsed.maxPoints ?? DEFAULT_MAX_POINTS
  if (!Number.isInteger(maxPoints) || maxPoints <= 0) {
    throw new BankImportError('Points must be a whole number above zero.')
  }

  const picture = pictureFor(parsed, input.image)

  // Tags: reuse what exists under any language, create the rest once.
  const known = knownTags ?? (await loadKnownTags(supabase))
  const { matchedIds, newNames } = resolveTagNames(parsed.tagNames, known)
  const created = newNames.length > 0
    ? await createChallengeTags(supabase, newNames, userId)
    : new Map<string, string>()
  const createdIds: string[] = []
  const skippedTags: string[] = []
  for (const name of newNames) {
    const id = created.get(name.trim().toLowerCase())
    if (id) createdIds.push(id)
    else skippedTags.push(name)
  }
  const tagIds = [...new Set([...matchedIds, ...createdIds, ...(input.extraTagIds || [])])]

  const id = input.bankId || globalThis.crypto.randomUUID()

  let imageUrl: string | null = null
  if (picture) {
    const contentType = picture.contentType || 'image/png'
    const path = `${userId}/${id}.${extensionFor(contentType)}`
    const { error } = await supabase.storage
      .from(BANK_IMAGE_BUCKET)
      .upload(path, picture.bytes, { upsert: true, contentType })
    if (error) throw new BankImportError(`The diagram could not be uploaded: ${error.message}`)
    imageUrl = supabase.storage.from(BANK_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  }

  const title =
    (input.title ?? parsed.title).trim() || parsed.snapshot.output_basename || 'Untitled problem'
  const henryproblem = input.sourceRevision
    ? { ...parsed.stored, source_revision: input.sourceRevision }
    : { ...parsed.stored }
  const fields = {
    title,
    description: parsed.description,
    tag_ids: tagIds,
    max_points: maxPoints,
    henryproblem,
    image_url: imageUrl,
  }

  if (input.bankId) {
    const { data, error } = await supabase
      .from('challenge_bank')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', input.bankId)
      .select('id')
      .single()
    if (error || !data) {
      throw new BankImportError(
        `Bank item ${input.bankId} could not be updated: ${error?.message || 'no such item'}`
      )
    }
    return { id: input.bankId, created: false, imageUrl, tagIds, skippedTags }
  }

  const { data, error } = await supabase
    .from('challenge_bank')
    .insert({ id, created_by: userId, ...fields })
    .select('id')
    .single()
  if (error || !data) {
    throw new BankImportError(`The problem could not be saved: ${error?.message || 'insert failed'}`)
  }
  return { id, created: true, imageUrl, tagIds, skippedTags }
}
