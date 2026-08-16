import { describe, it, expect } from 'vitest'
import {
  PAGE_MARGIN_MM, PAPER_IDS, PAPER_SIZES, isPaperId, pageContentPx,
} from '@/lib/problemSet/paper'
import { catalog } from '@/lib/i18n/catalog'

describe('PAPER_SIZES', () => {
  it('states the standard dimensions', () => {
    expect(PAPER_SIZES.a4).toMatchObject({ widthMm: 210, heightMm: 297 })
    expect(PAPER_SIZES.a5).toMatchObject({ widthMm: 148, heightMm: 210 })
    // 8.5in x 11in and 8.5in x 14in at 25.4mm to the inch.
    expect(PAPER_SIZES.letter.widthMm).toBeCloseTo(8.5 * 25.4, 5)
    expect(PAPER_SIZES.letter.heightMm).toBeCloseTo(11 * 25.4, 5)
    expect(PAPER_SIZES.legal.heightMm).toBeCloseTo(14 * 25.4, 5)
  })

  it('names a paper size the browser understands in @page', () => {
    // The CSS page-size keywords; a typo here silently falls back to the
    // printer default and undoes the whole measurement.
    const keywords = ['A4', 'A5', 'Letter', 'Legal']
    for (const id of PAPER_IDS) expect(keywords).toContain(PAPER_SIZES[id].css)
  })

  it('has a translated label for every size', () => {
    for (const id of PAPER_IDS) {
      const entry = catalog[PAPER_SIZES[id].label]
      expect(entry, `missing message for ${id}`).toBeTruthy()
      expect(entry.en).toBeTruthy()
      expect(entry.zh).toBeTruthy()
    }
  })

  it('recognises its own ids and nothing else', () => {
    for (const id of PAPER_IDS) expect(isPaperId(id)).toBe(true)
    for (const bad of ['A4', 'foolscap', '', null, undefined, 7]) {
      expect(isPaperId(bad)).toBe(false)
    }
  })
})

describe('pageContentPx', () => {
  it('is the page height less both margins, at 96dpi', () => {
    for (const id of PAPER_IDS) {
      const expected = (PAPER_SIZES[id].heightMm - 2 * PAGE_MARGIN_MM) * (96 / 25.4)
      expect(pageContentPx(id)).toBe(Math.round(expected))
    }
  })

  it('separates the sizes, so a change of paper always re-measures', () => {
    const heights = PAPER_IDS.map(pageContentPx)
    expect(new Set(heights).size).toBe(PAPER_IDS.length)
  })

  // The regression this whole setting exists for: Letter is shorter than A4,
  // so a sheet fitted to A4 does not fit Letter.
  it('gives Letter less room than A4', () => {
    expect(pageContentPx('letter')).toBeLessThan(pageContentPx('a4'))
    expect(pageContentPx('a4') - pageContentPx('letter')).toBeGreaterThan(50)
  })
})
