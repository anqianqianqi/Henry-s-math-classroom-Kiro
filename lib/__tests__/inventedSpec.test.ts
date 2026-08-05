import { describe, expect, it } from 'vitest'
import { extractJson, parseInventedBook, parseInventedRoom } from '../challengeRoom/inventedSpec'
import { ROOM_THEMES } from '../challengeRoom/themes'
import { BOOK_THEMES } from '../challengeRoom/bookThemes'
import { validateRoomSpec } from '../challengeRoom/prompt'
import { validateBookSpec } from '../challengeRoom/bookPrompt'
import { compileRoomPrompt } from '../challengeRoom/prompt'
import { compileCoverPrompt } from '../challengeRoom/bookPrompt'
import type { AxisVector } from '../types/challengeRoom'

const OPTS = { allowedStyles: ['ghibli', 'watercolour'] }

const VECTOR: AxisVector = {
  family: 'fantasy', substrate: 'wood', era: 'period',
  lightKey: 'low-key', temperature: 'warm', ornament: 'dense', motif: 'botanical',
}

/** A response that should always pass, so each test can vary one thing. */
function roomJson(over: Record<string, unknown> = {}) {
  return {
    name: 'Tallow Chandlery Loft',
    mood: 'close, industrious, warm',
    palette: 'tallow cream, soot black, ember orange, worn brass',
    architecture: 'a low chandler\'s loft with hooked beams and a deep dipping trough along one wall',
    materials: 'scrubbed pine, blackened iron, poured wax, oiled canvas',
    lighting: 'a bank of guttering candles against cold light from the shutters',
    outsideView: 'a wet cobbled yard stacked with barrels',
    accent: 'wax runnels hardened down the beam faces',
    aperture: 'square shuttered opening with a thick timber reveal',
    objects: [
      'a bundle of dipped tapers hung from a rod',
      'a copper wax ladle resting on a tile',
      'a wick-trimming scissor with a shaped catch',
      'a stoneware jar of beeswax pellets',
    ],
    artStyle: 'ghibli',
    ...over,
  }
}

function bookJson(over: Record<string, unknown> = {}) {
  return {
    name: 'Chandler\'s Wax Almanac',
    mood: 'warm, patient, faintly smoky',
    palette: 'tallow cream, soot black, ember orange, worn brass',
    paper: 'laid stock with a faint waxed sheen',
    ground: 'tallow gold',
    frame: 'thin blackened rule with small dripped-wax corner marks',
    innerAccent: 'two slender tapers and a scatter of wax beads',
    cornerClusters: [
      'a beeswax block with a sprig of rosemary',
      'a brass snuffer beside three short candle stubs',
      'a honeycomb fragment with two bees',
      'a coil of cotton wick on a wooden spool',
    ],
    artStyle: 'watercolour',
    ...over,
  }
}

/**
 * ── THE TEST THAT KEEPS THE FILTER HONEST ───────────────────
 * The banned-pattern list is guessing at what breaks a locked prompt section,
 * and the cheapest way for that guess to be wrong is to be too strict. So the
 * entire hand-authored library runs through it: several hundred strings a
 * person wrote and shipped. Anything the filter rejects here, it would also
 * have rejected from a human — which makes it the filter that is wrong, not the
 * string.
 *
 * This is what caught /book/ (rejects "a spiral-bound log book squared to the
 * edge", an existing Quiet Signal Station object) and /letter/ (rejects "a
 * little owl with a closed letter and a wax seal").
 */
describe('the existing library passes its own filter', () => {
  it('accepts every authored room object', () => {
    for (const theme of ROOM_THEMES) {
      for (const object of theme.objects) {
        const others = theme.objects.filter(o => o !== object).slice(0, 3)
        const result = parseInventedRoom(roomJson({ objects: [object, ...others] }), OPTS)
        expect(
          result.ok ? '' : `${theme.name} / "${object}" → ${result.reason}`,
        ).toBe('')
      }
    }
  })

  it('accepts every authored room architecture, material set and accent', () => {
    for (const theme of ROOM_THEMES) {
      for (const architecture of theme.architectures) {
        const r = parseInventedRoom(roomJson({ architecture }), OPTS)
        expect(r.ok ? '' : `${architecture} → ${r.reason}`).toBe('')
      }
      for (const materials of theme.materialSets) {
        const r = parseInventedRoom(roomJson({ materials }), OPTS)
        expect(r.ok ? '' : `${materials} → ${r.reason}`).toBe('')
      }
      for (const accent of theme.accents) {
        const r = parseInventedRoom(roomJson({ accent }), OPTS)
        expect(r.ok ? '' : `${accent} → ${r.reason}`).toBe('')
      }
    }
  })

  it('accepts every authored corner cluster', () => {
    for (const theme of BOOK_THEMES) {
      for (const cluster of theme.clusters) {
        const others = theme.clusters.filter(c => c !== cluster).slice(0, 3)
        const result = parseInventedBook(bookJson({ cornerClusters: [cluster, ...others] }), OPTS)
        expect(
          result.ok ? '' : `${theme.name} / "${cluster}" → ${result.reason}`,
        ).toBe('')
      }
    }
  })

  it('accepts every authored paper, ground and frame', () => {
    for (const theme of BOOK_THEMES) {
      for (const paper of theme.papers) {
        const r = parseInventedBook(bookJson({ paper }), OPTS)
        expect(r.ok ? '' : `${paper} → ${r.reason}`).toBe('')
      }
      for (const ground of theme.grounds) {
        const r = parseInventedBook(bookJson({ ground }), OPTS)
        expect(r.ok ? '' : `${ground} → ${r.reason}`).toBe('')
      }
      for (const frame of theme.frames) {
        const r = parseInventedBook(bookJson({ frame }), OPTS)
        expect(r.ok ? '' : `${frame} → ${r.reason}`).toBe('')
      }
    }
  })
})

describe('the patterns that matter', () => {
  const rejectedRoom = (objects: string[]) => {
    const r = parseInventedRoom(roomJson({ objects }), OPTS)
    return r.ok ? null : r.reason
  }

  it('rejects a book that would be mistaken for the composited one', () => {
    expect(rejectedRoom([
      'an open book on a brass stand',
      'a copper wax ladle resting on a tile',
      'a wick-trimming scissor with a shaped catch',
      'a stoneware jar of beeswax pellets',
    ])).toMatch(/banned pattern/)
  })

  it('still allows a closed book, which the authored library uses', () => {
    const r = parseInventedRoom(roomJson({
      objects: [
        'a spiral-bound log book squared to the edge',
        'a slim notebook bound in pale linen',
        'a cloth-bound ledger with a ribbon marker',
        'a soft-cover logbook held by an elastic strap',
      ],
    }), OPTS)
    expect(r.ok).toBe(true)
  })

  it('rejects an object claiming the empty central zone', () => {
    expect(rejectedRoom([
      'a low bowl set in the centre of the table',
      'a copper wax ladle resting on a tile',
      'a wick-trimming scissor with a shaped catch',
      'a stoneware jar of beeswax pellets',
    ])).toMatch(/banned pattern/)
  })

  it('rejects anything asking the image model to render type', () => {
    expect(rejectedRoom([
      'a small sign with bold lettering',
      'a copper wax ladle resting on a tile',
      'a wick-trimming scissor with a shaped catch',
      'a stoneware jar of beeswax pellets',
    ])).toMatch(/banned pattern/)
  })

  it('rejects people, which the room prompt forbids outright', () => {
    expect(rejectedRoom([
      'a child\'s wooden stool pulled up to the bench',
      'a copper wax ladle resting on a tile',
      'a wick-trimming scissor with a shaped catch',
      'a stoneware jar of beeswax pellets',
    ])).toMatch(/banned pattern/)
  })

  it('rejects a cover title but allows a sealed letter', () => {
    const withTitle = parseInventedBook(bookJson({
      cornerClusters: [
        'a ribbon banner carrying the title',
        'a brass snuffer beside three short candle stubs',
        'a honeycomb fragment with two bees',
        'a coil of cotton wick on a wooden spool',
      ],
    }), OPTS)
    expect(withTitle.ok).toBe(false)

    const withLetter = parseInventedBook(bookJson({
      cornerClusters: [
        'a little owl with a closed letter and a wax seal',
        'a brass snuffer beside three short candle stubs',
        'a honeycomb fragment with two bees',
        'a coil of cotton wick on a wooden spool',
      ],
    }), OPTS)
    expect(withLetter.ok).toBe(true)
  })
})

describe('structural checks', () => {
  it('rejects a non-object', () => {
    expect(parseInventedRoom(null, OPTS).ok).toBe(false)
    expect(parseInventedRoom('a nice room', OPTS).ok).toBe(false)
    expect(parseInventedBook(42, OPTS).ok).toBe(false)
  })

  it('rejects a missing or oversized name', () => {
    expect(parseInventedRoom(roomJson({ name: '' }), OPTS).ok).toBe(false)
    expect(parseInventedRoom(roomJson({ name: 'x'.repeat(61) }), OPTS).ok).toBe(false)
  })

  it('rejects an empty required field', () => {
    const r = parseInventedRoom(roomJson({ lighting: '   ' }), OPTS)
    expect(r.ok).toBe(false)
    expect(r.ok ? '' : r.reason).toMatch(/Lighting/)
  })

  it('requires a ground, even though the spec type allows one to be absent', () => {
    // Optional exists for recipes saved before the field did, not as licence
    // for a fresh invention to skip it and fall back to guesswork.
    const r = parseInventedBook(bookJson({ ground: undefined }), OPTS)
    expect(r.ok).toBe(false)
    expect(r.ok ? '' : r.reason).toMatch(/Ground/)
  })

  it('rejects the wrong number of objects', () => {
    const three = parseInventedRoom(roomJson({ objects: ['a', 'b', 'c'] }), OPTS)
    expect(three.ok ? '' : three.reason).toMatch(/exactly 4/)
  })

  it('rejects a repeated object, however it is punctuated', () => {
    const r = parseInventedRoom(roomJson({
      objects: [
        'a copper wax ladle resting on a tile',
        'A copper wax ladle resting on a tile.',
        'a wick-trimming scissor with a shaped catch',
        'a stoneware jar of beeswax pellets',
      ],
    }), OPTS)
    expect(r.ok ? '' : r.reason).toMatch(/repeats/)
  })

  it('rejects an object list that is not an array of strings', () => {
    expect(parseInventedRoom(roomJson({ objects: 'four things' }), OPTS).ok).toBe(false)
    expect(parseInventedRoom(roomJson({ objects: [1, 2, 3, 4] }), OPTS).ok).toBe(false)
    expect(parseInventedBook(bookJson({ cornerClusters: null }), OPTS).ok).toBe(false)
  })

  it('strips quotes a model wrapped around its own values', () => {
    const r = parseInventedRoom(roomJson({ mood: '"close, industrious, warm"' }), OPTS)
    expect(r.ok && r.spec.mood).toBe('close, industrious, warm')
  })

  it('collapses newlines rather than letting them break the prompt', () => {
    const r = parseInventedRoom(roomJson({ palette: 'cream,\n  soot black,\n  brass' }), OPTS)
    expect(r.ok && r.spec.palette).toBe('cream, soot black, brass')
  })
})

describe('art style resolution', () => {
  it('keeps a style the cell allows', () => {
    const r = parseInventedRoom(roomJson({ artStyle: 'watercolour' }), OPTS)
    expect(r.ok && r.spec.artStyle).toBe('watercolour')
    expect(r.ok && r.adjusted).toEqual([])
  })

  it('replaces one the cell forbids, and says so', () => {
    // futuristic on a period wooden world would honour the style and drop the
    // brief, which reads as the generator ignoring its own dice.
    const r = parseInventedRoom(roomJson({ artStyle: 'futuristic' }), OPTS)
    expect(r.ok && r.spec.artStyle).toBe('ghibli')
    expect(r.ok && r.adjusted[0]).toMatch(/not legal for this cell/)
  })

  it('fills in an absent style', () => {
    const r = parseInventedRoom(roomJson({ artStyle: undefined }), OPTS)
    expect(r.ok && r.spec.artStyle).toBe('ghibli')
  })
})

describe('what comes out the other end', () => {
  it('produces a room spec the real validator accepts', () => {
    const r = parseInventedRoom(roomJson(), { ...OPTS, vector: VECTOR })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(validateRoomSpec(r.spec)).toBeNull()
    expect(r.spec.axes).toEqual(VECTOR)
    expect(r.spec.notes).toBe('')
  })

  it('produces a book spec the real validator accepts', () => {
    const r = parseInventedBook(bookJson(), { ...OPTS, vector: VECTOR })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(validateBookSpec(r.spec)).toBeNull()
    expect(r.spec.axes).toEqual(VECTOR)
  })

  it('deals the four objects across the two sides', () => {
    const r = parseInventedRoom(roomJson(), OPTS)
    expect(r.ok && [...r.spec.leftObjects, ...r.spec.rightObjects]).toEqual(
      roomJson().objects,
    )
  })

  it('leaves the compiled prompt free of the invented vector', () => {
    // axes rides along in the recipe JSONB for the coverage map. If it ever
    // reached the image prompt it would be read as art direction.
    const r = parseInventedRoom(roomJson(), { ...OPTS, vector: VECTOR })
    if (!r.ok) throw new Error(r.reason)
    const prompt = compileRoomPrompt(r.spec)
    expect(prompt).not.toContain('low-key')
    expect(prompt).not.toContain('substrate')
  })

  it('leaves the compiled cover prompt free of it too', () => {
    const r = parseInventedBook(bookJson(), { ...OPTS, vector: VECTOR })
    if (!r.ok) throw new Error(r.reason)
    const prompt = compileCoverPrompt(r.spec)
    expect(prompt).not.toContain('low-key')
    expect(prompt).not.toContain('ornament')
  })
})

describe('extractJson', () => {
  it('parses a clean object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('digs an object out of prose, which a refusal or a stray preface produces', () => {
    expect(extractJson('Sure! Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('returns undefined rather than throwing on nonsense', () => {
    expect(extractJson('I cannot help with that.')).toBeUndefined()
    expect(extractJson('{"a": ')).toBeUndefined()
  })
})
