/**
 * Promoting an invented recipe into a reusable theme.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────
 * Without it, Invent is a slot machine: every good theme an admin produces is
 * discarded the moment they press the button again, and the library is the same
 * ten worlds forever. The point of a generator is that the space it draws from
 * grows.
 *
 * ── ONE SPEC IS NOT ONE THEME ───────────────────────────────
 * A RoomSpec has ONE architecture, ONE palette, ONE lighting. A RoomTheme has
 * lists of each — that difference is the whole subject of themes.ts, and
 * promoting a spec into single-element lists would recreate the exact bug that
 * file was reshaped to fix, one saved theme at a time.
 *
 * So promotion is an APPEND, not an insert. Promoting a second recipe under a
 * name that already exists folds its values into that theme's lists rather than
 * making a rival row. Three or four promotions into one world and it has the
 * same shape as a hand-authored entry — which is how the hand-authored ones
 * were written in the first place, a value at a time.
 *
 * Pure: no supabase, no fetch. The route calls this; the tests call it directly.
 */

import type { RoomTheme } from './themes'
import type { BookTheme } from './bookThemes'
import type { AxisVector, BookSpec, RoomSpec, ThemeFamily } from '@/lib/types/challengeRoom'

/** A challenge_room_themes row, as the database spells it. */
export interface RoomThemeRow {
  id?: string
  name: string
  family: string
  styles: unknown
  architectures: unknown
  material_sets: unknown
  palettes: unknown
  moods: unknown
  lighting: unknown
  apertures: unknown
  views: unknown
  accents: unknown
  objects: unknown
  axes?: unknown
  is_active?: boolean
}

/** A book_bundle_themes row. */
export interface BookThemeRow {
  id?: string
  name: string
  family: string
  styles: unknown
  palettes: unknown
  moods: unknown
  papers: unknown
  grounds: unknown
  frames: unknown
  inner_accents: unknown
  clusters: unknown
  axes?: unknown
  is_active?: boolean
}

const FAMILIES: ThemeFamily[] = ['nature', 'science', 'fantasy', 'history', 'everyday']

function asFamily(value: unknown): ThemeFamily {
  return FAMILIES.includes(value as ThemeFamily) ? (value as ThemeFamily) : 'everyday'
}

/**
 * A JSONB column read back as a string list.
 *
 * Defensive because these columns are hand-editable in the Supabase dashboard,
 * and a theme with a null `objects` reaches pickDistinct as undefined — a 500
 * from the preview route rather than a type error anyone would have caught.
 */
function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string')
    .map(v => v.trim())
    .filter(Boolean)
}

/** Append, keeping order, dropping anything already present case-insensitively. */
function union(existing: string[], additions: (string | undefined)[]): string[] {
  const out = [...existing]
  const seen = new Set(existing.map(v => v.toLowerCase()))
  for (const addition of additions) {
    const value = addition?.trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

export function rowToRoomTheme(row: RoomThemeRow): RoomTheme {
  return {
    name: row.name,
    family: asFamily(row.family),
    styles: asList(row.styles),
    architectures: asList(row.architectures),
    materialSets: asList(row.material_sets),
    palettes: asList(row.palettes),
    moods: asList(row.moods),
    lighting: asList(row.lighting),
    apertures: asList(row.apertures),
    views: asList(row.views),
    accents: asList(row.accents),
    objects: asList(row.objects),
  }
}

export function rowToBookTheme(row: BookThemeRow): BookTheme {
  return {
    name: row.name,
    family: asFamily(row.family),
    styles: asList(row.styles),
    palettes: asList(row.palettes),
    moods: asList(row.moods),
    papers: asList(row.papers),
    grounds: asList(row.grounds),
    frames: asList(row.frames),
    innerAccents: asList(row.inner_accents),
    clusters: asList(row.clusters),
  }
}

/**
 * Fold a recipe into a theme, or start one from it.
 *
 * `existing` null means this name is new. The family comes from the recipe's
 * own cell when it has one — a promoted preset roll does not, and lands in
 * 'everyday', which is the honest answer for "unclassified".
 */
export function mergeRoomTheme(existing: RoomTheme | null, spec: RoomSpec): RoomTheme {
  const base: RoomTheme = existing ?? {
    name: spec.name.trim(),
    family: asFamily(spec.axes?.family),
    styles: [],
    architectures: [],
    materialSets: [],
    palettes: [],
    moods: [],
    lighting: [],
    apertures: [],
    views: [],
    accents: [],
    objects: [],
  }

  return {
    name: base.name,
    family: base.family,
    styles: union(base.styles, [spec.artStyle]),
    architectures: union(base.architectures, [spec.architecture]),
    materialSets: union(base.materialSets, [spec.materials]),
    palettes: union(base.palettes, [spec.palette]),
    moods: union(base.moods, [spec.mood]),
    lighting: union(base.lighting, [spec.lighting]),
    apertures: union(base.apertures, [spec.aperture]),
    views: union(base.views, [spec.outsideView]),
    accents: union(base.accents, [spec.accent]),
    objects: union(base.objects, [...spec.leftObjects, ...spec.rightObjects]),
  }
}

export function mergeBookTheme(existing: BookTheme | null, spec: BookSpec): BookTheme {
  const base: BookTheme = existing ?? {
    name: spec.name.trim(),
    family: asFamily(spec.axes?.family),
    styles: [],
    palettes: [],
    moods: [],
    papers: [],
    grounds: [],
    frames: [],
    innerAccents: [],
    clusters: [],
  }

  return {
    name: base.name,
    family: base.family,
    styles: union(base.styles, [spec.artStyle]),
    palettes: union(base.palettes, [spec.palette]),
    moods: union(base.moods, [spec.mood]),
    papers: union(base.papers, [spec.paper]),
    grounds: union(base.grounds, [spec.ground]),
    frames: union(base.frames, [spec.frame]),
    innerAccents: union(base.innerAccents, [spec.innerAccent]),
    clusters: union(base.clusters, spec.cornerClusters),
  }
}

export function roomThemeToRow(theme: RoomTheme, axes?: AxisVector): Omit<RoomThemeRow, 'id'> {
  return {
    name: theme.name,
    family: theme.family,
    styles: theme.styles,
    architectures: theme.architectures,
    material_sets: theme.materialSets,
    palettes: theme.palettes,
    moods: theme.moods,
    lighting: theme.lighting,
    apertures: theme.apertures,
    views: theme.views,
    accents: theme.accents,
    objects: theme.objects,
    ...(axes ? { axes } : {}),
  }
}

export function bookThemeToRow(theme: BookTheme, axes?: AxisVector): Omit<BookThemeRow, 'id'> {
  return {
    name: theme.name,
    family: theme.family,
    styles: theme.styles,
    palettes: theme.palettes,
    moods: theme.moods,
    papers: theme.papers,
    grounds: theme.grounds,
    frames: theme.frames,
    inner_accents: theme.innerAccents,
    clusters: theme.clusters,
    ...(axes ? { axes } : {}),
  }
}

/**
 * Is this theme complete enough to hand to randomRoomSpec?
 *
 * pickDistinct(objects, 4) silently returns fewer than four when the list is
 * short, and the prompt compiler then reads objects[3] as undefined — which
 * surfaces as a 500 from the preview route, long after the theme was saved.
 * A freshly promoted theme has exactly four, which is the floor, not a problem.
 */
export function roomThemeIsUsable(theme: RoomTheme): boolean {
  return (
    theme.objects.length >= 4 &&
    theme.architectures.length >= 1 &&
    theme.materialSets.length >= 1 &&
    theme.palettes.length >= 1 &&
    theme.moods.length >= 1 &&
    theme.lighting.length >= 1 &&
    theme.views.length >= 1 &&
    theme.accents.length >= 1
  )
}

export function bookThemeIsUsable(theme: BookTheme): boolean {
  return (
    theme.clusters.length >= 4 &&
    theme.palettes.length >= 1 &&
    theme.moods.length >= 1 &&
    theme.papers.length >= 1 &&
    // Not gated: a theme promoted before `grounds` existed has none, and the
    // compiler falls back to the palette's deepest tone rather than failing.
    theme.frames.length >= 1
  )
}
