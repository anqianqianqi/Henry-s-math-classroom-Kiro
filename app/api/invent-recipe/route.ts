// app/api/invent-recipe/route.ts
//
// Invents a RoomSpec, a BookSpec, or a matched pair, using a small text model.
//
// POST body:
//   { kind: 'room' | 'book',
//     vector?,          // pin the cell; omit to roll one
//     fix?,             // pin some axes and roll the rest
//     avoidVectors?,    // recent cells, avoided by distance
//     seenVectors?,     // cells already used, avoided exactly (coverage bias)
//     avoidNames?,      // theme names not to echo
//     companionRoom? }  // kind 'book' only: the room this bundle will sit in
// Returns:
//   { vector, source: 'llm' | 'fallback', room?, book?, adjusted[], note? }
//
// ── WHY THE MODEL IS SMALL AND THE DICE ARE NOT ────────────────────────────
// The hard part of inventing a theme is not writing it, it is not writing the
// same one every time. That is solved before the model is called — see axes.ts.
// What is left is turning seven constraint words into eight lines of art
// direction, which gpt-4o-mini does as well as anything larger, in 2-4s for
// about $0.0005. Against the gpt-image-2 render that follows (30-180s, cents),
// this step is free.
//
// The model NEVER writes the compiled prompt. It fills spec fields, which
// inventedSpec.ts then narrows. The locked composition rules stay in prompt.ts.

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ROOM_THEMES, randomRoomSpec } from '@/lib/challengeRoom/themes'
import { BOOK_THEMES, randomBookSpec } from '@/lib/challengeRoom/bookThemes'
import {
  describeVector,
  parsePartialVector,
  parseVector,
  rollVector,
  styleFor,
  type AxisVector,
} from '@/lib/challengeRoom/axes'
import {
  extractJson,
  parseInventedBook,
  parseInventedRoom,
  type InventResult,
} from '@/lib/challengeRoom/inventedSpec'
import type { BookSpec, RoomSpec } from '@/lib/types/challengeRoom'

export const dynamic = 'force-dynamic'
// Two model calls at worst (the pair), each 2-4s. Nothing here generates an
// image, so this never needs the 300s the preview routes take.
export const maxDuration = 30

const MODEL = 'gpt-4o-mini'

/** One retry. A second roll costs a twentieth of a cent and usually lands. */
const ATTEMPTS = 2

// ── Shared rules ────────────────────────────────────────────────────────────
//
// Stated to the model as well as enforced afterwards. Enforcement alone would
// work but wastes a retry on every avoidable rejection; stating it alone would
// not work at all, which is what inventedSpec.ts is for.

const HOUSE_RULES = `
HOUSE RULES — a response breaking any of these is discarded:
- Never mention text, lettering, typography, calligraphy, watermarks, logos or signage. The artwork carries no words at all.
- Never mention a person, people, a human or a child.
- Write British-English prose in the register of a careful art director: concrete nouns, no marketing adjectives, no "whimsical", no "magical realism".
- Every value is a fragment, not a sentence. No leading capital, no full stop.
- Do not name a real brand, a real living person, or a copyrighted property.`

const ROOM_SCHEMA = `
Return ONLY a JSON object with exactly these keys:
{
  "name":         "the world's name, 2-4 words, title case",
  "mood":         "three adjectives, comma separated",
  "palette":      "4-5 named colours, comma separated",
  "architecture": "what kind of room this is and how it is built, one fragment",
  "materials":    "4 materials, comma separated",
  "lighting":     "where the light comes from and what it does, one fragment",
  "outsideView":  "what is visible through the window, one fragment",
  "accent":       "one repeated decorative detail in the architecture, one fragment",
  "aperture":     "the window's form as a noun phrase, e.g. 'brass-ringed observation port with a thick riveted rim'",
  "objects":      ["four", "distinct", "tabletop", "objects"],
  "artStyle":     "one of the allowed style ids"
}

ROOM RULES:
- The four objects sit on a table, two to the left and two to the right of an empty centre. Never place anything in the middle of the table, and never describe one as being in the centre.
- A book is composited into that empty centre later. Never describe an OPEN book, notebook or ledger. A closed one at the side is fine.
- Each object is a single freestanding thing under 110 characters, no shelving, no wall fittings.
- "aperture" fills the blank in "A single large ___ occupies the central upper half", so it must read as one window, not two.`

const BOOK_SCHEMA = `
Return ONLY a JSON object with exactly these keys:
{
  "name":           "the collection's name, 2-4 words, title case",
  "mood":           "three adjectives, comma separated",
  "palette":        "4-5 named colours, comma separated",
  "coverSurface":   "what the COVER is bound in — cloth, leather, lacquer, veneer, metal, canvas. Material and feel, never a colour",
  "paper":          "what the INNER PAGE is — a paper, named by TYPE (laid, wove, cartridge, rag, blotting, tracing). Never a colour",
  "ground":         "ONE colour name for the whole book, mid-tone to deep, e.g. 'deep indigo'",
  "frame":          "a single thin border running just inside the cover edge, one fragment",
  "innerAccent":    "a very sparse motif for the inner page, one fragment",
  "cornerClusters": ["four", "distinct", "small", "vignettes"],
  "artStyle":       "one of the allowed style ids"
}

BOOK RULES:
- "coverSurface" and "paper" are DIFFERENT MATERIALS, and should be. A bound book has cloth or hide on the boards and paper inside. Reach well beyond paper for the cover: book-cloth, buckram, calf leather, raw silk, waxed canvas, lacquered panel, wood veneer, anodised metal, moulded polymer. Do not write a paper for the cover.
- Both are texture only. Write what the material feels like, never what colour it is: "coarse buckram over board with a pronounced weave", not "warm ivory cloth".
- Vary the KIND of paper, not just its adjectives — laid, wove, cartridge, rag, blotting, tracing, glassine, xuan. Avoid opening every one with "stock" or "sheet".
- "ground" is a single colour, and it is the colour of the whole book: the cover takes it at full strength, the inner page takes a pale tint of the same hue. Choose something mid-tone or deep — a ground that is already pale gives a cover and an inner page that look identical. One colour name only, never a list.
- "palette" colours the four corner clusters. It is not the ground, so it may range freely.
- Each corner cluster is a compact group of 2-3 small objects, under 110 characters.
- Never mention a title, a word, or anything printed. The cover carries no type.
- The inner accent must stay quiet: at least 75% of the inner page has to remain blank, because a maths problem is printed onto it.`

interface Attempt {
  kind: 'room' | 'book'
  vector: AxisVector
  allowedStyles: string[]
  avoidNames: string[]
  /** Only for the book half of a pair — the room it will sit in. */
  companion?: RoomSpec
}

function systemPrompt(a: Attempt): string {
  const schema = a.kind === 'room' ? ROOM_SCHEMA : BOOK_SCHEMA
  const what = a.kind === 'room'
    ? 'a themed room interior that a 3D book will be composited into'
    : 'a matching cover and inner page for a storybook'

  return [
    `You are an art director inventing ${what} for a children's maths site.`,
    '',
    'You are given coordinates, not a free choice. The brief below is the whole',
    'point: it exists so that repeated requests land on genuinely different',
    'themes instead of variations on your favourite one. Honour every line of',
    'it, including the combinations that feel unusual — especially those.',
    '',
    schema,
    HOUSE_RULES,
    '',
    `Allowed style ids (pick exactly one): ${a.allowedStyles.join(', ')}.`,
  ].join('\n')
}

function userPrompt(a: Attempt): string {
  const parts = [
    'BRIEF — the theme must satisfy all of this:',
    describeVector(a.vector),
    '',
    'Here are two existing themes from the library, given for VOICE AND LENGTH',
    'only. Do not reuse their subject, palette or objects.',
    '',
    exampleFor(a.kind, a.vector),
  ]

  if (a.avoidNames.length > 0) {
    parts.push(
      '',
      `Names already taken — do not reuse or lightly reword any of these: ${a.avoidNames.join('; ')}.`,
    )
  }

  if (a.companion) {
    /*
     * The pair. Without this the room and the bundle are independently
     * plausible and jointly incoherent — a sci-fi ledger open on a woodland
     * table. Echoing rather than restating: a cover that repeats the room's
     * palette word for word reads as a screenshot of it.
     */
    parts.push(
      '',
      'This book will be seen lying on the table in THIS room:',
      `- architecture: ${a.companion.architecture}`,
      `- materials: ${a.companion.materials}`,
      `- palette: ${a.companion.palette}`,
      `- lighting: ${a.companion.lighting}`,
      'The paper and frame must look at home there. Echo that palette rather',
      'than repeating it, and keep the cover readable against those materials.',
    )
  }

  return parts.join('\n')
}

/** A real library entry, reshaped into the exact JSON being asked for. */
function exampleFor(kind: 'room' | 'book', vector: AxisVector): string {
  if (kind === 'room') {
    const pool = ROOM_THEMES.filter(t => t.family === vector.family)
    const themes = (pool.length >= 2 ? pool : ROOM_THEMES).slice(0, 2)
    return themes
      .map(t => {
        const s = randomRoomSpec(t)
        return JSON.stringify({
          name: s.name, mood: s.mood, palette: s.palette,
          architecture: s.architecture, materials: s.materials,
          lighting: s.lighting, outsideView: s.outsideView, accent: s.accent,
          aperture: s.aperture,
          objects: [...s.leftObjects, ...s.rightObjects],
          artStyle: s.artStyle,
        }, null, 2)
      })
      .join('\n\n')
  }

  const pool = BOOK_THEMES.filter(t => t.family === vector.family)
  const themes = (pool.length >= 2 ? pool : BOOK_THEMES).slice(0, 2)
  return themes
    .map(t => {
      const s = randomBookSpec(t)
      return JSON.stringify({
        name: s.name, mood: s.mood, palette: s.palette,
        coverSurface: s.coverSurface, paper: s.paper,
        ground: s.ground, frame: s.frame,
        innerAccent: s.innerAccent,
        cornerClusters: s.cornerClusters, artStyle: s.artStyle,
      }, null, 2)
    })
    .join('\n\n')
}

async function callModel(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      // The brief already constrains the answer hard; heat is what stops the
      // model settling into one phrasing per cell.
      temperature: 1,
      max_tokens: 900,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${MODEL} failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

/**
 * One half, with a retry that tells the model what was wrong.
 *
 * Returns null rather than throwing when it cannot get a usable answer — the
 * caller substitutes a dice roll, because an admin who pressed a button wants a
 * recipe, not an error toast.
 */
async function invent<T extends RoomSpec | BookSpec>(
  apiKey: string,
  attempt: Attempt,
  parse: (raw: unknown) => InventResult<T>,
): Promise<{ spec: T; adjusted: string[] } | { failure: string }> {
  const system = systemPrompt(attempt)
  let user = userPrompt(attempt)
  let lastReason = 'no attempt made'

  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      const raw = await callModel(apiKey, system, user)
      const json = extractJson(raw)
      if (json === undefined) {
        lastReason = 'response was not JSON'
      } else {
        const result = parse(json)
        if (result.ok) return { spec: result.spec, adjusted: result.adjusted }
        lastReason = result.reason
      }
    } catch (err: any) {
      lastReason = err.message ?? 'request failed'
      // A transport or auth failure will not be fixed by rephrasing.
      break
    }

    user = `${userPrompt(attempt)}\n\nYour previous answer was rejected: ${lastReason}\nReturn corrected JSON.`
  }

  console.warn(`[invent-recipe] ${attempt.kind} fell back: ${lastReason}`)
  return { failure: lastReason }
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: roles } = await supabase
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', session.user.id)
      .is('class_id', null)

    const isAdmin = (roles as any[])?.some((r: any) =>
      r.roles?.name === 'administrator' || r.roles?.name === 'teacher',
    )
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden — admins/teachers only' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const kind: string = body.kind ?? 'room'
    if (kind !== 'room' && kind !== 'book') {
      return NextResponse.json({ error: "kind must be 'room' or 'book'" }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    // A caller-supplied vector is honoured; anything malformed is ignored
    // rather than 400'd, so a stale client cannot lock the admin out of the
    // button. Everything else rolls.
    const readVectors = (raw: unknown): AxisVector[] =>
      Array.isArray(raw)
        ? raw.map(parseVector).filter((v): v is AxisVector => v !== null)
        : []

    const avoidVectors = readVectors(body.avoidVectors)
    const seenVectors = readVectors(body.seenVectors)
    const fix = parsePartialVector(body.fix)
    const vector = parseVector(body.vector)
      ?? rollVector({ avoid: avoidVectors, seen: seenVectors, fix })

    const allowedStyles = shuffle(styleFor(vector))
    const avoidNames: string[] = [
      ...(kind === 'book' ? BOOK_THEMES : ROOM_THEMES).map(t => t.name),
      ...(Array.isArray(body.avoidNames) ? body.avoidNames.filter((n: unknown) => typeof n === 'string') : []),
    ]

    const adjusted: string[] = []
    const notes: string[] = []
    let source: 'llm' | 'fallback' = 'llm'
    let room: RoomSpec | undefined
    let book: BookSpec | undefined

    if (kind === 'room') {
      const r = await invent<RoomSpec>(
        apiKey,
        { kind: 'room', vector, allowedStyles, avoidNames },
        raw => parseInventedRoom(raw, { allowedStyles, vector }),
      )
      if ('failure' in r) {
        source = 'fallback'
        notes.push(`Room fell back to a preset roll: ${r.failure}`)
        room = randomRoomSpec()
      } else {
        room = r.spec
        adjusted.push(...r.adjusted)
      }
    } else {
      const companion = readCompanion(body.companionRoom)
      const b = await invent<BookSpec>(
        apiKey,
        {
          kind: 'book',
          vector,
          allowedStyles,
          avoidNames: companion ? [...avoidNames, companion.name] : avoidNames,
          companion,
        },
        raw => parseInventedBook(raw, { allowedStyles, vector }),
      )
      if ('failure' in b) {
        source = 'fallback'
        notes.push(`Bundle fell back to a preset roll: ${b.failure}`)
        book = randomBookSpec()
      } else {
        book = b.spec
        adjusted.push(...b.adjusted)
      }
    }

    return NextResponse.json({
      vector,
      source,
      adjusted,
      ...(notes.length > 0 ? { note: notes.join(' ') } : {}),
      ...(room ? { room } : {}),
      ...(book ? { book } : {}),
    })
  } catch (err: any) {
    console.error('[invent-recipe] Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * The saved room a bundle is being matched to.
 *
 * Read field by field rather than trusted as a RoomSpec: this arrives as a
 * challenge_rooms.recipe JSONB written by any past version of the designer, so
 * it can be null, partial, or shaped like something else entirely. Only the
 * four fields the brief quotes are needed, and if any is missing the bundle is
 * simply invented unmatched rather than the request failing.
 */
function readCompanion(raw: unknown): RoomSpec | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const needed = ['name', 'architecture', 'materials', 'palette', 'lighting']
  for (const key of needed) {
    if (typeof o[key] !== 'string' || !(o[key] as string).trim()) return undefined
  }
  return o as unknown as RoomSpec
}

/** Fisher-Yates. The style the model is nudged toward should not always be the same one. */
function shuffle<T>(values: T[]): T[] {
  const copy = [...values]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
