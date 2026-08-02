/**
 * Warms every asset a challenge needs before the page is revealed.
 *
 * ── THE RULE THIS MODULE IS BUILT AROUND ────────────────────
 * Nothing here may reject, and nothing here may hang. A student staring at a
 * loading screen because one texture 404'd is strictly worse than the pop this
 * whole feature exists to remove. Every task settles, and `preloadAll` reveals
 * on a ceiling no matter what.
 *
 * ── WHY WEIGHTS ─────────────────────────────────────────────
 * The assets are nowhere near equal. The book GLB is 2.63 MiB; the two page
 * textures are 1536x2048 each; the graph is a cropped screenshot. Counting
 * tasks equally puts the bar at 90% and leaves it there for the whole download
 * that actually takes time, which reads as a stuck page.
 */

/** Relative cost of each kind of asset. Tuned to real byte sizes, not counts. */
export const ASSET_WEIGHT = {
  /** PageFlix-web-smooth-203-notex.glb — 2.63 MiB, by far the biggest thing. */
  model: 60,
  /** cover_url + inner_url, 1536x2048 apiece. */
  texture: 25,
  /** Graph, room plate, sketch frame, 2D book art. */
  image: 15,
} as const

export type AssetKind = keyof typeof ASSET_WEIGHT

export interface PreloadTask {
  kind: AssetKind
  /** Runs the fetch. May reject — `preloadAll` treats that as done, not failed. */
  run: (onProgress?: (fraction: number) => void) => Promise<unknown>
}

/**
 * Reveal anyway after this long.
 *
 * Chosen against the dominant asset: 2.63 MiB needs ~10s on a 2 Mbps school
 * connection, so a shorter ceiling would routinely cut off a load that was
 * going to succeed.
 */
export const PRELOAD_CEILING_MS = 12_000

/**
 * Resolves once the bitmap is decoded, or immediately if it cannot be.
 *
 * `.decode()` matters: `onload` only means the bytes arrived. A large PNG that
 * has downloaded but not been decoded still costs a frame the first time it is
 * painted, which is the exact stutter being removed. Where `decode` is missing
 * or throws (Safari has historically thrown on some SVGs), `onload` is enough.
 */
export function preloadImage(
  url: string | null | undefined,
  opts: { crossOrigin?: string } = {},
): Promise<void> {
  if (!url) return Promise.resolve()
  return new Promise<void>(resolve => {
    const img = new Image()
    if (opts.crossOrigin) img.crossOrigin = opts.crossOrigin
    img.onload = () => {
      if (typeof img.decode === 'function') img.decode().then(() => resolve(), () => resolve())
      else resolve()
    }
    img.onerror = () => resolve()
    img.src = url
  })
}

/**
 * Downloads and parses the book GLB.
 *
 * `THREE.Cache.enabled = true` before the load is the whole point. GLTFLoader
 * reads through FileLoader, which consults that cache by URL — so when
 * RoomPlacementStage later runs its own `loader.load(modelUrl)`, it gets the
 * bytes back without a second request. That makes the warm-up correct on its
 * own terms rather than dependent on Supabase sending cache headers we do not
 * control.
 *
 * three is imported dynamically so the 2D path — mobile, or any student without
 * a room — never pulls the chunk in just to run a preloader.
 */
export function preloadModel(
  url: string | null | undefined,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  if (!url) return Promise.resolve()
  return (async () => {
    const THREE = await import('three')
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    THREE.Cache.enabled = true
    await new Promise<void>(resolve => {
      new GLTFLoader().load(
        url,
        () => resolve(),
        event => {
          // Only meaningful when the server sends Content-Length; without it
          // `total` is 0 and the bar simply waits on the other assets.
          if (event.total > 0) onProgress?.(Math.min(1, event.loaded / event.total))
        },
        () => resolve(),
      )
    })
  })().catch(() => undefined)
}

/**
 * Runs every task, reporting weighted progress, and always resolves.
 *
 * Progress is monotonic by construction: a task's contribution only ever moves
 * up, and completion pins it to its full weight. A bar that goes backwards
 * looks broken even when the underlying load is fine.
 */
export async function preloadAll(
  tasks: PreloadTask[],
  onProgress?: (fraction: number) => void,
  ceilingMs: number = PRELOAD_CEILING_MS,
): Promise<void> {
  if (tasks.length === 0) {
    onProgress?.(1)
    return
  }

  const weights = tasks.map(t => ASSET_WEIGHT[t.kind])
  const total = weights.reduce((a, b) => a + b, 0)
  const done = tasks.map(() => 0)

  let finished = false
  const report = () => {
    if (finished) return
    const sum = done.reduce((acc, f, i) => acc + f * weights[i], 0)
    onProgress?.(Math.min(1, sum / total))
  }

  const running = tasks.map((task, i) =>
    Promise.resolve()
      .then(() =>
        task.run(fraction => {
          // Never let a progress event walk a task backwards.
          done[i] = Math.max(done[i], Math.min(1, fraction))
          report()
        }),
      )
      // A rejection is a finished task. The asset is missing; the page still opens.
      .catch(() => undefined)
      .then(() => {
        done[i] = 1
        report()
      }),
  )

  let timer: ReturnType<typeof setTimeout> | undefined
  const ceiling = new Promise<void>(resolve => {
    timer = setTimeout(resolve, ceilingMs)
  })

  await Promise.race([Promise.all(running).then(() => undefined), ceiling])
  if (timer) clearTimeout(timer)

  finished = true
  onProgress?.(1)
}

// ── Which assets a given challenge actually needs ──────────────────────────

export interface ChallengeAssets {
  /** The problem figure. Present on both paths, and today the late one on mobile. */
  graphUrl?: string | null
  /** 3D path. All four, or none. */
  roomUrl?: string | null
  modelUrl?: string | null
  coverUrl?: string | null
  innerUrl?: string | null
  /** 2D path. */
  bookCoverUrl?: string | null
  bookPageUrl?: string | null
  bookFrameUrls?: string[] | null
}

/** The sketch frame the room's drawn boundary is masked with. */
export const SKETCH_FRAME_URL = '/sketch-frame.png'

/**
 * True when the 3D room will actually render.
 *
 * Deliberately the same three conditions ChallengeBookShell gates on. If this
 * and that ever disagree, the gate waits for a GLB the page will not draw, or
 * reveals a room whose textures have not arrived — so they are stated once here
 * and the shell's check is the mirror.
 */
export function usesRoom(opts: {
  isDesktop: boolean
  hasScene: boolean
  modelUrl: string | null | undefined
}): boolean {
  return opts.isDesktop && opts.hasScene && !!opts.modelUrl
}

/** Builds the task list for whichever path is about to render. */
export function challengeAssetTasks(assets: ChallengeAssets, room: boolean): PreloadTask[] {
  const tasks: PreloadTask[] = []
  const image = (url: string | null | undefined, crossOrigin?: string) => {
    if (url) tasks.push({ kind: 'image', run: () => preloadImage(url, { crossOrigin }) })
  }

  image(assets.graphUrl)

  if (room) {
    // crossOrigin matches both the stage's <img> and useAdaptiveInk's sampler,
    // so all three share one cache entry instead of fetching the plate twice.
    image(assets.roomUrl, 'anonymous')
    image(SKETCH_FRAME_URL)
    if (assets.modelUrl) {
      const url = assets.modelUrl
      tasks.push({ kind: 'model', run: onProgress => preloadModel(url, onProgress) })
    }
    for (const url of [assets.coverUrl, assets.innerUrl]) {
      if (url) tasks.push({ kind: 'texture', run: () => preloadImage(url) })
    }
  } else {
    image(assets.bookCoverUrl)
    image(assets.bookPageUrl)
    for (const url of assets.bookFrameUrls ?? []) image(url)
  }

  return tasks
}
