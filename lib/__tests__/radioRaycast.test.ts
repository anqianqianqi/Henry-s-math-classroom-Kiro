import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DEFAULT_RADIO_PLACEMENT } from '../challengeRoom/radio'

/**
 * Clicking the radio opened the book as well, so the raycast is under
 * suspicion. This rebuilds the stage's exact camera and transform chain around
 * the real model and asks: does a click at the radio's own screen position hit
 * it?
 *
 * Everything here mirrors RoomPlacementStage — the orthographic frustum, the
 * 3:2 stage, the normalise-then-place order — because a mismatch in any of
 * those is what a miss would look like.
 */

const MODEL = resolve(process.cwd(), 'public/models/vintage-radio-notex.glb')
const RADIO_TARGET_SIZE = 0.8
const deg = (v: number) => THREE.MathUtils.degToRad(v)

/** The stage's camera, for a 3:2 box, exactly as `resize()` builds it. */
function makeCamera(width = 900, height = 600) {
  const viewHeight = 4
  const viewWidth = viewHeight * (width / height)
  const camera = new THREE.OrthographicCamera(
    -viewWidth / 2, viewWidth / 2, viewHeight / 2, -viewHeight / 2, 0.1, 100,
  )
  camera.position.set(0, 0, 10)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return { camera, width, height }
}

async function loadRadio() {
  const buf = readFileSync(MODEL)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  const gltf: any = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res as any, rej))

  const model = gltf.scene
  model.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(model)
  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  const longest = Math.max(size.x, size.y, size.z) || 1
  model.position.sub(center)
  model.scale.setScalar(RADIO_TARGET_SIZE / longest)

  const group = new THREE.Group()
  group.add(model)
  return group
}

function place(group: THREE.Group, p = DEFAULT_RADIO_PLACEMENT) {
  group.position.set(p.x, p.y, 0)
  group.scale.setScalar(p.scale)
  group.rotation.set(deg(p.tilt), deg(p.turn), deg(p.roll))
  group.updateMatrixWorld(true)
}

/** The component's own client→NDC conversion, verbatim. */
function ndcFor(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }) {
  return new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  )
}

describe('picking the radio', () => {
  it('hits it at its own projected centre', async () => {
    const { camera, width, height } = makeCamera()
    const group = await loadRadio()
    place(group)

    const scene = new THREE.Scene()
    scene.add(group)
    scene.updateMatrixWorld(true)

    // Where the radio actually is on screen, by projecting its world centre.
    const centre = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3())
    const projected = centre.clone().project(camera)
    const rect = { left: 0, top: 0, width, height }
    const clientX = ((projected.x + 1) / 2) * width
    const clientY = ((1 - projected.y) / 2) * height

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndcFor(clientX, clientY, rect), camera)
    const hit = raycaster.intersectObject(group, true)[0]

    expect(hit, 'a click on the radio missed it entirely').toBeDefined()
    expect((hit!.object as THREE.Mesh).material).toBeDefined()
    expect(((hit!.object as THREE.Mesh).material as THREE.Material).name).toMatch(/^region_/)
  })

  it('has gaps in its silhouette that an exact hit-test misses', async () => {
    /*
      The reason the padded fallback exists, stated as a measurement.

      A mantel radio is not a rectangle: sweeping its projected bounding box,
      a real fraction of the samples hit nothing. Every one of those was a click
      that used to sail through to the room and open the book.
    */
    const { camera, width, height } = makeCamera()
    const group = await loadRadio()
    place(group)
    const scene = new THREE.Scene()
    scene.add(group)
    scene.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(group)
    const min = box.min.clone().project(camera)
    const max = box.max.clone().project(camera)
    const raycaster = new THREE.Raycaster()
    const rect = { left: 0, top: 0, width, height }

    let hits = 0
    let total = 0
    for (let i = 0; i <= 30; i++) {
      for (let j = 0; j <= 30; j++) {
        const nx = min.x + ((max.x - min.x) * i) / 30
        const ny = min.y + ((max.y - min.y) * j) / 30
        raycaster.setFromCamera(
          ndcFor(((nx + 1) / 2) * width, ((1 - ny) / 2) * height, rect), camera,
        )
        total++
        if (raycaster.intersectObject(group, true)[0]) hits++
      }
    }

    // Not a hypothesis — the silhouette genuinely does not fill its own box.
    expect(hits).toBeGreaterThan(0)
    expect(hits, 'silhouette fills its box; the padding would be pointless')
      .toBeLessThan(total)
  })

  it('misses when the click is far away, so the book still opens elsewhere', async () => {
    const { camera, width, height } = makeCamera()
    const group = await loadRadio()
    place(group)
    const scene = new THREE.Scene()
    scene.add(group)
    scene.updateMatrixWorld(true)

    const raycaster = new THREE.Raycaster()
    // Bottom-left corner — the table, nowhere near the sill.
    raycaster.setFromCamera(ndcFor(20, height - 20, { left: 0, top: 0, width, height }), camera)
    expect(raycaster.intersectObject(group, true)[0]).toBeUndefined()
  })

  it('reports a different region for the knobs than for the cabinet', async () => {
    // The whole click-mapping rests on regions being separately hittable.
    const { camera, width, height } = makeCamera()
    const group = await loadRadio()
    place(group)
    const scene = new THREE.Scene()
    scene.add(group)
    scene.updateMatrixWorld(true)

    const rect = { left: 0, top: 0, width, height }
    const raycaster = new THREE.Raycaster()
    const seen = new Set<string>()

    // Sweep the radio's bounding box; every visible region should appear.
    const box = new THREE.Box3().setFromObject(group)
    const min = box.min.clone().project(camera)
    const max = box.max.clone().project(camera)
    for (let i = 0; i <= 40; i++) {
      for (let j = 0; j <= 40; j++) {
        const nx = min.x + ((max.x - min.x) * i) / 40
        const ny = min.y + ((max.y - min.y) * j) / 40
        const cx = ((nx + 1) / 2) * width
        const cy = ((1 - ny) / 2) * height
        raycaster.setFromCamera(ndcFor(cx, cy, rect), camera)
        const hit = raycaster.intersectObject(group, true)[0]
        if (hit) seen.add(((hit.object as THREE.Mesh).material as THREE.Material).name)
      }
    }

    expect(seen.size, `only saw ${[...seen].join(', ')}`).toBeGreaterThan(1)
    expect([...seen].every(n => n.startsWith('region_'))).toBe(true)
  })
})
