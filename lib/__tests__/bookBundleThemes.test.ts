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

describe('material is feel, not colour', () => {
  it('never names a colour in any material, cover or page', () => {
    for (const theme of BOOK_THEMES) {
      for (const material of [...theme.coverSurfaces, ...theme.papers]) {
        const found = COLOUR_WORDS.filter(w =>
          new RegExp(`\\b${w}\\b`, 'i').test(material))
        expect(
          found.length ? `${theme.name}: "${material}" names ${found.join(', ')}` : '',
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

describe('the cover is bound, the pages are paper', () => {
  /*
   * The two lists collapsing back into one vocabulary is the failure this
   * guards. It is what happened the first time: the field was called `paper`,
   * so all 24 entries were paper and every cover rendered as a sheet however
   * the theme was written. Adjective variety did not fix it and cannot.
   */
  const BINDINGS = /cloth|buckram|linen|canvas|silk|leather|calf|hide|lacquer|veneer|wood|metal|polymer|composite|laminate|oilcloth|board|vellum|marbled/i

  it('binds every cover in something, and gives each theme a choice', () => {
    for (const theme of BOOK_THEMES) {
      expect(theme.coverSurfaces.length, `${theme.name}`).toBeGreaterThanOrEqual(2)
      for (const s of theme.coverSurfaces) {
        expect(BINDINGS.test(s), `${theme.name}: "${s}" names no binding material`).toBe(true)
      }
    }
  })

  it('never offers the same material for both halves', () => {
    for (const theme of BOOK_THEMES) {
      const overlap = theme.coverSurfaces.filter(s =>
        theme.papers.some(p => p.toLowerCase() === s.toLowerCase()))
      expect(overlap, `${theme.name} reuses a material on both halves`).toEqual([])
    }
  })

  it('does not open most papers with the same two nouns', () => {
    // 14 of 24 used to begin "stock" or "sheet", which read as one material
    // wearing different adjectives.
    const papers = BOOK_THEMES.flatMap(t => t.papers)
    const stocky = papers.filter(p => /\b(stock|sheet)\b/i.test(p)).length
    expect(stocky / papers.length).toBeLessThan(0.35)
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

  it('gives each half its own material, and the cover a flat-swatch guard', () => {
    const cover = compileCoverPrompt(spec)
    const inner = compileInnerPrompt(spec)
    expect(cover).toContain(`Surface: ${spec.coverSurface}.`)
    expect(inner).toContain(`Paper: ${spec.paper}.`)
    // "cloth over board" is an invitation to render a bound object, and the
    // texture has to stay a flat UV map or it fights the GLB.
    expect(cover).toContain('FLAT SWATCH')
    expect(cover).toContain('never as a bound object')
  })

  it('keeps the frame identical across the halves', () => {
    // Colour, palette and frame are what hold the pair together now that the
    // materials deliberately differ.
    expect(compileCoverPrompt(spec)).toContain(`Frame: ${spec.frame}.`)
    expect(compileInnerPrompt(spec)).toContain(`Frame: ${spec.frame}.`)
    expect(compileCoverPrompt(spec)).toContain(`Palette: ${spec.palette}.`)
    expect(compileInnerPrompt(spec)).toContain(`Palette: ${spec.palette}.`)
  })

  it('never tells the cover to stay bright — only the inner page is constrained', () => {
    expect(compileCoverPrompt(spec)).not.toContain('must stay bright')
  })
})

describe('the embossed-cover toggle', () => {
  const base = randomBookSpec(BOOK_THEMES[0], { rng: seeded(77) })

  it('adds weight to the cover when on', () => {
    const cover = compileCoverPrompt({ ...base, coverRelief: true })
    expect(cover).toContain('embossed and slightly raised near the edges')
    expect(cover).toContain('darkening around the outer rim')
  })

  it('says nothing at all when off', () => {
    const cover = compileCoverPrompt({ ...base, coverRelief: false })
    expect(cover).not.toContain('embossed and slightly raised')
    expect(cover).not.toContain('outer rim')
  })

  it('treats an absent flag as off, so old recipes are untouched', () => {
    const { coverRelief, ...withoutFlag } = base
    expect(compileCoverPrompt(withoutFlag)).not.toContain('embossed and slightly raised')
  })

  it('never reaches the inner page, however it is set', () => {
    /*
     * The page has to stay evenly coloured: dark ink prints on it and the
     * layout demands 75% flat blank, so a rim vignette would fight both.
     */
    for (const coverRelief of [true, false]) {
      const inner = compileInnerPrompt({ ...base, coverRelief })
      expect(inner).not.toContain('embossed and slightly raised')
      expect(inner).not.toContain('outer rim')
      expect(inner).toContain('At least 75% of the framed interior must remain completely blank')
    }
  })

  it('keeps the flat-swatch guard even with relief on', () => {
    // "Raised boards" is an invitation to draw an actual book, and this texture
    // is mapped onto a flat page in the GLB.
    const cover = compileCoverPrompt({ ...base, coverRelief: true })
    expect(cover).toContain('no spine')
    expect(cover).toContain('remains a flat swatch seen straight on')
  })

  it('is on for a fresh roll', () => {
    expect(randomBookSpec(BOOK_THEMES[3], { rng: seeded(5) }).coverRelief).toBe(true)
  })
})

describe('a recipe saved before `ground` existed', () => {
  /*
   * Optional on the type for exactly this: challenge_rooms and
   * book_texture_packages store the recipe as JSONB, so every bundle saved
   * before today has no ground. Regenerating one must still produce a sane
   * prompt rather than the literal word "undefined".
   */
  const legacy = {
    ...randomBookSpec(BOOK_THEMES[2], { rng: seeded(9) }),
    ground: undefined,
    coverSurface: undefined,
  }

  it('uses the inner paper for the cover when no cover material was saved', () => {
    // Which reproduces the old look exactly: those recipes had one field doing
    // both jobs, so both halves used the paper.
    expect(compileCoverPrompt(legacy)).toContain(`Surface: ${legacy.paper}.`)
  })

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
