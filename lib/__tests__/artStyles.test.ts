import { describe, expect, it } from 'vitest'
import {
  ART_STYLES,
  LEGACY_ROOM_RENDER,
  LEGACY_TEXTURE_RENDER,
  resolveArtStyle,
  roomRenderFor,
  textureRenderFor,
} from '../art-styles'

/**
 * These strings were moved out of app/book-skins/page.tsx, which has no test
 * coverage of its own. Pinning them is the only thing standing between a
 * refactor and a silent change to the prompts that page sends — a regression
 * nobody would notice until a cover came back looking wrong.
 */

describe('ART_STYLES', () => {
  it('keeps all six original styles', () => {
    expect(ART_STYLES.map(s => s.id)).toEqual([
      'realistic', 'ghibli', 'futuristic', 'minimalist', 'vintage', 'watercolour',
    ])
  })

  it('has unique ids', () => {
    expect(new Set(ART_STYLES.map(s => s.id)).size).toBe(ART_STYLES.length)
  })

  it('preserves the cover suffixes verbatim from book-skins', () => {
    const byId = Object.fromEntries(ART_STYLES.map(s => [s.id, s.coverSuffix]))
    expect(byId.realistic).toBe(
      'rendered in a photorealistic style — rich textures, accurate materials, lifelike lighting as if photographed')
    expect(byId.ghibli).toBe(
      'in the style of Studio Ghibli — soft watercolour washes, hand-painted detail, warm nostalgic palette, painterly brushwork, gentle rounded forms')
    expect(byId.minimalist).toBe(
      'in a clean minimalist style — flat bold shapes, limited colour palette of 2-3 colours, strong negative space, geometric precision, no fine detail')
  })

  it('preserves the object styles verbatim from book-skins', () => {
    const byId = Object.fromEntries(ART_STYLES.map(s => [s.id, s.objectStyle]))
    expect(byId.futuristic).toBe(
      'futuristic sci-fi style — glowing neon edges, holographic sheen, chrome and carbon materials, crisp angular forms, cyberpunk atmosphere')
    expect(byId.vintage).toBe(
      'vintage engraving illustration style — aged paper tone, sepia and ochre palette, classic cross-hatching linework, antique woodcut feel')
    expect(byId.watercolour).toBe(
      'loose watercolour illustration — translucent colour washes, soft bleeding edges, visible brushstroke texture, delicate wet-on-wet blending')
  })

  it('gives every style a render line for both surfaces', () => {
    for (const s of ART_STYLES) {
      expect(s.roomRender.trim().length).toBeGreaterThan(20)
      expect(s.textureRender.trim().length).toBeGreaterThan(20)
      expect(s.label.trim()).not.toBe('')
      expect(s.emoji.trim()).not.toBe('')
    }
  })
})

describe('resolving a style', () => {
  it('finds a real one', () => {
    expect(resolveArtStyle('ghibli')?.label).toBe('Ghibli')
  })

  it('never throws on anything a hand-edited recipe might hold', () => {
    // artStyle lives in JSONB and can be absent, blanked, or simply wrong.
    // Each must degrade, because this runs inside a prompt compiler that a
    // route handler is awaiting.
    for (const bad of [undefined, null, '', 'holographic-macrame']) {
      expect(resolveArtStyle(bad as any)).toBeNull()
      expect(roomRenderFor(bad as any)).toBe(LEGACY_ROOM_RENDER)
      expect(textureRenderFor(bad as any)).toBe(LEGACY_TEXTURE_RENDER)
    }
  })

  it('returns the style line when one is set', () => {
    expect(roomRenderFor('futuristic')).toBe(resolveArtStyle('futuristic')!.roomRender)
    expect(roomRenderFor('futuristic')).not.toBe(LEGACY_ROOM_RENDER)
    expect(textureRenderFor('minimalist')).toBe(resolveArtStyle('minimalist')!.textureRender)
  })

  it('keeps the legacy lines distinct from any style', () => {
    // A recipe saved before artStyle existed must reproduce its old look, so
    // the fallback cannot quietly become one of the six.
    expect(ART_STYLES.map(s => s.roomRender)).not.toContain(LEGACY_ROOM_RENDER)
    expect(ART_STYLES.map(s => s.textureRender)).not.toContain(LEGACY_TEXTURE_RENDER)
  })
})
