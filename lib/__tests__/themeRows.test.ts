import { describe, expect, it } from 'vitest'
import {
  bookThemeIsUsable,
  bookThemeToRow,
  mergeBookTheme,
  mergeRoomTheme,
  roomThemeIsUsable,
  roomThemeToRow,
  rowToBookTheme,
  rowToRoomTheme,
} from '../challengeRoom/themeRows'
import { randomBookSpec, BOOK_THEMES } from '../challengeRoom/bookThemes'
import { randomRoomSpec, ROOM_THEMES } from '../challengeRoom/themes'
import { validateRoomSpec } from '../challengeRoom/prompt'
import { validateBookSpec } from '../challengeRoom/bookPrompt'
import type { AxisVector, RoomSpec } from '../types/challengeRoom'

function seeded(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

const VECTOR: AxisVector = {
  family: 'history', substrate: 'textile', era: 'period',
  lightKey: 'low-key', temperature: 'warm', ornament: 'dense', motif: 'geometric',
}

describe('promotion folds rather than replaces', () => {
  /*
   * The bug this is guarding: promoting each recipe as its own row would give
   * a library of themes that can each make exactly one room — precisely what
   * themes.ts was reshaped to stop. A second promotion under the same name has
   * to WIDEN the first.
   */
  it('starts a theme from one recipe', () => {
    const spec = { ...randomRoomSpec(ROOM_THEMES[0], { rng: seeded(1) }), axes: VECTOR }
    const theme = mergeRoomTheme(null, spec)

    expect(theme.name).toBe(spec.name)
    expect(theme.family).toBe('history')
    expect(theme.architectures).toEqual([spec.architecture])
    expect(theme.objects).toEqual([...spec.leftObjects, ...spec.rightObjects])
    expect(theme.objects).toHaveLength(4)
  })

  it('widens every axis when a second recipe is folded in', () => {
    const rng = seeded(99)
    const first = randomRoomSpec(ROOM_THEMES[0], { rng })
    const one = mergeRoomTheme(null, first)

    // A hand-differing second recipe: every axis carries a new value.
    const second: RoomSpec = {
      ...first,
      architecture: 'a rope-walk gallery with tarred beams overhead',
      materials: 'tarred hemp, salt-bleached oak, black iron',
      palette: 'tar black, hemp gold, sea grey, rust',
      mood: 'taut, methodical, salt-worn',
      lighting: 'flat sea light down the length of the gallery',
      outsideView: 'a grey harbour with two moored hulls',
      accent: 'coiled rope motifs carved along the beam ends',
      aperture: 'long shuttered opening with a heavy timber lintel',
      leftObjects: ['a hemp fid on a canvas mat', 'a tar pot with a stiff brush'],
      rightObjects: ['a spliced rope sample tied off', 'a beeswax block worn to a curve'],
    }
    const two = mergeRoomTheme(one, second)

    expect(two.architectures).toHaveLength(2)
    expect(two.materialSets).toHaveLength(2)
    expect(two.palettes).toHaveLength(2)
    expect(two.moods).toHaveLength(2)
    expect(two.lighting).toHaveLength(2)
    expect(two.views).toHaveLength(2)
    expect(two.accents).toHaveLength(2)
    expect(two.apertures).toHaveLength(2)
    expect(two.objects).toHaveLength(8)
    // The name and family belong to the theme, not the newest recipe.
    expect(two.name).toBe(one.name)
  })

  it('does not duplicate a value that is already there', () => {
    const spec = randomRoomSpec(ROOM_THEMES[1], { rng: seeded(7) })
    const once = mergeRoomTheme(null, spec)
    const twice = mergeRoomTheme(once, spec)
    expect(twice).toEqual(once)
  })

  it('treats a differently-cased repeat as the same value', () => {
    const spec = randomRoomSpec(ROOM_THEMES[1], { rng: seeded(8) })
    const once = mergeRoomTheme(null, spec)
    const shouted = mergeRoomTheme(once, {
      ...spec,
      palette: spec.palette.toUpperCase(),
      architecture: `  ${spec.architecture}  `,
    })
    expect(shouted.palettes).toHaveLength(1)
    expect(shouted.architectures).toHaveLength(1)
  })

  it('lands unclassified recipes in everyday rather than guessing', () => {
    const spec = randomRoomSpec(ROOM_THEMES[0], { rng: seeded(3) })
    expect(spec.axes).toBeUndefined()
    expect(mergeRoomTheme(null, spec).family).toBe('everyday')
  })

  it('does the same for bundles', () => {
    const rng = seeded(555)
    const first = { ...randomBookSpec(BOOK_THEMES[0], { rng }), axes: VECTOR }
    const one = mergeBookTheme(null, first)
    expect(one.clusters).toHaveLength(4)
    expect(one.family).toBe('history')

    const second = randomBookSpec(BOOK_THEMES[3], { rng })
    const two = mergeBookTheme(one, { ...second, name: first.name })
    expect(two.name).toBe(first.name)
    expect(two.papers.length).toBeGreaterThan(1)
    expect(two.clusters).toHaveLength(8)
  })
})

describe('a promoted theme is a usable theme', () => {
  /*
   * The failure mode is silent and late: pickDistinct(objects, 4) on a short
   * list returns fewer than four, the prompt compiler reads objects[3] as
   * undefined, and the preview route 500s — days after the theme was saved.
   */
  it('produces valid specs from a theme promoted out of a single recipe', () => {
    const spec = randomRoomSpec(ROOM_THEMES[4], { rng: seeded(21) })
    const theme = mergeRoomTheme(null, spec)
    expect(roomThemeIsUsable(theme)).toBe(true)

    const rng = seeded(64)
    for (let i = 0; i < 200; i++) {
      const rolled = randomRoomSpec(theme, { rng })
      expect(validateRoomSpec(rolled)).toBeNull()
      expect(new Set([...rolled.leftObjects, ...rolled.rightObjects]).size).toBe(4)
    }
  })

  it('does the same for a promoted bundle theme', () => {
    const spec = randomBookSpec(BOOK_THEMES[2], { rng: seeded(22) })
    const theme = mergeBookTheme(null, spec)
    expect(bookThemeIsUsable(theme)).toBe(true)

    const rng = seeded(65)
    for (let i = 0; i < 200; i++) {
      const rolled = randomBookSpec(theme, { rng })
      expect(validateBookSpec(rolled)).toBeNull()
      expect(new Set(rolled.cornerClusters).size).toBe(4)
    }
  })

  it('rejects a theme too thin to roll from', () => {
    const spec = randomRoomSpec(ROOM_THEMES[0], { rng: seeded(31) })
    const theme = mergeRoomTheme(null, spec)
    expect(roomThemeIsUsable({ ...theme, objects: theme.objects.slice(0, 3) })).toBe(false)
    expect(roomThemeIsUsable({ ...theme, palettes: [] })).toBe(false)
  })
})

describe('row conversion', () => {
  it('round-trips a room theme', () => {
    const theme = mergeRoomTheme(null, { ...randomRoomSpec(ROOM_THEMES[0], { rng: seeded(2) }), axes: VECTOR })
    const row = roomThemeToRow(theme, VECTOR)
    expect(row.material_sets).toEqual(theme.materialSets)
    expect(rowToRoomTheme(row as any)).toEqual(theme)
  })

  it('round-trips a book theme', () => {
    const theme = mergeBookTheme(null, { ...randomBookSpec(BOOK_THEMES[0], { rng: seeded(4) }), axes: VECTOR })
    const row = bookThemeToRow(theme, VECTOR)
    expect(row.inner_accents).toEqual(theme.innerAccents)
    expect(rowToBookTheme(row as any)).toEqual(theme)
  })

  it('survives a row someone edited by hand in the dashboard', () => {
    // JSONB columns are editable in the Supabase UI, so null and mixed-type
    // lists are reachable states. They must degrade to empty, not to undefined
    // reaching pickDistinct.
    const theme = rowToRoomTheme({
      name: 'Half Typed', family: 'not-a-family',
      styles: null, architectures: ['  a hall  ', '', 42],
      material_sets: 'oak', palettes: [], moods: undefined,
      lighting: [], apertures: [], views: [], accents: [], objects: [],
    } as any)

    expect(theme.family).toBe('everyday')
    expect(theme.styles).toEqual([])
    expect(theme.architectures).toEqual(['a hall'])
    expect(theme.materialSets).toEqual([])
    expect(roomThemeIsUsable(theme)).toBe(false)
  })
})
