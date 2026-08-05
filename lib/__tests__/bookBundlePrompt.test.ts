import { describe, expect, it } from 'vitest'
import { compileCoverPrompt, compileInnerPrompt, validateBookSpec } from '../challengeRoom/bookPrompt'
import { ART_STYLES, LEGACY_TEXTURE_RENDER, resolveArtStyle } from '../art-styles'
import type { BookSpec } from '../types/challengeRoom'

/** A recipe as saved before artStyle and innerAccent existed. */
const LEGACY: BookSpec = {
  name: 'Pastel Meadow Tales',
  mood: 'tender, cheerful, nostalgic',
  palette: 'warm ivory, blush pink, strawberry red, meadow green, soft cornflower blue',
  paper: 'warm ivory watercolor paper with gentle handmade grain',
  frame: 'thin antique-gold botanical filigree',
  cornerClusters: [
    'a tabby cat with a yarn ball and a small open book',
    'strawberries with a polka-dot teacup and one biscuit',
    'a ladybug on an oak leaf with an acorn cap and berries',
    'a four-leaf clover with dewdrops and a small golden beetle',
  ],
  notes: '',
}

/** A theme the old hard-coded prompt could not have expressed at all. */
const SCI_FI: BookSpec = {
  ...LEGACY,
  name: 'Orbital Survey Ledger',
  palette: 'vacuum black, instrument cyan, bone white, warning amber',
  paper: 'smooth matte composite sheet with a faint hexagonal weave',
  frame: 'hairline cyan circuit-trace border with small node dots',
  artStyle: 'futuristic',
}

describe('the inner page stays printable', () => {
  it('keeps the blank rule for every theme and style', () => {
    // lib/challengeRoom/pageTexture.ts prints the challenge problem into that
    // area. Losing this rule does not break the build — it produces books the
    // text is unreadable on.
    for (const style of [undefined, ...ART_STYLES.map(s => s.id)]) {
      for (const spec of [LEGACY, SCI_FI]) {
        expect(compileInnerPrompt({ ...spec, artStyle: style })).toContain(
          'At least 75% of the framed interior must remain completely blank')
      }
    }
  })

  it('keeps the centre empty and quiet', () => {
    expect(compileInnerPrompt(LEGACY)).toContain('Keep the entire center empty and quiet.')
    expect(compileInnerPrompt(LEGACY)).toContain("Do not include any of the cover's four object clusters")
  })
})

describe('the flat-texture contract', () => {
  it('survives in both halves', () => {
    // These are UV textures mapped onto the GLB. Any perspective, spine or drop
    // shadow baked in would fight the 3D geometry.
    for (const prompt of [compileCoverPrompt(SCI_FI), compileInnerPrompt(SCI_FI)]) {
      expect(prompt).toContain('Exact 3:4 portrait canvas, shown perfectly flat and orthographic')
      expect(prompt).toContain('No book mockup, no perspective, no spine, no page block, no drop shadow')
      expect(prompt).toContain('approximately 2% inward from every edge')
      expect(prompt).toContain('Keep the frame close to the canvas edges')
    }
  })
})

describe('the prompt no longer contradicts its own spec', () => {
  it('drops the ivory and antique-gold overrides', () => {
    // This is the bug, stated as a test: the prompt used to declare the theme's
    // paper and frame and then override both a few lines later.
    for (const prompt of [compileCoverPrompt(SCI_FI), compileInnerPrompt(SCI_FI)]) {
      expect(prompt).not.toContain('warm-ivory')
      expect(prompt).not.toContain('antique-gold')
      expect(prompt).toContain('smooth matte composite sheet with a faint hexagonal weave')
      expect(prompt).toContain('hairline cyan circuit-trace border with small node dots')
    }
  })

  it('no longer forces watercolour on a style that is not watercolour', () => {
    const prompt = compileCoverPrompt(SCI_FI)
    expect(prompt).toContain(resolveArtStyle('futuristic')!.textureRender)
    expect(prompt).not.toContain(LEGACY_TEXTURE_RENDER)
    // The cluster line used to say "watercolor vignette clusters" too.
    expect(prompt).toContain('Four small vignette clusters')
  })

  it('states the frame in both halves, which is what now holds the pair together', () => {
    /*
     * The halves used to share one `paper`. They no longer do: a bound book has
     * cloth or hide on the boards and paper inside, so each half names its own
     * material and the pair matches on frame, palette and ground instead.
     *
     * SCI_FI predates coverSurface, so its cover falls back to `paper` — which
     * is exactly the old behaviour, and the next test pins it.
     */
    for (const prompt of [compileCoverPrompt(SCI_FI), compileInnerPrompt(SCI_FI)]) {
      expect(prompt).toContain(`Frame: ${SCI_FI.frame}.`)
      expect(prompt).toContain(`Palette: ${SCI_FI.palette}.`)
    }
    expect(compileCoverPrompt(SCI_FI)).toContain(`Surface: ${SCI_FI.paper}.`)
    expect(compileInnerPrompt(SCI_FI)).toContain(`Paper: ${SCI_FI.paper}.`)
  })

  it('lets a cover name a material the inner page never could', () => {
    const bound = { ...SCI_FI, coverSurface: 'anodised metal panel with a fine directional brush' }
    expect(compileCoverPrompt(bound)).toContain('Surface: anodised metal panel with a fine directional brush.')
    // The page stays paper regardless of what the boards are bound in.
    expect(compileInnerPrompt(bound)).toContain(`Paper: ${SCI_FI.paper}.`)
    expect(compileInnerPrompt(bound)).not.toContain('anodised metal')
  })
})

describe('a recipe saved before the new fields existed', () => {
  it('still validates', () => {
    expect(validateBookSpec(LEGACY)).toBeNull()
  })

  it('still gets the old style line and the old inner accent', () => {
    expect(compileCoverPrompt(LEGACY)).toContain(LEGACY_TEXTURE_RENDER)
    expect(compileInnerPrompt(LEGACY)).toContain(
      'a few leaves, meadow stems, pinhead blossoms, or subtle theme motifs')
  })

  it('still reads as ivory and gold, because its own spec says so', () => {
    // Meaning is preserved without the override: every legacy paper is an
    // ivory watercolour stock and every legacy frame is antique-gold.
    const prompt = compileCoverPrompt(LEGACY)
    expect(prompt).toContain('warm ivory watercolor paper with gentle handmade grain')
    expect(prompt).toContain('thin antique-gold botanical filigree')
  })
})

describe('innerAccent', () => {
  it('is used when the theme names one', () => {
    const prompt = compileInnerPrompt({
      ...SCI_FI, innerAccent: 'two faint orbital arcs and a scatter of pinhead stars',
    })
    expect(prompt).toContain('two faint orbital arcs and a scatter of pinhead stars')
    expect(prompt).not.toContain('meadow stems')
  })
})
