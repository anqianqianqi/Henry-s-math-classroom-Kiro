import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — plain .mjs tooling, no types, imported for its exports only
import { buildGlb, parseGlb, stripTextures } from '../../scripts/strip-glb-textures.mjs'

/**
 * Stripping a GLB means renumbering every bufferView index in the file. Get
 * that wrong and the model still "loads" while pointing at the wrong bytes —
 * garbled geometry rather than an error. These tests check the indices, not
 * just that nothing threw.
 */

const MODEL = resolve(process.cwd(), 'public/models/vintage-radio-notex.glb')

/** A minimal GLB with two data views and one image view between them. */
function fixture() {
  const bin = Buffer.concat([
    Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]),        // bv0 — kept
    Buffer.from([9, 9, 9, 9]),                     // bv1 — image, dropped
    Buffer.from([10, 11, 12, 13]),                 // bv2 — kept
  ])
  const json = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 8 },
      { buffer: 0, byteOffset: 8, byteLength: 4 },
      { buffer: 0, byteOffset: 12, byteLength: 4 },
    ],
    images: [{ bufferView: 1, mimeType: 'image/png' }],
    textures: [{ source: 0 }],
    samplers: [{}],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 2, type: 'VEC1' },
      { bufferView: 2, componentType: 5126, count: 1, type: 'VEC1' },
    ],
    materials: [{
      name: 'region_cabinet',
      pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0 },
      normalTexture: { index: 0 },
    }],
  }
  return { json, bin }
}

describe('stripTextures', () => {
  it('renumbers accessors onto the surviving bufferViews', () => {
    // bv2 becomes bv1 once the image view in the middle is removed. An accessor
    // left pointing at 2 would read past the end; left at 0 it would read the
    // wrong attribute and silently render nonsense.
    const { json, bin } = fixture()
    const out = stripTextures(json, bin)
    expect(out.json.bufferViews).toHaveLength(2)
    expect(out.json.accessors[0].bufferView).toBe(0)
    expect(out.json.accessors[1].bufferView).toBe(1)
  })

  it('keeps the surviving bytes, in order, and drops only the image', () => {
    const { json, bin } = fixture()
    const out = stripTextures(json, bin)
    const first = out.json.bufferViews[0]
    const second = out.json.bufferViews[1]
    expect([...out.bin.subarray(first.byteOffset, first.byteOffset + first.byteLength)])
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...out.bin.subarray(second.byteOffset, second.byteOffset + second.byteLength)])
      .toEqual([10, 11, 12, 13])
    expect(out.bin).not.toContain(9)
  })

  it('drops images, textures and samplers but keeps material names', () => {
    const { json, bin } = fixture()
    const out = stripTextures(json, bin)
    expect(out.json.images).toBeUndefined()
    expect(out.json.textures).toBeUndefined()
    expect(out.json.samplers).toBeUndefined()
    expect(out.json.materials[0].name).toBe('region_cabinet')
    expect(out.json.materials[0].pbrMetallicRoughness.baseColorTexture).toBeUndefined()
    expect(out.json.materials[0].pbrMetallicRoughness.metallicFactor).toBe(0)
    expect(out.json.materials[0].normalTexture).toBeUndefined()
  })

  it('reports the buffer length it actually wrote', () => {
    const { json, bin } = fixture()
    const out = stripTextures(json, bin)
    expect(out.json.buffers[0].byteLength).toBe(out.bin.length)
  })

  it('round-trips through buildGlb/parseGlb', () => {
    const { json, bin } = fixture()
    const out = stripTextures(json, bin)
    const reparsed = parseGlb(buildGlb(out.json, out.bin))
    expect(reparsed.json.bufferViews).toHaveLength(2)
    expect(reparsed.bin.length).toBeGreaterThanOrEqual(out.bin.length)
  })

  it('pads both chunks to 4 bytes, as the container requires', () => {
    const { json, bin } = fixture()
    const out = stripTextures(json, bin)
    const glb = buildGlb(out.json, out.bin)
    expect(glb.length % 4).toBe(0)
    expect(glb.readUInt32LE(8)).toBe(glb.length) // header total matches reality
  })
})

describe('the shipped radio model', () => {
  it('is stripped, parses, and keeps all seven regions', () => {
    // Guards the committed artifact, not just the transform: a re-run of the
    // script that produced a broken file would fail here.
    expect(existsSync(MODEL), `${MODEL} missing — run scripts/strip-glb-textures.mjs`).toBe(true)
    const buf = readFileSync(MODEL)
    const { json } = parseGlb(buf)

    expect(json.images).toBeUndefined()
    expect(buf.length).toBeLessThan(60_000)   // was 1,729,332
    expect(json.materials.map((m: any) => m.name)).toEqual([
      'region_cabinet', 'region_front_panel', 'region_speaker_grille',
      'region_dial_face', 'region_knobs', 'region_metal_trim', 'region_back_and_feet',
    ])

    // Every accessor still addresses a real view, fully inside the buffer.
    for (const a of json.accessors) {
      if (a.bufferView == null) continue
      const view = json.bufferViews[a.bufferView]
      expect(view, `accessor points at missing bufferView ${a.bufferView}`).toBeDefined()
      expect(view.byteOffset + view.byteLength).toBeLessThanOrEqual(json.buffers[0].byteLength)
    }
  })

  it('loads through the real GLTFLoader with geometry intact', async () => {
    // Structural checks above prove the indices line up; this proves three.js
    // agrees. A renumbering bug can leave a file that parses as JSON and then
    // renders as garbage, and only the loader would notice.
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const buf = readFileSync(MODEL)
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer

    const gltf: any = await new Promise((res, rej) =>
      new GLTFLoader().parse(ab, '', res as any, rej),
    )

    const meshes: any[] = []
    gltf.scene.traverse((o: any) => { if (o.isMesh) meshes.push(o) })

    // One primitive per region — this is also what makes click-to-pick free.
    expect(meshes).toHaveLength(7)
    expect(meshes.map(m => m.material.name).sort()).toEqual([
      'region_back_and_feet', 'region_cabinet', 'region_dial_face', 'region_front_panel',
      'region_knobs', 'region_metal_trim', 'region_speaker_grille',
    ])

    // UVs must survive: the baked palettes are applied through them.
    for (const m of meshes) {
      expect(m.geometry.attributes.position, `${m.material.name} lost positions`).toBeDefined()
      expect(m.geometry.attributes.uv, `${m.material.name} lost UVs`).toBeDefined()
    }

    const tris = meshes.reduce((n, m) =>
      n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0)
    expect(tris).toBeGreaterThan(100)
  })
})
