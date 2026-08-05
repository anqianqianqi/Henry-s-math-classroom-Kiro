/**
 * Narrowing a language model's JSON into a RoomSpec / BookSpec.
 *
 * ── WHAT THIS IS DEFENDING ──────────────────────────────────
 * The model writes FIELD VALUES. It never writes the compiled prompt — that
 * stays with prompt.ts and bookPrompt.ts, whose locked sections are a contract
 * with the WebGL stage rather than art direction.
 *
 * That split is only worth anything if the field values cannot reach into the
 * locked sections and contradict them, and they can: every tabletop object is
 * inlined into the LOCKED COMPOSITION bullet list, two lines above "no book on
 * the table". A model that answers "an open book on a brass stand" has written
 * a prompt that argues with itself, and the image model resolves that argument
 * however it likes. Hence the banned patterns below.
 *
 * ── WHY THE BANNED LISTS ARE NARROWER THAN THEY LOOK ────────
 * The obvious list is wrong. Banning /book/ would reject "a slim notebook bound
 * in pale linen" and "a spiral-bound log book squared to the edge" — both
 * hand-authored entries sitting in themes.ts today, both fine, because a closed
 * notebook at the side of a table is not the composited book in the middle of
 * it. Banning /letter/ would reject "a little owl with a closed letter and a wax
 * seal" from bookThemes.ts.
 *
 * So the patterns target the specific failures — a book that is OPEN, an object
 * placed in the CENTRE, a surface bearing rendered TYPE — and inventedSpec's
 * tests run the entire existing hand-written library through them. A filter
 * that rejects what a person already signed off on is a filter that is wrong,
 * and that test is what says so.
 */

import type { RoomSpec, BookSpec, AxisVector } from '@/lib/types/challengeRoom'

export type InventResult<T> =
  | { ok: true; spec: T; adjusted: string[] }
  | { ok: false; reason: string }

/** Field length ceilings. Long enough for the authored library's longest entry. */
const MAX_NAME = 60
const MAX_FIELD = 200
const MAX_ITEM = 120

/*
 * Patterns that would make a field contradict a locked prompt section.
 *
 * Shared: rendered type. Both compilers end with "No words, letters, numbers,
 * symbols, logo, watermark", so a field ASKING for lettering is a direct
 * contradiction. "a handwritten label" is deliberately not here — it is an
 * existing cluster, and the locked line is what governs it.
 */
const TYPE_PATTERNS: RegExp[] = [
  /\btext\b/i,
  /\blettering\b/i,
  /\btypography\b/i,
  /\bcalligraphy\b/i,
  /\bwatermark\b/i,
  /\blogo\b/i,
  /\bsignage\b/i,
]

/** Room-only: the placement zone and the "no people" rule. */
const ROOM_PATTERNS: RegExp[] = [
  ...TYPE_PATTERNS,
  // The book is composited here. An open book in the recipe is the one object
  // guaranteed to be mistaken for it.
  /\bopen\s+(book|notebook|ledger|tome|volume|journal)\b/i,
  /\b(book|notebook|ledger|tome|volume)\s+lying\s+open\b/i,
  // Anything claiming the middle of the table, which must stay empty.
  /\bcent(er|re)\s+of\s+the\s+table\b/i,
  /\bin\s+the\s+cent(er|re)\b/i,
  /\bmiddle\s+of\s+the\s+table\b/i,
  // "No people" is locked.
  /\b(person|people|human|child|children)\b/i,
]

/** Book-only. Adds the cover's forbidden centre title. */
const BOOK_PATTERNS: RegExp[] = [
  ...TYPE_PATTERNS,
  /\btitle\b/i,
  /\bwords?\b/i,
]

function offending(value: string, patterns: RegExp[]): string | null {
  for (const p of patterns) if (p.test(value)) return p.source
  return null
}

/**
 * Whitespace-collapse and unwrap.
 *
 * Models return `"a brass dial"` with the quotes included often enough that not
 * stripping them puts literal quote marks into the image prompt.
 */
function clean(value: unknown): string {
  if (typeof value !== 'string') return ''
  let out = value.trim().replace(/\s+/g, ' ')
  if (out.length > 1 && /^["'“](.*)["'”]$/.test(out)) out = out.slice(1, -1).trim()
  return out
}

function asStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const out = raw.map(clean)
  return out.every(s => s.length > 0) ? out : null
}

/** Distinct ignoring case and trailing punctuation — "A cup" vs "a cup." */
function allDistinct(values: string[]): boolean {
  const norm = values.map(v => v.toLowerCase().replace(/[.,;]+$/, ''))
  return new Set(norm).size === values.length
}

export interface ParseOpts {
  /**
   * Styles legal for the rolled cell, most-preferred first. A model answer
   * outside this list is replaced with the first entry rather than dropped —
   * dropping falls back to the pre-styles legacy render, which is a watercolour
   * look that would quietly ignore a brief asking for anything else.
   */
  allowedStyles: string[]
  /** Recorded onto the spec so a saved recipe knows which cell produced it. */
  vector?: AxisVector
}

function checkFields(
  fields: [string, string][],
  patterns: RegExp[],
  maxLength: number,
): string | null {
  for (const [label, value] of fields) {
    if (!value) return `${label} is missing or empty.`
    if (value.length > maxLength) return `${label} is ${value.length} chars, over the ${maxLength} limit.`
    const bad = offending(value, patterns)
    if (bad) return `${label} contains a banned pattern (${bad}): "${value}".`
  }
  return null
}

function resolveStyle(
  raw: unknown,
  allowedStyles: string[],
  adjusted: string[],
): string | undefined {
  const fallback = allowedStyles[0]
  const wanted = clean(raw)
  if (!wanted) {
    if (fallback) adjusted.push(`artStyle absent, used "${fallback}"`)
    return fallback
  }
  if (allowedStyles.includes(wanted)) return wanted
  if (fallback) adjusted.push(`artStyle "${wanted}" is not legal for this cell, used "${fallback}"`)
  return fallback
}

/**
 * A room recipe from model JSON.
 *
 * Expects a flat `objects` array of exactly four rather than the spec's
 * left/right pair: a model handed two arrays reliably repeats an object across
 * them, and one array makes distinctness a single check. The deal into slots is
 * done here, the same way randomRoomSpec does it.
 */
export function parseInventedRoom(raw: unknown, opts: ParseOpts): InventResult<RoomSpec> {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Response was not an object.' }
  const o = raw as Record<string, unknown>
  const adjusted: string[] = []

  const name = clean(o.name)
  const spec = {
    mood: clean(o.mood),
    palette: clean(o.palette),
    architecture: clean(o.architecture),
    materials: clean(o.materials),
    lighting: clean(o.lighting),
    outsideView: clean(o.outsideView),
    accent: clean(o.accent),
    aperture: clean(o.aperture),
  }

  if (!name) return { ok: false, reason: 'Theme name is missing or empty.' }
  if (name.length > MAX_NAME) return { ok: false, reason: `Theme name is over ${MAX_NAME} chars.` }

  const fieldError = checkFields(
    [
      ['Mood', spec.mood],
      ['Palette', spec.palette],
      ['Architecture', spec.architecture],
      ['Materials', spec.materials],
      ['Lighting', spec.lighting],
      ['Outside view', spec.outsideView],
      ['Accent', spec.accent],
    ],
    ROOM_PATTERNS,
    MAX_FIELD,
  )
  if (fieldError) return { ok: false, reason: fieldError }

  // Optional — an empty one keeps the legacy arched-window sentence.
  if (spec.aperture) {
    const bad = checkFields([['Aperture', spec.aperture]], ROOM_PATTERNS, MAX_FIELD)
    if (bad) return { ok: false, reason: bad }
  }

  const objects = asStringArray(o.objects)
  if (!objects) return { ok: false, reason: 'objects must be an array of non-empty strings.' }
  if (objects.length !== 4) return { ok: false, reason: `objects must have exactly 4 entries, got ${objects.length}.` }
  if (!allDistinct(objects)) return { ok: false, reason: 'objects repeats an entry.' }

  const objectError = checkFields(
    objects.map((v, i) => [`Object ${i + 1}`, v] as [string, string]),
    ROOM_PATTERNS,
    MAX_ITEM,
  )
  if (objectError) return { ok: false, reason: objectError }

  const artStyle = resolveStyle(o.artStyle, opts.allowedStyles, adjusted)

  return {
    ok: true,
    adjusted,
    spec: {
      name,
      mood: spec.mood,
      palette: spec.palette,
      architecture: spec.architecture,
      materials: spec.materials,
      lighting: spec.lighting,
      outsideView: spec.outsideView,
      leftObjects: [objects[0], objects[1]],
      rightObjects: [objects[2], objects[3]],
      accent: spec.accent,
      notes: '',
      ...(artStyle ? { artStyle } : {}),
      ...(spec.aperture ? { aperture: spec.aperture } : {}),
      ...(opts.vector ? { axes: opts.vector } : {}),
    },
  }
}

/** A cover + inner-page recipe from model JSON. */
export function parseInventedBook(raw: unknown, opts: ParseOpts): InventResult<BookSpec> {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Response was not an object.' }
  const o = raw as Record<string, unknown>
  const adjusted: string[] = []

  const name = clean(o.name)
  const mood = clean(o.mood)
  const palette = clean(o.palette)
  const coverSurface = clean(o.coverSurface)
  const paper = clean(o.paper)
  const ground = clean(o.ground)
  const frame = clean(o.frame)
  const innerAccent = clean(o.innerAccent)

  if (!name) return { ok: false, reason: 'Collection name is missing or empty.' }
  if (name.length > MAX_NAME) return { ok: false, reason: `Collection name is over ${MAX_NAME} chars.` }

  const fieldError = checkFields(
    [
      ['Mood', mood],
      ['Palette', palette],
      ['Cover surface', coverSurface],
      ['Paper', paper],
      // Required of the model even though the spec type allows it to be
      // absent: optional exists for recipes saved before the field did, not as
      // licence for a fresh one to skip it and fall back to guesswork.
      ['Ground', ground],
      ['Frame', frame],
    ],
    BOOK_PATTERNS,
    MAX_FIELD,
  )
  if (fieldError) return { ok: false, reason: fieldError }

  if (innerAccent) {
    const bad = checkFields([['Inner accent', innerAccent]], BOOK_PATTERNS, MAX_ITEM)
    if (bad) return { ok: false, reason: bad }
  }

  const clusters = asStringArray(o.cornerClusters)
  if (!clusters) return { ok: false, reason: 'cornerClusters must be an array of non-empty strings.' }
  if (clusters.length !== 4) return { ok: false, reason: `cornerClusters must have exactly 4 entries, got ${clusters.length}.` }
  if (!allDistinct(clusters)) return { ok: false, reason: 'cornerClusters repeats an entry.' }

  const clusterError = checkFields(
    clusters.map((v, i) => [`Cluster ${i + 1}`, v] as [string, string]),
    BOOK_PATTERNS,
    MAX_ITEM,
  )
  if (clusterError) return { ok: false, reason: clusterError }

  const artStyle = resolveStyle(o.artStyle, opts.allowedStyles, adjusted)

  return {
    ok: true,
    adjusted,
    spec: {
      name,
      mood,
      palette,
      coverSurface,
      paper,
      ground,
      frame,
      cornerClusters: [clusters[0], clusters[1], clusters[2], clusters[3]],
      notes: '',
      ...(artStyle ? { artStyle } : {}),
      ...(innerAccent ? { innerAccent } : {}),
      ...(opts.vector ? { axes: opts.vector } : {}),
    },
  }
}

/**
 * Pull the JSON object out of a model response.
 *
 * response_format: json_object makes this almost always a straight parse, but
 * "almost" is doing work — a refusal or a truncated completion arrives as prose,
 * and JSON.parse throwing inside a route handler is a 500 where a fallback roll
 * was wanted.
 */
export function extractJson(raw: string): unknown {
  const direct = tryParse(raw)
  if (direct !== undefined) return direct
  const match = raw.match(/\{[\s\S]*\}/)
  return match ? tryParse(match[0]) : undefined
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
