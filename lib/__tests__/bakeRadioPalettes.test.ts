import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — plain .mjs tooling, no types
import {
  dilate, fillPolygons, hexToHsl, hslToRgb, isProtected, luma, slug, tintRegion,
} from '../../scripts/bake-radio-palettes.mjs'
// @ts-expect-error — plain .mjs tooling, no types
import { decode } from '../../scripts/lib/png.mjs'

/**
 * The recolour is ported from the Radio Atelier handoff, and the part that
 * matters is what it REFUSES to touch: printed lettering, maker marks and deep
 * openings. Those survive on a pair of luminance thresholds, so the thresholds
 * are what these tests pin. Drift there does not throw — it quietly repaints
 * "Golden Voice" in pistachio.
 */

const PALETTES = resolve(process.cwd(), 'public/models/radio-palettes')

/**
 * A full-image square, in UV space.
 *
 * Fixtures are at least 2x2. The handoff maps UV with `u * (size - 1)`, so a
 * 1px axis collapses to `* 0` and every polygon degenerates to a line covering
 * nothing — an artefact of the mapping, not of the fill.
 */
const WHOLE = [[[0, 0], [1, 0], [1, 1], [0, 1]]]

function grey(width: number, height: number, value: number) {
  const buf = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    buf[i * 4] = buf[i * 4 + 1] = buf[i * 4 + 2] = value
    buf[i * 4 + 3] = 255
  }
  return buf
}

/** Pixel i as [r,g,b,a]. */
const px = (buf: Buffer, i: number) => [...buf.subarray(i * 4, i * 4 + 4)]

describe('the protected-detail rule', () => {
  it('keeps the handoff thresholds exactly', () => {
    // 0.36 and 0.02 come from app/RadioStudio.tsx. Nudging either is a visible
    // change to what counts as printing.
    expect(isProtected(0.37, true)).toBe(true)
    expect(isProtected(0.36, true)).toBe(false)
    expect(isProtected(0.019, true)).toBe(true)
    expect(isProtected(0.02, true)).toBe(false)
  })

  it('protects nothing when the region says not to', () => {
    expect(isProtected(0.9, false)).toBe(false)
    expect(isProtected(0.0, false)).toBe(false)
  })

  it('leaves a protected pixel byte-identical', () => {
    // Bright lettering (luma 0.851) and a deep opening (luma 0.004) inside a
    // protected region must come back exactly as they went in.
    const w = 2, h = 2
    const pristine = Buffer.alloc(w * h * 4)
    const set = (i: number, v: number) => {
      pristine[i * 4] = pristine[i * 4 + 1] = pristine[i * 4 + 2] = v
      pristine[i * 4 + 3] = 255
    }
    set(0, 217)  // printing
    set(1, 1)    // deep shadow
    set(2, 80)   // repaintable
    set(3, 60)   // repaintable

    const rgba = Buffer.from(pristine)
    tintRegion(rgba, pristine, w, h, { uvPolygons: WHOLE, protectDetails: true }, '#3366cc')

    expect(px(rgba, 0), 'printing was repainted').toEqual(px(pristine, 0))
    expect(px(rgba, 1), 'deep shadow was repainted').toEqual(px(pristine, 1))
    expect(px(rgba, 2)).not.toEqual(px(pristine, 2))
    expect(px(rgba, 3)).not.toEqual(px(pristine, 3))
  })

  it('repaints everything when protectDetails is off', () => {
    const w = 2, h = 2
    const pristine = grey(w, h, 217)
    const rgba = Buffer.from(pristine)
    tintRegion(rgba, pristine, w, h, { uvPolygons: WHOLE, protectDetails: false }, '#3366cc')
    expect(px(rgba, 0).slice(0, 3)).not.toEqual([217, 217, 217])
  })
})

describe('the tint itself', () => {
  it('takes hue from the target and keeps relative lightness from the source', () => {
    // A brighter source pixel stays the brighter one afterwards. This is what
    // separates a recolour from a flat fill.
    const w = 2, h = 2
    const pristine = Buffer.alloc(w * h * 4)
    const set = (i: number, v: number) => {
      pristine[i * 4] = pristine[i * 4 + 1] = pristine[i * 4 + 2] = v
      pristine[i * 4 + 3] = 255
    }
    set(0, 60); set(1, 140); set(2, 60); set(3, 140)

    const rgba = Buffer.from(pristine)
    tintRegion(rgba, pristine, w, h, { uvPolygons: WHOLE, protectDetails: false }, '#2e7d32')

    const [r0, g0, b0] = px(rgba, 0)
    const [r1, g1, b1] = px(rgba, 1)
    expect(luma(r1, g1, b1)).toBeGreaterThan(luma(r0, g0, b0))
    // …and both moved towards green rather than staying grey.
    expect(g0).toBeGreaterThan(r0)
    expect(g0).toBeGreaterThan(b0)
  })

  it('gives a flat region the target lightness', () => {
    // Every pixel equal means every deviation from the average is 0, so the
    // result should land on the requested lightness.
    const w = 4, h = 4
    const pristine = grey(w, h, 100)
    const rgba = Buffer.from(pristine)
    tintRegion(rgba, pristine, w, h, { uvPolygons: WHOLE, protectDetails: false }, '#804020')
    const target = hexToHsl('#804020')
    const [r, g, b] = hslToRgb(target.hue, target.saturation, target.lightness)
    expect(rgba[0]).toBe(Math.round(r * 255))
    expect(rgba[1]).toBe(Math.round(g * 255))
    expect(rgba[2]).toBe(Math.round(b * 255))
  })

  it('is identical for any colour with the same luminance', () => {
    // Why baking from the neutral texture is equivalent to baking from the base
    // colour: the tint reads luma and throws the source hue away. This is the
    // assumption the whole choice of source image rests on.
    const w = 2, h = 2
    const colour = Buffer.alloc(w * h * 4)
    const flat = Buffer.alloc(w * h * 4)
    const l = Math.round(luma(120, 60, 30) * 255)
    for (let i = 0; i < w * h; i++) {
      colour[i * 4] = 120; colour[i * 4 + 1] = 60; colour[i * 4 + 2] = 30; colour[i * 4 + 3] = 255
      flat[i * 4] = flat[i * 4 + 1] = flat[i * 4 + 2] = l; flat[i * 4 + 3] = 255
    }

    const a = Buffer.from(colour)
    const b = Buffer.from(flat)
    tintRegion(a, colour, w, h, { uvPolygons: WHOLE, protectDetails: false }, '#3366cc')
    tintRegion(b, flat, w, h, { uvPolygons: WHOLE, protectDetails: false }, '#3366cc')
    // Within a step, since the neutral texture rounds luminance to a byte.
    for (let i = 0; i < 3; i++) expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(2)
  })
})

describe('UV rasterisation', () => {
  it('fills a known triangle and leaves the far corner alone', () => {
    const w = 8, h = 8
    // UV v is flipped on the way in, so this covers the TOP-left in pixels.
    const mask = fillPolygons(new Uint8Array(w * h), w, h, [[[0, 1], [1, 1], [0, 0]]])
    expect(mask[0]).toBe(1)                    // top-left
    expect(mask[(h - 1) * w + (w - 1)]).toBe(0) // bottom-right, outside
  })

  it('covers the whole image for a full-UV quad, once dilated', () => {
    // fillPolygons is the interior: the half-open scanline rule drops the row
    // sitting exactly on the topmost vertex, which for a full-image quad is the
    // outermost row. dilate is what closes it, and the two are always used
    // together.
    const w = 6, h = 6
    const interior = fillPolygons(new Uint8Array(w * h), w, h, WHOLE)
    expect(interior.some(v => v === 1), 'filled nothing at all').toBe(true)
    expect(dilate(interior, w, h).every(v => v === 1)).toBe(true)
  })

  it('ignores degenerate polygons instead of throwing', () => {
    const w = 4, h = 4
    expect(() => fillPolygons(new Uint8Array(w * h), w, h, [[[0, 0], [1, 1]]])).not.toThrow()
  })

  it('grows by exactly one pixel when dilating', () => {
    const w = 5, h = 5
    const mask = new Uint8Array(w * h)
    mask[2 * w + 2] = 1
    const grown = dilate(mask, w, h)
    expect(grown[2 * w + 1]).toBe(1)
    expect(grown[1 * w + 2]).toBe(1)
    expect(grown[2 * w + 4]).toBe(0)  // two away, untouched
  })
})

describe('slug', () => {
  it('makes a filename-safe id', () => {
    expect(slug('Original walnut')).toBe('original-walnut')
    expect(slug('Atlantic blue')).toBe('atlantic-blue')
  })
})

describe('the baked palettes on disk', () => {
  it('has all five, RGB, 512px and a sane size', () => {
    expect(existsSync(PALETTES), `${PALETTES} missing — run scripts/bake-radio-palettes.mjs`).toBe(true)
    const files = readdirSync(PALETTES).filter(f => f.endsWith('.png')).sort()
    expect(files).toEqual([
      'radio-atlantic-blue.png', 'radio-bordeaux.png', 'radio-forest-room.png',
      'radio-original-walnut.png', 'radio-pistachio.png',
    ])

    for (const file of files) {
      const png = decode(readFileSync(resolve(PALETTES, file)))
      expect(png.width, file).toBe(512)
      expect(png.height, file).toBe(512)
      // Alpha dropped: a base colour is opaque, and a constant channel is waste.
      expect(png.channels, file).toBe(3)
    }
  })

  it('actually differs between palettes', () => {
    // A bug in the region loop could emit five copies of the same image, and
    // every other assertion here would still pass.
    const walnut = readFileSync(resolve(PALETTES, 'radio-original-walnut.png'))
    const forest = readFileSync(resolve(PALETTES, 'radio-forest-room.png'))
    expect(walnut.equals(forest)).toBe(false)
  })
})
