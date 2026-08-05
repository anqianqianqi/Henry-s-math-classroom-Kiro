import { describe, expect, it } from 'vitest'
import { BOOK_THEMES, randomBookSpec } from '../challengeRoom/bookThemes'
import { compileCoverPrompt, compileInnerPrompt } from '../challengeRoom/bookPrompt'

/**
 * Paper names FEEL; the palette names colour.
 *
 * This split is the whole reason covers stopped coming out pale, and it is the
 * kind that rots quietly: one plausible-sounding "warm ivory laid paper" added
 * to a theme takes the ground back from the palette, and nothing breaks — the
 * bundle just renders the colour of the paper again, months later, with no
 * error anywhere.
 */

function seeded(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/*
 * Words that name or strongly imply a colour.
 *
 * Deliberately includes material names that are really colour words in
 * disguise — "bone", "straw", "charcoal" and "tea-toned" all described a hue
 * rather than a texture in the version of this list that caused the problem.
 */
const COLOUR_WORDS = [
  'ivory', 'cream', 'creamy', 'bone', 'chalk', 'chalky', 'white', 'black',
  'oat', 'buff', 'straw', 'parchment', 'charcoal', 'grey', 'gray', 'ochre',
  'sepia', 'indigo', 'gold', 'golden', 'silver', 'brass', 'pewter', 'copper',
  'red', 'green', 'blue', 'amber', 'plum', 'rose', 'sage', 'olive', 'russet',
  'tan', 'toned', 'tinted', 'pale', 'dark', 'light-coloured', 'coloured',
]

describe('paper is feel, not colour', () => {
  it('never names a colour in any paper stock', () => {
    for (const theme of BOOK_THEMES) {
      for (const paper of theme.papers) {
        const found = COLOUR_WORDS.filter(w =>
          new RegExp(`\\b${w}\\b`, 'i').test(paper))
        expect(
          found.length ? `${theme.name}: "${paper}" names ${found.join(', ')}` : '',
        ).toBe('')
      }
    }
  })

  it('still describes something tactile', () => {
    // A stock stripped of colour but not given texture is worse than either:
    // the image model is told nothing at all and falls back to plain white.
    const tactile = new RegExp(
      [
        'tooth', 'grain', 'deckle', 'fibre', 'weave', 'pulp', 'laid', 'chain',
        'ribbed', 'satin', 'sheen', 'matte', 'smooth', 'coarse', 'rough',
        'cockled', 'calendered', 'hot-press', 'cold-press', 'absorbent',
        'embossed', 'corrugat', 'drag', 'silky', 'bloom', 'flecks', 'strands',
        'surface', 'finish', 'card', 'board', 'sized', 'furred', 'translucent',
      ].join('|'),
      'i',
    )
    for (const theme of BOOK_THEMES) {
      for (const paper of theme.papers) {
        expect(tactile.test(paper), `${theme.name}: "${paper}" describes no texture`).toBe(true)
      }
    }
  })
})

describe('one colour, two values', () => {
  const spec = randomBookSpec(BOOK_THEMES[0], { rng: seeded(4) })

  it('gives every theme a ground to draw from', () => {
    for (const theme of BOOK_THEMES) {
      expect(theme.grounds.length, `${theme.name} has no grounds`).toBeGreaterThanOrEqual(2)
      for (const g of theme.grounds) expect(g.trim()).not.toBe('')
    }
  })

  it('puts the SAME colour name on both halves', () => {
    // The whole point of one field: the pair reads as one book rather than two
    // that happen to share a recipe.
    expect(spec.ground).toBeTruthy()
    expect(compileCoverPrompt(spec)).toContain(spec.ground!)
    expect(compileInnerPrompt(spec)).toContain(spec.ground!)
  })

  it('takes it at full strength on the cover', () => {
    const cover = compileCoverPrompt(spec)
    expect(cover).toContain(`evenly to ${spec.ground}`)
    expect(cover).not.toContain('PALE, WASHED-OUT TINT')
  })

  it('takes a pale tint of it on the inner page, and says why', () => {
    /*
     * Load-bearing, not art direction: Book3DReveal prints the challenge
     * problem over this texture in #2d1a00 and nothing samples the artwork to
     * adapt that ink, so a mid-tone inner page is simply unreadable.
     */
    const inner = compileInnerPrompt(spec)
    expect(inner).toContain('PALE, WASHED-OUT TINT')
    expect(inner).toContain('the same hue as the cover')
    expect(inner).toContain('The page must stay bright')
    expect(inner).toContain('At least 75% of the framed interior must remain completely blank')
  })

  it('states the same paper in both halves, so the pair still matches', () => {
    expect(compileCoverPrompt(spec)).toContain(`Paper: ${spec.paper}.`)
    expect(compileInnerPrompt(spec)).toContain(`Paper: ${spec.paper}.`)
  })

  it('never tells the cover to stay bright — only the inner page is constrained', () => {
    expect(compileCoverPrompt(spec)).not.toContain('must stay bright')
  })
})

describe('a recipe saved before `ground` existed', () => {
  /*
   * Optional on the type for exactly this: challenge_rooms and
   * book_texture_packages store the recipe as JSONB, so every bundle saved
   * before today has no ground. Regenerating one must still produce a sane
   * prompt rather than the literal word "undefined".
   */
  const legacy = { ...randomBookSpec(BOOK_THEMES[2], { rng: seeded(9) }), ground: undefined }

  it('falls back to the palette rather than emitting undefined', () => {
    for (const prompt of [compileCoverPrompt(legacy), compileInnerPrompt(legacy)]) {
      expect(prompt).not.toContain('undefined')
      expect(prompt).toContain('the deepest colour named in the palette')
    }
  })

  it('still keeps the inner page bright', () => {
    expect(compileInnerPrompt(legacy)).toContain('PALE, WASHED-OUT TINT')
    expect(compileInnerPrompt(legacy)).toContain('The page must stay bright')
  })
})
