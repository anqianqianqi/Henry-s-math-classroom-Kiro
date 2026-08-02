/**
 * A minimal PNG codec, written against zlib alone.
 *
 * The project has no image libraries and two scripts now need to read and write
 * pixels — png-to-alpha (the sketch frame) and bake-radio-palettes (the radio
 * colourways). One codec rather than two copies; still not enough reason to add
 * a dependency.
 *
 * Supports what the assets in this repo actually are: 8-bit, non-interlaced,
 * greyscale / RGB / greyscale+alpha / RGBA. It throws clearly on anything else
 * rather than silently producing wrong pixels.
 */

import { inflateSync, deflateSync } from 'zlib'

const CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

export function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

export function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** @returns {{width:number,height:number,channels:number,pixels:Buffer}} */
export function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  let pos = 8
  let ihdr = null
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0), height: data.readUInt32BE(4),
        bitDepth: data[8], colorType: data[9], interlace: data[12],
      }
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  if (!ihdr) throw new Error('no IHDR')
  if (ihdr.bitDepth !== 8) throw new Error(`bit depth ${ihdr.bitDepth} unsupported — need 8`)
  if (ihdr.interlace) throw new Error('interlaced PNG unsupported')

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.colorType]
  if (!channels) throw new Error(`colour type ${ihdr.colorType} unsupported`)

  const raw = inflateSync(Buffer.concat(idat))
  const stride = ihdr.width * channels
  const out = Buffer.alloc(ihdr.height * stride)

  // Undo the per-row filters. Each row is prefixed with its filter byte.
  let rp = 0
  for (let y = 0; y < ihdr.height; y++) {
    const filter = raw[rp++]
    const row = raw.subarray(rp, rp + stride); rp += stride
    const cur = out.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= channels ? prev[x - channels] : 0
      let v = row[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      cur[x] = v & 0xff
    }
  }
  return { ...ihdr, channels, pixels: out }
}

/**
 * Picks a row filter with the PNG spec's minimum-sum-of-absolute-differences
 * heuristic, trying all five.
 *
 * Filter 0 for every row is fine for flat graphics — the sketch frame is mostly
 * one value — and terrible for photographic texture, where neighbouring pixels
 * differ slightly everywhere and deflate finds nothing to repeat. On the radio's
 * base colour this is the difference between ~308 KB and ~150 KB for the same
 * image.
 */
function filterRow(cur, prev, stride, bpp) {
  const candidates = []
  for (let type = 0; type < 5; type++) {
    const out = Buffer.alloc(stride)
    let score = 0
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= bpp ? prev[x - bpp] : 0
      let v
      if (type === 0) v = cur[x]
      else if (type === 1) v = cur[x] - a
      else if (type === 2) v = cur[x] - b
      else if (type === 3) v = cur[x] - ((a + b) >> 1)
      else {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v = cur[x] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      }
      out[x] = v & 0xff
      // Signed magnitude: the heuristic wants values near zero either way.
      score += out[x] < 128 ? out[x] : 256 - out[x]
    }
    candidates.push({ type, out, score })
  }
  return candidates.reduce((best, c) => (c.score < best.score ? c : best))
}

function rawWithAdaptiveFilters(pixels, width, height, bpp) {
  const stride = width * bpp
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    const cur = pixels.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null
    const { type, out } = filterRow(cur, prev, stride, bpp)
    raw[y * (stride + 1)] = type
    out.copy(raw, y * (stride + 1) + 1)
  }
  return raw
}

function rawUnfiltered(pixels, width, height, bpp) {
  const stride = width * bpp
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return raw
}

/** True when nothing in the image is even slightly transparent. */
function fullyOpaque(rgba) {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) return false
  return true
}

/**
 * Encodes both ways and keeps whichever deflates smaller.
 *
 * The spec's filter heuristic minimises the sum of absolute differences, which
 * is a proxy for compressibility and not always a good one — measured on the
 * radio's base colour it chose filters that came out 8% LARGER than leaving
 * every row unfiltered. Rather than guess which content is which, do both. This
 * runs in a build script a handful of times, so the second pass costs nothing
 * that matters.
 */
export function encodeRGBA(width, height, rgba) {
  /*
    Drops the alpha channel when there is nothing in it — a base-colour texture
    is opaque everywhere, and storing a constant 255 per pixel is a quarter of
    the file spent saying "yes, visible". Masks keep theirs, since for them the
    alpha IS the picture.
  */
  const opaque = fullyOpaque(rgba)
  const bpp = opaque ? 3 : 4
  let pixels = rgba
  if (opaque) {
    pixels = Buffer.alloc(width * height * 3)
    for (let i = 0, o = 0; i < rgba.length; i += 4, o += 3) {
      pixels[o] = rgba[i]; pixels[o + 1] = rgba[i + 1]; pixels[o + 2] = rgba[i + 2]
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = opaque ? 2 : 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const candidates = [
    rawUnfiltered(pixels, width, height, bpp),
    rawWithAdaptiveFilters(pixels, width, height, bpp),
  ].map(raw => deflateSync(raw, { level: 9 }))
  const idat = candidates.reduce((a, b) => (a.length <= b.length ? a : b))

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Widens any supported source to straight RGBA, for uniform pixel work. */
export function toRGBA({ width, height, channels, pixels }) {
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const s = i * channels
    const d = i * 4
    if (channels === 1) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = pixels[s]; rgba[d + 3] = 255
    } else if (channels === 2) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = pixels[s]; rgba[d + 3] = pixels[s + 1]
    } else if (channels === 3) {
      rgba[d] = pixels[s]; rgba[d + 1] = pixels[s + 1]; rgba[d + 2] = pixels[s + 2]; rgba[d + 3] = 255
    } else {
      rgba[d] = pixels[s]; rgba[d + 1] = pixels[s + 1]
      rgba[d + 2] = pixels[s + 2]; rgba[d + 3] = pixels[s + 3]
    }
  }
  return rgba
}

/**
 * Box-filter downscale by an integer factor.
 *
 * Averaging every source pixel in the block, not nearest-neighbour: a texture
 * carrying fine printed lettering aliases badly under point sampling, and the
 * lettering is the thing the recolour works hardest to preserve.
 */
export function downscaleRGBA(rgba, width, height, factor) {
  if (factor <= 1) return { rgba, width, height }
  const w = Math.floor(width / factor)
  const h = Math.floor(height / factor)
  const out = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const s = ((y * factor + dy) * width + (x * factor + dx)) * 4
          r += rgba[s]; g += rgba[s + 1]; b += rgba[s + 2]; a += rgba[s + 3]; n++
        }
      }
      const d = (y * w + x) * 4
      out[d] = Math.round(r / n); out[d + 1] = Math.round(g / n)
      out[d + 2] = Math.round(b / n); out[d + 3] = Math.round(a / n)
    }
  }
  return { rgba: out, width: w, height: h }
}
