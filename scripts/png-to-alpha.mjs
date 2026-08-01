/**
 * Turn a dark-on-light drawing into a proper alpha mask.
 *
 * The frame is drawn as black strokes on white. Used directly as a CSS mask
 * that is backwards — masks read alpha, and a white background is fully opaque,
 * so the whole rectangle would show. Used with mix-blend-mode: multiply it
 * works, but then the ink colour is whatever the artwork is and cannot be
 * tuned, and it disappears entirely over dark artwork.
 *
 * So: convert once. Luminance becomes alpha (black → opaque, white → clear),
 * colour is thrown away, and the result is a mask that can be filled with any
 * colour at runtime.
 *
 * Written against zlib alone because the project has no image libraries and
 * this does not justify adding one.
 *
 * Usage: node png-to-alpha.mjs <in.png> <out.png> [gamma]
 *        gamma > 1 thins the strokes, < 1 thickens them. Default 1.
 */

import { readFileSync, writeFileSync } from 'fs'
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

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function decode(buf) {
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

function encodeRGBA(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0                                  // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const [, , inPath, outPath, whiteArg, blackArg, gammaArg] = process.argv
if (!inPath || !outPath) {
  console.error('usage: node png-to-alpha.mjs <in.png> <out.png> [white] [black] [gamma]')
  process.exit(1)
}

/*
  Keying on COLOUR DISTANCE from the background, not on luminance.

  Luminance cannot do this job. The frame that prompted it came back on a green
  screen — background (41,248,7), whose luminance is 159, sitting right in the
  middle of the range. No white point separates that from a mid-grey stroke,
  and every threshold produced 100% coverage: a solid block rather than a frame.

  Distance in RGB from the background handles green, white, black or anything
  else without being told which, so this stays correct whatever the next export
  looks like. The reference is sampled at the centre, which for a frame is
  guaranteed to be empty background.
*/
const lo = Number(whiteArg ?? 30)    // below this distance: background
const hi = Number(blackArg ?? 150)   // above this distance: solid ink
const gamma = Number(gammaArg ?? 1)

const img = decode(readFileSync(inPath))
const { width, height, channels, pixels } = img

if (process.env.PROBE) {
  // Trust nothing about the decode until the numbers look like a drawing:
  // a sparse frame should be overwhelmingly paper, with a thin dark tail.
  const hist = new Array(16).fill(0)
  const lumAt = (x, y) => {
    const p = (y * width + x) * channels
    return channels <= 2 ? pixels[p]
      : (pixels[p] * 299 + pixels[p + 1] * 587 + pixels[p + 2] * 114) / 1000
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) hist[Math.min(15, lumAt(x, y) >> 4)]++
  }
  const total = width * height
  console.log('luminance histogram (bucket = 16 levels):')
  hist.forEach((n, i) => {
    if (n === 0) return
    console.log(`  ${String(i * 16).padStart(3)}-${String(i * 16 + 15).padStart(3)}  ` +
      `${(n / total * 100).toFixed(2).padStart(6)}%  ${'#'.repeat(Math.round(n / total * 60))}`)
  })
  console.log('samples — centre:', lumAt(width >> 1, height >> 1).toFixed(0),
    ' corner(4,4):', lumAt(4, 4).toFixed(0),
    ' mid-top(w/2,6):', lumAt(width >> 1, 6).toFixed(0))
  process.exit(0)
}
const rgba = Buffer.alloc(width * height * 4)

let opaque = 0
let srcHadAlpha = channels === 2 || channels === 4

/** Read a pixel as RGB + alpha, whatever the source colour type. */
function rgbaAt(i) {
  const p = i * channels
  if (channels === 1) return [pixels[p], pixels[p], pixels[p], 255]
  if (channels === 2) return [pixels[p], pixels[p], pixels[p], pixels[p + 1]]
  if (channels === 3) return [pixels[p], pixels[p + 1], pixels[p + 2], 255]
  return [pixels[p], pixels[p + 1], pixels[p + 2], pixels[p + 3]]
}

// Sampled at the centre: for a frame that is guaranteed to be empty backdrop.
const [bgR, bgG, bgB] = rgbaAt((height >> 1) * width + (width >> 1))
console.log(`background keyed from centre pixel: rgb(${bgR}, ${bgG}, ${bgB})`)

for (let i = 0, n = width * height; i < n; i++) {
  const [r, g, b, srcA] = rgbaAt(i)
  const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2)

  // Far from the background is ink; near it is nothing. Anti-aliased stroke
  // edges land in between and keep their softness. Any alpha already in the
  // source is respected, so a genuinely transparent file also works.
  let a = (dist - lo) / (hi - lo)
  a = Math.max(0, Math.min(1, a)) * (srcA / 255)
  if (gamma !== 1) a = Math.pow(a, gamma)
  const alpha = Math.round(a * 255)

  const o = i * 4
  rgba[o] = 0; rgba[o + 1] = 0; rgba[o + 2] = 0; rgba[o + 3] = alpha
  if (alpha > 12) opaque++
}

writeFileSync(outPath, encodeRGBA(width, height, rgba))

const pct = (opaque / (width * height) * 100).toFixed(1)
console.log(`${width} x ${height}  (${(width / height).toFixed(3)} aspect)`)
console.log(`source: ${channels} channels, alpha in source: ${srcHadAlpha}`)
console.log(`ink coverage: ${pct}% of pixels — expect roughly 1-6% for a sparse frame`)
console.log(`wrote ${outPath}`)
