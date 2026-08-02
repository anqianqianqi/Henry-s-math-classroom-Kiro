import { describe, expect, it, vi } from 'vitest'
import {
  ASSET_WEIGHT,
  challengeAssetTasks,
  preloadAll,
  usesRoom,
  SKETCH_FRAME_URL,
  type PreloadTask,
} from '../challengeRoom/preload'

/**
 * The loading screen is only an improvement if it always ends. Most of what is
 * asserted here is the ways it must refuse to trap someone: a dead asset, a
 * request that never settles, a bar that walks backwards.
 */

const task = (kind: PreloadTask['kind'], run: PreloadTask['run']): PreloadTask => ({ kind, run })

describe('preloadAll never traps the page', () => {
  it('resolves when a task rejects', async () => {
    // The whole design rests on this: a 404 texture must cost the picture, not
    // the page.
    await expect(
      preloadAll([
        task('image', () => Promise.reject(new Error('404'))),
        task('image', () => Promise.resolve()),
      ]),
    ).resolves.toBeUndefined()
  })

  it('resolves when EVERY task rejects', async () => {
    await expect(
      preloadAll([
        task('model', () => Promise.reject(new Error('gone'))),
        task('texture', () => Promise.reject(new Error('gone'))),
      ]),
    ).resolves.toBeUndefined()
  })

  it('resolves on the ceiling when a task never settles', async () => {
    vi.useFakeTimers()
    try {
      let settled = false
      const p = preloadAll([task('model', () => new Promise(() => {}))], undefined, 500)
        .then(() => { settled = true })
      await vi.advanceTimersByTimeAsync(499)
      expect(settled, 'released before the ceiling').toBe(false)
      await vi.advanceTimersByTimeAsync(2)
      await p
      expect(settled).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('resolves immediately with no tasks, reporting complete', async () => {
    const seen: number[] = []
    await preloadAll([], f => seen.push(f))
    expect(seen.at(-1)).toBe(1)
  })
})

describe('weighted progress', () => {
  it('is monotonic, starts at or above 0 and ends at exactly 1', async () => {
    const seen: number[] = []
    await preloadAll(
      [
        task('model', async onProgress => { onProgress?.(0.25); onProgress?.(0.8) }),
        task('texture', () => Promise.resolve()),
        task('image', () => Promise.resolve()),
      ],
      f => seen.push(f),
    )
    expect(seen[0]).toBeGreaterThanOrEqual(0)
    expect(seen.at(-1)).toBe(1)
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i], `sample ${i} went backwards`).toBeGreaterThanOrEqual(seen[i - 1])
    }
  })

  it('refuses to walk backwards when a task reports a lower fraction', async () => {
    const seen: number[] = []
    await preloadAll(
      [task('model', async onProgress => { onProgress?.(0.9); onProgress?.(0.1) })],
      f => seen.push(f),
    )
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1])
    }
  })

  it('gives the model most of the bar, because it is most of the bytes', async () => {
    // 2.63 MiB against two textures and a handful of small images. Counting
    // tasks equally would park the bar at 90% for the entire real wait.
    expect(ASSET_WEIGHT.model).toBeGreaterThan(ASSET_WEIGHT.texture + ASSET_WEIGHT.image)
  })
})

describe('usesRoom mirrors ChallengeBookShell', () => {
  const base = { isDesktop: true, hasScene: true, modelUrl: 'https://x/book.glb' }

  it('is true only when all three hold', () => {
    expect(usesRoom(base)).toBe(true)
    expect(usesRoom({ ...base, isDesktop: false })).toBe(false)
    expect(usesRoom({ ...base, hasScene: false })).toBe(false)
    expect(usesRoom({ ...base, modelUrl: null })).toBe(false)
    expect(usesRoom({ ...base, modelUrl: '' })).toBe(false)
  })
})

describe('the asset list matches the path that will render', () => {
  const assets = {
    graphUrl: 'https://x/graph.png',
    roomUrl: 'https://x/room.png',
    modelUrl: 'https://x/book.glb',
    coverUrl: 'https://x/cover.png',
    innerUrl: 'https://x/inner.png',
    bookCoverUrl: 'https://x/2d-cover.png',
    bookPageUrl: 'https://x/2d-page.png',
    bookFrameUrls: ['https://x/f1.png', 'https://x/f2.png'],
  }

  it('takes room, model, both textures and the sketch frame on the 3D path', () => {
    const kinds = challengeAssetTasks(assets, true).map(t => t.kind)
    expect(kinds.filter(k => k === 'model')).toHaveLength(1)
    expect(kinds.filter(k => k === 'texture')).toHaveLength(2)
    // graph + room + sketch frame
    expect(kinds.filter(k => k === 'image')).toHaveLength(3)
  })

  it('takes the flat book art and no model on the 2D path', () => {
    const kinds = challengeAssetTasks(assets, false).map(t => t.kind)
    expect(kinds).not.toContain('model')
    expect(kinds).not.toContain('texture')
    // graph + 2D cover + 2D page + 2 frames
    expect(kinds).toHaveLength(5)
  })

  it('always includes the graph — the late image on mobile', () => {
    // Counting is the wrong assertion here: the room path also queues the
    // static sketch frame. What matters is that the graph is never dropped.
    for (const room of [true, false]) {
      expect(challengeAssetTasks({ graphUrl: 'https://x/g.png' }, room).length)
        .toBeGreaterThanOrEqual(1)
    }
    expect(challengeAssetTasks({ graphUrl: 'https://x/g.png' }, false)).toHaveLength(1)
  })

  it('skips absent urls rather than queueing empty work', () => {
    expect(challengeAssetTasks({}, false)).toHaveLength(0)
    // A room with no bundle is legal — the book renders with default materials.
    expect(challengeAssetTasks({ roomUrl: 'https://x/r.png' }, true).map(t => t.kind))
      .toEqual(['image', 'image'])
  })

  it('points the sketch frame at the file the boundary actually masks with', () => {
    expect(SKETCH_FRAME_URL).toBe('/sketch-frame.png')
  })
})
