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

describe('the two halves tint the same stock differently', () => {
  const spec = randomBookSpec(BOOK_THEMES[0], { rng: seeded(4) })

  it('gives the cover the palette deepest tone', () => {
    expect(compileCoverPrompt(spec)).toContain('DEEPEST colour named in the palette')
  })

  it('gives the inner page the lightest, and says why it must stay bright', () => {
    /*
     * Load-bearing, not art direction: Book3DReveal prints the challenge
     * problem over this texture in #2d1a00 and nothing samples the artwork to
     * adapt that ink, so a dark inner page is simply unreadable.
     */
    const inner = compileInnerPrompt(spec)
    expect(inner).toContain('LIGHTEST colour named in the palette')
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
