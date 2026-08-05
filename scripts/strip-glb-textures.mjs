#!/usr/bin/env node
/**
 * Removes embedded images from a GLB, leaving geometry and materials.
 *
 * ── WHY ─────────────────────────────────────────────────────
 * The vintage radio is 275 polygons and 1,729,332 bytes. 1,703,931 of those —
 * 98.5% — are three embedded 1024px images. The geometry, the part we actually
 * need, is about 25 KB.
 *
 * We repaint the base colour anyway: the palettes are baked ahead of time by
 * scripts/bake-radio-palettes.mjs and bound at load, so the embedded copy is
 * never shown. This is the same reasoning that produced the book's
 * `…-notex.glb` — "the unused embedded textures stripped … it is ~4x larger for
 * no visual gain, since every page material's map is replaced at load time"
 * (lib/challengeRoom/model.ts).
 *
 * ── WHAT IS LOST, DELIBERATELY ──────────────────────────────
 * The normal and metallic-roughness maps go too, not just the base colour.
 * On a sill in the middle distance the radio renders around 100-150px wide, so
 * a 1024px normal map is ~10x oversampled and cannot be resolved. Dropping them
 * is a trade, not an oversight: it is what takes 1.73 MiB to ~25 KB rather than
 * ~1.35 MiB. Both maps still exist in the handoff, so this is reversible.
 *
 * Usage:
 *   node scripts/strip-glb-textures.mjs <input.glb> <output.glb>
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const MAGIC = 0x46546c67 // 'glTF'
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942

const pad4 = n => (n + 3) & ~3

export function parseGlb(buffer) {
  if (buffer.readUInt32LE(0) !== MAGIC) throw new Error('not a GLB: bad magic')
  const version = buffer.readUInt32LE(4)
  if (version !== 2) throw new Error(`unsupported GLB version ${version}`)

  let offset = 12
  let json = null
  let bin = null
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset)
    const type = buffer.readUInt32LE(offset + 4)
    const body = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === CHUNK_JSON) json = JSON.parse(body.toString('utf8'))
    else if (type === CHUNK_BIN) bin = body
    offset += 8 + pad4(length)
  }
  if (!json) throw new Error('GLB has no JSON chunk')
  return { json, bin: bin ?? Buffer.alloc(0) }
}

export function buildGlb(json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
  // Both chunks pad to 4 bytes: JSON with spaces, BIN with zeroes. The spec is
  // specific about which, and a viewer that validates will reject the wrong one.
  const jsonPad = Buffer.alloc(pad4(jsonBuf.length) - jsonBuf.length, 0x20)
  const binPad = Buffer.alloc(pad4(bin.length) - bin.length, 0x00)

  const jsonLen = jsonBuf.length + jsonPad.length
  const binLen = bin.length + binPad.length
  const total = 12 + 8 + jsonLen + (binLen ? 8 + binLen : 0)

  const header = Buffer.alloc(12)
  header.writeUInt32LE(MAGIC, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(total, 8)

  const jsonHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(jsonLen, 0)
  jsonHeader.writeUInt32LE(CHUNK_JSON, 4)

  const parts = [header, jsonHeader, jsonBuf, jsonPad]
  if (binLen) {
    const binHeader = Buffer.alloc(8)
    binHeader.writeUInt32LE(binLen, 0)
    binHeader.writeUInt32LE(CHUNK_BIN, 4)
    parts.push(binHeader, bin, binPad)
  }
  return Buffer.concat(parts)
}

/**
 * Drops every image, and every bufferView only images referenced.
 *
 * Renumbering is the fiddly part: removing a bufferView shifts the index of all
 * later ones, and accessors, meshes and the images we keep all point at them by
 * index. Everything therefore goes through `remap`.
 */
export function stripTextures(json, bin) {
  const imageViews = new Set(
    (json.images ?? []).map(img => img.bufferView).filter(v => v != null),
  )

  const keptViews = []
  const remap = new Map()
  ;(json.bufferViews ?? []).forEach((view, index) => {
    if (imageViews.has(index)) return
    remap.set(index, keptViews.length)
    keptViews.push(view)
  })

  // Repack the BIN so the kept views are contiguous. Alignment matters:
  // accessors with a componentType wider than a byte must start on a multiple
  // of their component size, and 4 satisfies every type glTF allows.
  const chunks = []
  let cursor = 0
  const rebuilt = keptViews.map(view => {
    const start = view.byteOffset ?? 0
    const slice = bin.subarray(start, start + view.byteLength)
    const aligned = pad4(cursor)
    if (aligned > cursor) { chunks.push(Buffer.alloc(aligned - cursor)); cursor = aligned }
    chunks.push(slice)
    const next = { ...view, byteOffset: cursor }
    cursor += view.byteLength
    return next
  })

  const out = { ...json, bufferViews: rebuilt }
  delete out.images
  delete out.textures
  delete out.samplers

  ;(out.accessors ?? []).forEach(a => {
    if (a.bufferView != null) a.bufferView = remap.get(a.bufferView)
  })

  // Materials keep their names and factors — only the map references go, since
  // the images they point at no longer exist.
  out.materials = (out.materials ?? []).map(material => {
    const next = { ...material }
    delete next.normalTexture
    delete next.occlusionTexture
    delete next.emissiveTexture
    if (next.pbrMetallicRoughness) {
      const pbr = { ...next.pbrMetallicRoughness }
      delete pbr.baseColorTexture
      delete pbr.metallicRoughnessTexture
      next.pbrMetallicRoughness = pbr
    }
    return next
  })

  const newBin = Buffer.concat(chunks)
  if (out.buffers?.length) out.buffers[0] = { ...out.buffers[0], byteLength: newBin.length }

  return { json: out, bin: newBin }
}

function main() {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) {
    console.error('usage: node scripts/strip-glb-textures.mjs <input.glb> <output.glb>')
    process.exit(1)
  }

  const before = readFileSync(input)
  const { json, bin } = parseGlb(before)
  const imageBytes = (json.images ?? []).reduce(
    (sum, img) => sum + (img.bufferView != null ? json.bufferViews[img.bufferView].byteLength : 0),
    0,
  )

  const stripped = stripTextures(json, bin)
  const after = buildGlb(stripped.json, stripped.bin)
  writeFileSync(output, after)

  const pct = (100 * (1 - after.length / before.length)).toFixed(1)
  console.log(`in   ${input}`)
  console.log(`     ${before.length.toLocaleString()} bytes`)
  console.log(`     ${(json.images ?? []).length} embedded images, ${imageBytes.toLocaleString()} bytes`)
  console.log(`     materials: ${(json.materials ?? []).map(m => m.name).join(', ')}`)
  console.log(`out  ${output}`)
  console.log(`     ${after.length.toLocaleString()} bytes  (-${pct}%)`)
  console.log(`     materials: ${(stripped.json.materials ?? []).map(m => m.name).join(', ')}`)
}

/*
  Only run as a CLI; the exports above are imported by the tests.

  pathToFileURL rather than string-building a file:// URL — on Windows the
  latter gives file://C:/… against Node's file:///C:/… and the guard silently
  never fires, so the script does nothing and says nothing about it.
*/
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
