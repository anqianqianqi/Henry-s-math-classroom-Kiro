import { describe, expect, it } from 'vitest'
import {
  AXES,
  AXIS_NAMES,
  CELL_COUNT,
  KNOWN_STYLE_IDS,
  describeVector,
  distance,
  parsePartialVector,
  parseVector,
  rollVector,
  styleFor,
  vectorKey,
  type AxisVector,
} from '../challengeRoom/axes'
import { catalog } from '../i18n/catalog'

/**
 * The vector is the only thing standing between the generator and the model
 * returning its favourite theme nine times out of ten, so "it is uniform" and
 * "every cell is describable" are the load-bearing claims here — not the shape
 * of the object, which the compiler already has.
 */

function seeded(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** Every cell in the space. 19,440 of them — cheap enough to test exhaustively. */
function everyVector(): AxisVector[] {
  let acc: Record<string, string>[] = [{}]
  for (const axis of AXIS_NAMES) {
    const next: Record<string, string>[] = []
    for (const partial of acc) {
      for (const value of AXES[axis]) next.push({ ...partial, [axis]: value })
    }
    acc = next
  }
  return acc as unknown as AxisVector[]
}

describe('the space itself', () => {
  it('has the cell count its parts multiply to', () => {
    expect(CELL_COUNT).toBe(19440)
    expect(everyVector().length).toBe(CELL_COUNT)
  })

  it('gives every cell a distinct key', () => {
    const keys = new Set(everyVector().map(vectorKey))
    expect(keys.size).toBe(CELL_COUNT)
  })
})

describe('describeVector', () => {
  /*
   * The failure this catches is quiet and expensive: an axis value added to
   * AXES without a matching prose entry sends the model the literal string
   * "undefined" as art direction, which it will cheerfully act on.
   */
  it('has prose for every value of every axis', () => {
    for (const v of everyVector()) {
      const text = describeVector(v)
      expect(text, vectorKey(v)).not.toContain('undefined')
      expect(text.split('\n').length).toBe(AXIS_NAMES.length)
    }
  })
})

describe('the catalog keeps up with the axes', () => {
  /*
   * Every axis value reaches the screen as a chip in AxisChips, which assembles
   * its key at runtime and so gets no help from the compiler. This is what
   * stands in for that: an axis value added without translations fails here
   * rather than rendering a raw key at a Chinese reader.
   */
  it('translates every axis name and every axis value', () => {
    for (const axis of AXIS_NAMES) {
      const nameEntry = (catalog as Record<string, { en: string; zh: string }>)[`axis.${axis}`]
      expect(nameEntry, `missing catalog key axis.${axis}`).toBeDefined()
      expect(nameEntry.en.trim()).not.toBe('')
      expect(nameEntry.zh.trim()).not.toBe('')

      for (const value of AXES[axis]) {
        const key = `axis.${axis}.${value}`
        const entry = (catalog as Record<string, { en: string; zh: string }>)[key]
        expect(entry, `missing catalog key ${key}`).toBeDefined()
        // An empty zh renders English, which reads as a bug rather than a
        // fallback — see CLAUDE.md.
        expect(entry.en.trim(), `${key} has no en`).not.toBe('')
        expect(entry.zh.trim(), `${key} has no zh`).not.toBe('')
      }
    }
  })
})

describe('styleFor', () => {
  it('never returns an empty list', () => {
    for (const v of everyVector()) {
      expect(styleFor(v).length, vectorKey(v)).toBeGreaterThan(0)
    }
  })

  it('only names styles that exist', () => {
    for (const v of everyVector()) {
      for (const id of styleFor(v)) {
        expect(KNOWN_STYLE_IDS.has(id), `${vectorKey(v)} → ${id}`).toBe(true)
      }
    }
  })

  it('keeps flat minimalist away from decorated worlds', () => {
    // Two or three flat colours cannot render "pattern over most surfaces";
    // asking for both gives an image that honours the style and drops the brief.
    for (const v of everyVector()) {
      if (styleFor(v).includes('minimalist')) {
        expect(v.ornament, vectorKey(v)).toBe('sparse')
      }
    }
  })

  it('keeps an aged printing plate away from a future', () => {
    for (const v of everyVector()) {
      if (styleFor(v).includes('vintage')) {
        expect(['ancient', 'period'], vectorKey(v)).toContain(v.era)
      }
    }
  })

  it('keeps watercolour off surfaces that do not take pigment', () => {
    for (const v of everyVector()) {
      if (styleFor(v).includes('watercolour')) {
        expect(['metal', 'synthetic']).not.toContain(v.substrate)
      }
    }
  })
})

describe('rollVector', () => {
  it('is deterministic under a seed', () => {
    const a = rollVector({ rng: seeded(42) })
    const b = rollVector({ rng: seeded(42) })
    expect(vectorKey(a)).toBe(vectorKey(b))
  })

  it('reaches a wide spread of cells', () => {
    // The whole point of rolling rather than asking. 300 rolls landing on
    // fewer than 200 distinct cells would mean the roller has a favourite.
    const rng = seeded(2026)
    const keys = new Set(Array.from({ length: 300 }, () => vectorKey(rollVector({ rng }))))
    expect(keys.size).toBeGreaterThan(200)
  })

  it('uses every value of every axis across enough rolls', () => {
    const rng = seeded(31337)
    const seen: Record<string, Set<string>> = {}
    for (const axis of AXIS_NAMES) seen[axis] = new Set()
    for (let i = 0; i < 3000; i++) {
      const v = rollVector({ rng })
      for (const axis of AXIS_NAMES) seen[axis].add(v[axis])
    }
    for (const axis of AXIS_NAMES) {
      expect(seen[axis].size, `${axis} never used every value`).toBe(AXES[axis].length)
    }
  })

  it('stays away from what it is told to avoid', () => {
    const rng = seeded(7)
    const avoid = [rollVector({ rng })]
    for (let i = 0; i < 200; i++) {
      const v = rollVector({ rng, avoid, minDistance: 2 })
      expect(distance(avoid[0], v)).toBeGreaterThanOrEqual(2)
    }
  })

  it('honours fixed axes', () => {
    const rng = seeded(11)
    for (let i = 0; i < 100; i++) {
      const v = rollVector({ rng, fix: { family: 'science', motif: 'celestial' } })
      expect(v.family).toBe('science')
      expect(v.motif).toBe('celestial')
    }
  })

  it('returns rather than hanging when the constraint cannot be met', () => {
    /*
     * Every axis pinned leaves exactly one reachable cell, and it is the one
     * being avoided. The attempt cap is what makes this return a repeat instead
     * of spinning forever inside a request handler.
     */
    const only: AxisVector = {
      family: 'nature', substrate: 'paper', era: 'ancient',
      lightKey: 'mixed', temperature: 'warm', ornament: 'dense', motif: 'botanical',
    }
    const v = rollVector({ fix: only, avoid: [only], minDistance: 3 })
    expect(vectorKey(v)).toBe(vectorKey(only))
  })
})

describe('distance', () => {
  it('is zero for a cell against itself and seven for a full mismatch', () => {
    const a: AxisVector = {
      family: 'nature', substrate: 'paper', era: 'ancient',
      lightKey: 'high-key', temperature: 'warm', ornament: 'sparse', motif: 'botanical',
    }
    const b: AxisVector = {
      family: 'science', substrate: 'metal', era: 'speculative',
      lightKey: 'low-key', temperature: 'cool', ornament: 'dense', motif: 'mechanical',
    }
    expect(distance(a, a)).toBe(0)
    expect(distance(a, b)).toBe(7)
    expect(distance(a, b)).toBe(distance(b, a))
  })
})

describe('parseVector', () => {
  const good: AxisVector = {
    family: 'history', substrate: 'textile', era: 'period',
    lightKey: 'low-key', temperature: 'warm', ornament: 'dense', motif: 'geometric',
  }

  it('accepts a well-formed vector', () => {
    expect(parseVector({ ...good })).toEqual(good)
  })

  it('rejects anything that is not one', () => {
    expect(parseVector(null)).toBeNull()
    expect(parseVector('history')).toBeNull()
    expect(parseVector({})).toBeNull()
    // A value outside the axis — the shape a hand-edited recipe produces.
    expect(parseVector({ ...good, motif: 'gothic' })).toBeNull()
    // A missing axis.
    const { motif, ...missing } = good
    expect(parseVector(missing)).toBeNull()
  })

  it('drops unknown extra keys rather than passing them through', () => {
    const parsed = parseVector({ ...good, injected: 'ignore me' })
    expect(parsed).toEqual(good)
    expect(Object.keys(parsed!)).toEqual([...AXIS_NAMES])
  })
})

describe('parsePartialVector', () => {
  it('keeps the axes that are valid', () => {
    expect(parsePartialVector({ family: 'science', motif: 'celestial' }))
      .toEqual({ family: 'science', motif: 'celestial' })
  })

  it('silently drops the ones that are not, rather than rejecting the pin', () => {
    // A stale client sending a retired axis value should widen the roll, not
    // put the admin's button into a permanent 400.
    expect(parsePartialVector({ family: 'science', motif: 'gothic', era: 7 }))
      .toEqual({ family: 'science' })
    expect(parsePartialVector(null)).toEqual({})
    expect(parsePartialVector('science')).toEqual({})
  })

  it('feeds rollVector, which then pins only what survived', () => {
    const fix = parsePartialVector({ family: 'history', substrate: 'nonsense' })
    const rng = seeded(5)
    for (let i = 0; i < 50; i++) {
      expect(rollVector({ rng, fix }).family).toBe('history')
    }
  })
})
