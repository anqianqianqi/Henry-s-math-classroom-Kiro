/**
 * The classification vector — coordinates in theme space.
 *
 * ── WHY THE DICE ROLL BEFORE THE MODEL WRITES ───────────────
 * Asked to "invent a book theme", a language model returns the same theme every
 * time: soft lavender, antique gold, pressed flowers, a cat. Three re-rolls give
 * three synonyms for it. That is mode collapse, and no amount of "be creative"
 * in the prompt fixes it, because the model is not being random — it is being
 * typical, which is what it is for.
 *
 * So the model is never asked to choose. A vector is rolled here, uniformly and
 * deterministically, and the model is handed it as a constraint: write a theme
 * that is {history, textile, period, low-key, warm, dense, geometric}. It cannot
 * return the lavender book, because the lavender book is not in that cell. The
 * dice supply the variety; the model only supplies the prose.
 *
 * The vector is also a coordinate, which buys two things a free-form prompt
 * cannot: a coverage map (which cells has this site never visited?) and a
 * distance function, so "give me something different" means something precise
 * rather than "roll again and hope".
 *
 * Nothing here calls a network. It is pure, seedable, and tested.
 */

import type { AxisVector, ThemeFamily } from '@/lib/types/challengeRoom'
import type { Rng } from './themes'
import { ART_STYLES } from '@/lib/art-styles'

/**
 * The shape lives in types/challengeRoom.ts because it is persisted inside the
 * recipe JSONB; the behaviour lives here. Re-exported so callers need only one
 * import.
 */
export type { AxisVector }

export type Substrate = AxisVector['substrate']
export type Era = AxisVector['era']
export type LightKey = AxisVector['lightKey']
export type Temperature = AxisVector['temperature']
export type Ornament = AxisVector['ornament']
export type Motif = AxisVector['motif']

/**
 * Every legal value, in one place.
 *
 * Exported because three separate things need to agree on it — the roller, the
 * admin's chip row, and the test that proves describeVector() covers all of it.
 * A seventh axis added here without a matching prose entry below fails that test
 * rather than silently sending the model an undefined constraint.
 */
export const AXES = {
  family: ['nature', 'science', 'fantasy', 'history', 'everyday'],
  substrate: ['paper', 'stone', 'metal', 'wood', 'textile', 'synthetic'],
  era: ['ancient', 'period', 'contemporary', 'speculative'],
  lightKey: ['high-key', 'low-key', 'mixed'],
  temperature: ['warm', 'cool', 'split'],
  ornament: ['sparse', 'medium', 'dense'],
  motif: ['botanical', 'marine', 'celestial', 'mechanical', 'geometric', 'culinary'],
} as const satisfies Record<keyof AxisVector, readonly string[]>

export const AXIS_NAMES = Object.keys(AXES) as (keyof AxisVector)[]

/** 19,440 cells. Stated as a computation so it cannot drift from AXES. */
export const CELL_COUNT = AXIS_NAMES.reduce((n, k) => n * AXES[k].length, 1)

// ── Prose sent to the model ─────────────────────────────────────────────────
//
// One line per axis value, written as an instruction rather than a label: the
// model reads "surfaces are chiefly worked metal" and builds from it, where it
// reads "metal" and ignores it.

const FAMILY_PROSE: Record<ThemeFamily, string> = {
  nature: 'the living world — growing things, weather, creatures, landscape',
  science: 'observation and instrument — measuring, recording, exploring',
  fantasy: 'the enchanted — quiet magic taken entirely for granted',
  history: 'a specific human past, treated with respect rather than as costume',
  everyday: 'ordinary domestic and working life, closely observed',
}

const SUBSTRATE_PROSE: Record<Substrate, string> = {
  paper: 'paper, card, vellum and pulp — surfaces that take ink and tear',
  stone: 'stone, plaster, clay and fired earth — surfaces with weight and grain',
  metal: 'worked metal — brass, iron, steel, bronze, with patina and tooling',
  wood: 'timber, bark, cane and grown material, with visible figure',
  textile: 'cloth, felt, woven fibre and thread — surfaces that drape and fray',
  synthetic: 'composite, polymer, glass and engineered surface, precisely made',
}

const ERA_PROSE: Record<Era, string> = {
  ancient: 'long ago — worn, repaired, older than anyone remembers',
  period: 'a recognisable historical period, its craft at its height',
  contemporary: 'now, or near enough — current tools, current materials',
  speculative: 'ahead of the present, extrapolated rather than fantastical',
}

const LIGHT_PROSE: Record<LightKey, string> = {
  'high-key': 'bright and open overall, shadows soft and shallow',
  'low-key': 'mostly shadow, with light arriving in small deliberate amounts',
  mixed: 'strong contrast — a bright source against genuine darkness',
}

const TEMPERATURE_PROSE: Record<Temperature, string> = {
  warm: 'warm throughout — ambers, reds, ochres, warm neutrals',
  cool: 'cool throughout — blues, greens, greys, cool neutrals',
  split: 'split temperature — a warm source against a cool ambient, or the reverse',
}

const ORNAMENT_PROSE: Record<Ornament, string> = {
  sparse: 'almost undecorated; a single considered detail carries the whole',
  medium: 'decorated with restraint — pattern where it earns its place',
  dense: 'richly decorated; pattern and ornament over most surfaces',
}

const MOTIF_PROSE: Record<Motif, string> = {
  botanical: 'growing things — leaf, stem, seed, blossom, fruit',
  marine: 'water and its life — shell, wave, rope, fish, tide',
  celestial: 'sky and beyond — star, moon, orbit, constellation, cloud',
  mechanical: 'made mechanisms — gear, dial, lens, coil, instrument',
  geometric: 'pure form — circle, grid, arc, tessellation, rule',
  culinary: 'food and its keeping — vessel, preserve, loaf, spice, table',
}

/**
 * The constraint block handed to the model.
 *
 * Deliberately not JSON. A bulleted brief is read as art direction and followed;
 * a JSON blob of the same facts is read as metadata and paraphrased back.
 */
export function describeVector(v: AxisVector): string {
  return [
    `- Subject world: ${FAMILY_PROSE[v.family]}.`,
    `- Substrate: ${SUBSTRATE_PROSE[v.substrate]}.`,
    `- Era: ${ERA_PROSE[v.era]}.`,
    `- Light: ${LIGHT_PROSE[v.lightKey]}.`,
    `- Colour temperature: ${TEMPERATURE_PROSE[v.temperature]}.`,
    `- Ornament: ${ORNAMENT_PROSE[v.ornament]}.`,
    `- Decorative motifs draw from: ${MOTIF_PROSE[v.motif]}.`,
  ].join('\n')
}

/** Stable, order-independent identity for a cell. Used for dedupe and coverage. */
export function vectorKey(v: AxisVector): string {
  return AXIS_NAMES.map(k => v[k]).join('/')
}

/** How many axes two cells disagree on, 0–7. */
export function distance(a: AxisVector, b: AxisVector): number {
  return AXIS_NAMES.reduce((n, k) => (a[k] === b[k] ? n : n + 1), 0)
}

/**
 * Which ART_STYLES ids this cell can carry.
 *
 * A style says HOW a thing is painted and the vector says WHAT it is, so most
 * pairings are fine — but a few actively cancel. Flat minimalist art cannot
 * render "richly decorated"; an aged lithograph cannot render a speculative
 * composite panel. Returning those anyway produces an image that satisfies the
 * style and ignores the brief, which reads as the generator being broken.
 *
 * `realistic` is unconditional, so this never returns an empty list — a caller
 * picking from it never has to handle that case.
 */
export function styleFor(v: AxisVector): string[] {
  const out = ['realistic']

  // Hand-painted warmth. Fights precisely-made engineered surface.
  if (v.substrate !== 'synthetic') out.push('ghibli')

  // Pigment needs something that absorbs it.
  if (v.substrate !== 'synthetic' && v.substrate !== 'metal') out.push('watercolour')

  // An aged printing plate can only depict a past.
  if (v.era === 'ancient' || v.era === 'period') out.push('vintage')

  // Hard-edge luminous render, for worlds built after it would exist.
  if (v.era === 'speculative') out.push('futuristic')
  else if (v.era === 'contemporary' && (v.substrate === 'synthetic' || v.substrate === 'metal')) {
    out.push('futuristic')
  }

  // Two or three flat colours and no fine detail — only where none is asked for.
  if (v.ornament === 'sparse') out.push('minimalist')

  return out
}

function pick<T>(values: readonly T[], rng: Rng): T {
  return values[Math.floor(rng() * values.length)]
}

export interface RollOpts {
  rng?: Rng
  /**
   * Recent vectors to steer away from. A candidate is rejected when it matches
   * one exactly or differs from one on fewer than `minDistance` axes.
   */
  avoid?: AxisVector[]
  /** Default 2: one axis apart is the roll that reads as "nothing happened". */
  minDistance?: number
  /**
   * Cells the site has already produced a theme in — rejected on an EXACT match
   * only, never by distance.
   *
   * Separate from `avoid` because the two want opposite treatment at scale.
   * A handful of recent rolls should be given a wide berth; several hundred
   * historical ones should not, or the constraint becomes unsatisfiable and
   * every roll runs out the attempt cap. Exact-match rejection stays cheap and
   * meaningful however long the list grows.
   */
  seen?: AxisVector[]
  /** Axes to hold fixed — used by "re-roll everything but the family". */
  fix?: Partial<AxisVector>
}

/**
 * Roll a cell.
 *
 * The attempt cap matters: with `fix` pinning most axes the reachable set can be
 * smaller than `avoid`, and a while-loop on an unsatisfiable condition inside a
 * request handler is a hung request rather than a bad theme. After 60 tries it
 * returns the last candidate — a slightly repetitive roll beats a timeout.
 */
export function rollVector(opts: RollOpts = {}): AxisVector {
  const rng = opts.rng ?? Math.random
  const avoid = opts.avoid ?? []
  const minDistance = opts.minDistance ?? 2
  const seenKeys = new Set((opts.seen ?? []).map(vectorKey))

  let candidate: AxisVector = rollOnce(rng, opts.fix)
  for (let attempt = 0; attempt < 60; attempt++) {
    const tooClose = avoid.some(a => distance(a, candidate) < minDistance)
    if (!tooClose && !seenKeys.has(vectorKey(candidate))) return candidate
    candidate = rollOnce(rng, opts.fix)
  }
  return candidate
}

function rollOnce(rng: Rng, fix?: Partial<AxisVector>): AxisVector {
  return {
    family: fix?.family ?? pick(AXES.family, rng),
    substrate: fix?.substrate ?? pick(AXES.substrate, rng),
    era: fix?.era ?? pick(AXES.era, rng),
    lightKey: fix?.lightKey ?? pick(AXES.lightKey, rng),
    temperature: fix?.temperature ?? pick(AXES.temperature, rng),
    ornament: fix?.ornament ?? pick(AXES.ornament, rng),
    motif: fix?.motif ?? pick(AXES.motif, rng),
  }
}

/**
 * Narrow an untrusted value to an AxisVector, or null.
 *
 * A vector arrives from two places that can lie: a POST body, and a recipe
 * JSONB written by an older build. Both go through here.
 */
export function parseVector(raw: unknown): AxisVector | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const key of AXIS_NAMES) {
    const value = o[key]
    if (typeof value !== 'string') return null
    if (!(AXES[key] as readonly string[]).includes(value)) return null
    out[key] = value
  }
  return out as unknown as AxisVector
}

/**
 * Same, for a SUBSET of axes — what "pin the family, roll the rest" sends.
 *
 * Unlike parseVector this cannot fail: an axis that is absent or invalid is
 * simply not pinned, and rolls. A malformed pin should widen the roll, never
 * reject the request.
 */
export function parsePartialVector(raw: unknown): Partial<AxisVector> {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const key of AXIS_NAMES) {
    const value = o[key]
    if (typeof value === 'string' && (AXES[key] as readonly string[]).includes(value)) {
      out[key] = value
    }
  }
  return out as Partial<AxisVector>
}

/** Guards the styleFor contract at module load rather than at request time. */
export const KNOWN_STYLE_IDS: ReadonlySet<string> = new Set(ART_STYLES.map(s => s.id))
