#!/usr/bin/env node
/**
 * Bakes the radio's colourways into finished base-colour textures.
 *
 * ── WHY OFFLINE ─────────────────────────────────────────────
 * The Radio Atelier handoff recolours in a canvas at runtime, because there the
 * student picks arbitrary colours per region. Here they pick from a short list
 * of presets, which are known in advance — so the work belongs at build time.
 * Baking removes, per student per room: a 91 KB regions.json download, seven
 * polygon rasterisations, and seven full-image passes over a 1024x1024 texture.
 * The room then just binds a picture.
 *
 * ── THE ALGORITHM IS NOT OURS TO IMPROVE ────────────────────
 * Ported from `createTintedTexture` in the handoff's app/RadioStudio.tsx,
 * arithmetic intact: the 0.36 / 0.02 luminance guards, the 0.78 contrast
 * factor, the 0.025 / 0.96 clamps, Rec.709 luma. That specific shape is what
 * keeps the frequency lettering, the "Golden Voice" branding, the maker plate
 * and the deep openings at their original pixels while everything around them
 * changes hue. The handoff's AGENTS.md is explicit that a plain material colour
 * multiply is not an acceptable substitute, and it is right: it would recolour
 * the printing too.
 *
 * Usage:
 *   node scripts/bake-radio-palettes.mjs <handoffDir> <outDir> [downscaleFactor]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { decode, encodeRGBA, toRGBA, downscaleRGBA } from './lib/png.mjs'

// ── Colour ──────────────────────────────────────────────────────────────────

export function hexToHsl(hex) {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  if (max === min) return { hue: 0, saturation: 0, lightness }
  const d = max - min
  const saturation = lightness > 0.5 ? d / (2 - max - min) : d / (max + min)
  let hue
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) hue = ((b - r) / d + 2) / 6
  else hue = ((r - g) / d + 4) / 6
  return { hue, saturation, lightness }
}

export function hslToRgb(hue, saturation, lightness) {
  if (saturation === 0) return [lightness, lightness, lightness]
  const hueToRgb = (p, q, t) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
  const p = 2 * lightness - q
  return [hueToRgb(p, q, hue + 1 / 3), hueToRgb(p, q, hue), hueToRgb(p, q, hue - 1 / 3)]
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** Rec.709, matching the handoff exactly — a different luma shifts every guard. */
export const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

/** The handoff's protected-detail rule: printing and deep shadow stay put. */
export const isProtected = (l, protectDetails) =>
  protectDetails && (l > 0.36 || l < 0.02)

// ── UV polygons → mask ──────────────────────────────────────────────────────

/**
 * Scanline fill over the polygon interior.
 *
 * Sampling is at INTEGER pixel coordinates, not at x+0.5. The handoff maps UV
 * with `u * (width - 1)`, which places pixel *centres* on integers rather than
 * texel corners — sampling at half-pixel offsets against that mapping shifts
 * every mask half a pixel, which is enough to leave a seam of original colour
 * down one side of every UV island.
 *
 * The half-open rule in y means a scanline exactly on a polygon's topmost
 * vertex row gets no crossings, so the outermost row of an island can be left
 * out. That is what `dilate` is for — it also makes up the antialiased fringe
 * the canvas version gets for free and counts as inside.
 */
export function fillPolygons(mask, width, height, polygons) {
  for (const polygon of polygons) {
    if (polygon.length < 3) continue
    const pts = polygon.map(([u, v]) => [u * (width - 1), (1 - v) * (height - 1)])
    let minY = Infinity
    let maxY = -Infinity
    for (const [, y] of pts) { if (y < minY) minY = y; if (y > maxY) maxY = y }
    const y0 = Math.max(0, Math.floor(minY))
    const y1 = Math.min(height - 1, Math.ceil(maxY))

    for (let y = y0; y <= y1; y++) {
      const xs = []
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]
        const [xj, yj] = pts[j]
        // Half-open in y so a vertex shared by two edges is not counted twice.
        if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) / (yj - yi)) * (xj - xi))
      }
      if (xs.length < 2) continue
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k]))
        const xb = Math.min(width - 1, Math.floor(xs[k + 1]))
        for (let x = xa; x <= xb; x++) mask[y * width + x] = 1
      }
    }
  }
  return mask
}

/** One-pixel grow, closing the seams the canvas got from antialiasing. */
export function dilate(mask, width, height) {
  const out = Uint8Array.from(mask)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) continue
      const up = y > 0 && mask[(y - 1) * width + x]
      const down = y < height - 1 && mask[(y + 1) * width + x]
      const left = x > 0 && mask[y * width + x - 1]
      const right = x < width - 1 && mask[y * width + x + 1]
      if (up || down || left || right) out[y * width + x] = 1
    }
  }
  return out
}

// ── The recolour ────────────────────────────────────────────────────────────

/**
 * Repaints one region in place.
 *
 * `pristine` is read for luminance while `rgba` is written, so a region's
 * average is never taken from pixels an earlier region already changed. The
 * regions are disjoint in UV space, so it rarely matters — except at the
 * dilated seams, where it is exactly what stops the effect compounding.
 */
export function tintRegion(rgba, pristine, width, height, region, hex) {
  const mask = dilate(
    fillPolygons(new Uint8Array(width * height), width, height, region.uvPolygons),
    width, height,
  )

  let total = 0
  let count = 0
  for (let i = 0; i < width * height; i++) {
    if (!mask[i]) continue
    const o = i * 4
    const l = luma(pristine[o], pristine[o + 1], pristine[o + 2])
    if (isProtected(l, region.protectDetails)) continue
    total += l
    count++
  }
  const average = count ? total / count : 0.4

  const target = hexToHsl(hex)
  let painted = 0
  for (let i = 0; i < width * height; i++) {
    if (!mask[i]) continue
    const o = i * 4
    const l = luma(pristine[o], pristine[o + 1], pristine[o + 2])
    if (isProtected(l, region.protectDetails)) continue
    const lightness = clamp(target.lightness + (l - average) * 0.78, 0.025, 0.96)
    const [r, g, b] = hslToRgb(target.hue, target.saturation, lightness)
    rgba[o] = Math.round(r * 255)
    rgba[o + 1] = Math.round(g * 255)
    rgba[o + 2] = Math.round(b * 255)
    painted++
  }
  return { masked: count, painted }
}

/** Filename-safe id for a preset, e.g. "Original walnut" → "original-walnut". */
export const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function main() {
  const [handoffDir, outDir, factorArg] = process.argv.slice(2)
  if (!handoffDir || !outDir) {
    console.error('usage: node scripts/bake-radio-palettes.mjs <handoffDir> <outDir> [downscaleFactor]')
    process.exit(1)
  }
  const factor = Number(factorArg ?? 2)

  const config = JSON.parse(readFileSync(join(handoffDir, 'public/models/regions.json'), 'utf8'))

  /*
    Baked from the NEUTRAL texture, not the base colour the runtime app names as
    its source — and the result is the same image either way.

    Two reasons. The practical one: every file the handoff calls
    `…-basecolor.png` is actually a JPEG with a .png extension, and this repo has
    a PNG codec and no JPEG decoder. `vintage-radio-neutral.png` is a real PNG.

    The one that makes it correct: the neutral texture is the base colour with
    every recolourable pixel flattened to its own luminance and the protected
    pixels left untouched (build_neutral_texture.py:40-48). The tint below reads
    luminance and discards hue entirely, and luma(L,L,L) === L — so an
    unprotected pixel gives an identical result from either image, and a
    protected one is skipped by both. Equivalent, and decodable.
  */
  const sourcePath = join(handoffDir, 'public/models', config.neutralTexture.split('/').pop())
  const source = decode(readFileSync(sourcePath))
  const { width, height } = source
  const pristine = toRGBA(source)

  mkdirSync(outDir, { recursive: true })
  console.log(`source ${sourcePath}`)
  console.log(`       ${width}x${height}, ${source.channels} channels`)
  console.log(`regions ${config.regions.length}, presets ${config.presets.length}, downscale /${factor}`)

  const manifest = []
  for (const preset of config.presets) {
    const rgba = Buffer.from(pristine)
    for (const region of config.regions) {
      const hex = preset.colors[region.name] ?? region.defaultColor
      tintRegion(rgba, pristine, width, height, region, hex)
    }
    const small = downscaleRGBA(rgba, width, height, factor)
    const id = slug(preset.name)
    const file = `radio-${id}.png`
    const png = encodeRGBA(small.width, small.height, small.rgba)
    writeFileSync(join(outDir, file), png)
    manifest.push({ id, name: preset.name, file, bytes: png.length })
    console.log(`  ${id.padEnd(18)} ${small.width}x${small.height}  ${png.length.toLocaleString()} bytes`)
  }

  const total = manifest.reduce((n, m) => n + m.bytes, 0)
  console.log(`wrote ${manifest.length} palettes, ${total.toLocaleString()} bytes total`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
