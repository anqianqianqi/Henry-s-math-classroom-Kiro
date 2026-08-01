import { describe, expect, it } from 'vitest'
import { ROOM_THEMES, randomRoomSpec } from '../challengeRoom/themes'
import { BOOK_THEMES, randomBookSpec } from '../challengeRoom/bookThemes'
import { validateRoomSpec } from '../challengeRoom/prompt'
import { validateBookSpec } from '../challengeRoom/bookPrompt'
import { ART_STYLES } from '../art-styles'

/**
 * Several hundred hand-written strings, none of which the compiler can check.
 * These tests are the only thing that will notice a blank entry, a duplicate,
 * or a theme added with too few objects.
 */

/** Deterministic, so "it varies" can be asserted without flakiness. */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

const allRoomStrings = ROOM_THEMES.flatMap(t => [
  t.name, t.architecture, t.materials,
  ...t.palettes, ...t.moods, ...t.lighting, ...t.apertures, ...t.views,
  ...t.accents, ...t.objects,
])
const allBookStrings = BOOK_THEMES.flatMap(t => [
  t.name,
  ...t.palettes, ...t.moods, ...t.papers, ...t.frames,
  ...t.innerAccents, ...t.clusters,
])

describe('vocabulary integrity', () => {
  it('has unique theme names on both sides', () => {
    expect(new Set(ROOM_THEMES.map(t => t.name)).size).toBe(ROOM_THEMES.length)
    expect(new Set(BOOK_THEMES.map(t => t.name)).size).toBe(BOOK_THEMES.length)
  })

  it('has no blank strings anywhere', () => {
    for (const s of [...allRoomStrings, ...allBookStrings]) {
      expect(s.trim()).not.toBe('')
    }
  })

  it('gives every room theme enough of each axis', () => {
    for (const t of ROOM_THEMES) {
      expect(t.palettes.length, `${t.name} palettes`).toBeGreaterThanOrEqual(2)
      expect(t.moods.length, `${t.name} moods`).toBeGreaterThanOrEqual(2)
      expect(t.lighting.length, `${t.name} lighting`).toBeGreaterThanOrEqual(2)
      expect(t.apertures.length, `${t.name} apertures`).toBeGreaterThanOrEqual(1)
      expect(t.views.length, `${t.name} views`).toBeGreaterThanOrEqual(3)
      expect(t.accents.length, `${t.name} accents`).toBeGreaterThanOrEqual(1)
      expect(t.styles.length, `${t.name} styles`).toBeGreaterThanOrEqual(1)
      // Below four, pickDistinct silently returns fewer and the prompt compiler
      // reads objects[3] as undefined — a 500 from the preview route, not a
      // type error. This floor is what stops a new theme doing that.
      expect(t.objects.length, `${t.name} objects`).toBeGreaterThanOrEqual(8)
    }
  })

  it('gives every book theme enough of each axis', () => {
    for (const t of BOOK_THEMES) {
      expect(t.palettes.length, `${t.name} palettes`).toBeGreaterThanOrEqual(2)
      expect(t.moods.length, `${t.name} moods`).toBeGreaterThanOrEqual(2)
      expect(t.papers.length, `${t.name} papers`).toBeGreaterThanOrEqual(2)
      expect(t.frames.length, `${t.name} frames`).toBeGreaterThanOrEqual(2)
      expect(t.innerAccents.length, `${t.name} innerAccents`).toBeGreaterThanOrEqual(1)
      expect(t.styles.length, `${t.name} styles`).toBeGreaterThanOrEqual(1)
      expect(t.clusters.length, `${t.name} clusters`).toBeGreaterThanOrEqual(8)
    }
  })

  it('never repeats an object within one theme', () => {
    // A duplicate lets the same gadget land on both sides of the table.
    for (const t of ROOM_THEMES) {
      expect(new Set(t.objects).size, `${t.name}`).toBe(t.objects.length)
    }
    for (const t of BOOK_THEMES) {
      expect(new Set(t.clusters).size, `${t.name}`).toBe(t.clusters.length)
    }
  })

  it('only names art styles that exist', () => {
    const ids = new Set(ART_STYLES.map(s => s.id))
    for (const t of [...ROOM_THEMES, ...BOOK_THEMES]) {
      for (const id of t.styles) {
        expect(ids.has(id), `${t.name} lists unknown style "${id}"`).toBe(true)
      }
    }
  })

  it('keeps minimalist away from rooms that need a deep reveal', () => {
    // Flat two- or three-colour art cannot sell "reveal is visibly deep, with a
    // broad sill and believable frame thickness" — a locked line in the room
    // prompt. Only rooms authored spare enough may list it.
    const spare = new Set(['Quiet Signal Station', 'Cloud Garden Atelier', 'Frostbound Storykeeper', 'Orbital Reading Deck'])
    for (const t of ROOM_THEMES) {
      if (t.styles.includes('minimalist')) {
        expect(spare.has(t.name), `${t.name} allows minimalist`).toBe(true)
      }
    }
  })
})

describe('every roll is usable', () => {
  it('produces a valid room spec 2000 times', () => {
    const rng = seeded(20260801)
    for (let i = 0; i < 2000; i++) {
      expect(validateRoomSpec(randomRoomSpec(undefined, { rng }))).toBeNull()
    }
  })

  it('produces a valid book spec 2000 times', () => {
    const rng = seeded(7)
    for (let i = 0; i < 2000; i++) {
      expect(validateBookSpec(randomBookSpec(undefined, { rng }))).toBeNull()
    }
  })

  it('deals four different objects, split across the two sides', () => {
    const rng = seeded(99)
    for (let i = 0; i < 500; i++) {
      const s = randomRoomSpec(undefined, { rng })
      const all = [...s.leftObjects, ...s.rightObjects]
      expect(new Set(all).size).toBe(4)
    }
  })

  it('deals four different corner clusters', () => {
    const rng = seeded(1234)
    for (let i = 0; i < 500; i++) {
      const s = randomBookSpec(undefined, { rng })
      expect(new Set(s.cornerClusters).size).toBe(4)
    }
  })
})

describe('the axes actually vary', () => {
  // This is the bug being fixed, stated as a test: under the old code every
  // one of these would return exactly one distinct value.
  it('varies palette, mood, lighting, aperture and style within one room theme', () => {
    const rng = seeded(2024)
    const theme = ROOM_THEMES[0]
    const rolls = Array.from({ length: 200 }, () => randomRoomSpec(theme, { rng }))
    expect(new Set(rolls.map(r => r.palette)).size).toBeGreaterThanOrEqual(2)
    expect(new Set(rolls.map(r => r.mood)).size).toBeGreaterThanOrEqual(2)
    expect(new Set(rolls.map(r => r.lighting)).size).toBeGreaterThanOrEqual(2)
    expect(new Set(rolls.map(r => r.aperture)).size).toBeGreaterThanOrEqual(2)
    expect(new Set(rolls.map(r => r.artStyle)).size).toBeGreaterThanOrEqual(2)
    expect(new Set(rolls.map(r => r.outsideView)).size).toBeGreaterThanOrEqual(3)
  })

  it('varies palette, mood, paper, frame and style within one book theme', () => {
    const rng = seeded(555)
    const theme = BOOK_THEMES[0]
    const rolls = Array.from({ length: 200 }, () => randomBookSpec(theme, { rng }))
    expect(new Set(rolls.map(r => r.palette)).size).toBeGreaterThanOrEqual(2)
    expect(new Set(rolls.map(r => r.mood)).size).toBeGreaterThanOrEqual(2)
    expect(new Set(rolls.map(r => r.paper)).size).toBeGreaterThanOrEqual(2)
    expect(new Set(rolls.map(r => r.frame)).size).toBeGreaterThanOrEqual(2)
    expect(new Set(rolls.map(r => r.artStyle)).size).toBeGreaterThanOrEqual(2)
  })
})

describe('the dice does not repeat itself', () => {
  it('never returns the avoided theme', () => {
    const rng = seeded(31337)
    const avoid = ROOM_THEMES[2].name
    for (let i = 0; i < 500; i++) {
      expect(randomRoomSpec(undefined, { avoid, rng }).name).not.toBe(avoid)
    }
  })

  it('still works when every theme is avoided', () => {
    // Degenerate but reachable if the list is ever one entry long.
    const only = ROOM_THEMES.map(t => t.name).join('|')
    expect(randomRoomSpec(undefined, { avoid: only }).name).toBeTruthy()
  })

  it('honours an explicit style over the theme allow-list', () => {
    const s = randomRoomSpec(ROOM_THEMES[0], { style: 'vintage', rng: seeded(4) })
    expect(s.artStyle).toBe('vintage')
  })
})
