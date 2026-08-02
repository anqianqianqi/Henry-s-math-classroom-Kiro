'use client'

/**
 * RoomPlacementStage — the 2.5D compositing stage for a challenge room.
 *
 * The room is a flat <img>; only the book is WebGL, rendered on a transparent
 * canvas stacked on top. That is why blurring the background later costs a
 * single CSS filter, and why the camera is ORTHOGRAPHIC — a perspective camera
 * would not match a flat painted plate.
 *
 * Drag to move the book, wheel to scale. Placement is reported upward so the
 * admin page can persist it with the room.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { renderPageCanvas, type PageContent } from '@/lib/challengeRoom/pageTexture'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import {
  BOOK_MATERIALS,
  MIRRORED_U_MATERIALS,
  type AnimationConfig,
  type Placement,
} from '@/lib/types/challengeRoom'

export interface RoomPlacementStageProps {
  roomUrl: string
  modelUrl: string
  /** Front-cover texture (1536×2048). Optional — pages render plain if absent. */
  coverUrl?: string | null
  /** Inner-page texture (1536×2048). */
  innerUrl?: string | null
  placement: Placement
  onPlacementChange: (next: Placement) => void
  animation: AnimationConfig
  /** Current frame, driven by the parent's scrubber. */
  frame: number
  onFrameChange: (frame: number) => void
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  /** Interactions off when false — used for read-only previews. */
  interactive?: boolean
  /** Click anywhere on the stage. Used by the student view to open the book. */
  onCanvasClick?: () => void
  /** Hides the room plate so the book can be cross-faded onto another surface. */
  hideRoom?: boolean
  /** Preview text printed into the two visible page textures at the spread. */
  pagePreview?: { left?: PageContent; right?: PageContent }
  /**
   * Where the book actually is on screen, in percent of the stage.
   *
   * Needed because the group origin is NOT the book's centre: the page geometry
   * spans local X 0..2, so a page's origin sits at its spine edge, and when the
   * book is closed the whole thing is offset from that origin. Anything
   * anchoring to the book (labels, hints) has to use this instead.
   */
  onBookRect?: (rect: { xPct: number; yPct: number; wPct: number; hPct: number }) => void
  /**
   * Fired once the book is fully DRESSED — model loaded AND cover and page
   * textures applied.
   *
   * Deliberately not the same moment as the internal `loading` flag, which
   * clears on modelReady. The texture effect does not even start until then, so
   * anything keying off `loading` reveals a bare white book that puts its cover
   * on a beat later. That is the pop this exists to close.
   */
  onReady?: () => void

  // ── The radio on the window sill ─────────────────────────────────────────
  /** Stripped GLB. Absent means no radio, which is the default for a room. */
  radioUrl?: string | null
  /** Baked palette to paint every region with. */
  radioTextureUrl?: string | null
  /** Where it stands, tuned per room against that room's plate. */
  radioPlacement?: Placement | null
  /**
   * Which part was clicked, by material name — `region_knobs`, `region_dial_face`
   * and so on. The mesh arrives as one primitive per region, so this costs a
   * raycast and nothing else.
   */
  onRadioClick?: (region: string) => void
  /** Drag the radio rather than the book. Admin placement only. */
  radioInteractive?: boolean
  onRadioPlacementChange?: (next: Placement) => void
}

const deg = (value: number) => THREE.MathUtils.degToRad(value)

/** Normalised longest-side length, so any re-bake lands at the same size. */
const MODEL_TARGET_SIZE = 2.35

/**
 * The radio's normalised size, in the same units.
 *
 * Roughly a third of the book, which is about right for a mantel radio next to
 * an open folio. The per-room placement scales from here, so this only has to
 * put it in the right ballpark for an admin's first drag.
 */
const RADIO_TARGET_SIZE = 0.8

/**
 * A page's own corners, from the baked mesh bounds: X 0..2, Z -1.333..1.333,
 * flat in Y. Note X starts at 0 — the origin is the spine edge, not the middle.
 */
const PAGE_CORNERS = [
  new THREE.Vector3(0, 0, -1.3335),
  new THREE.Vector3(2, 0, -1.3335),
  new THREE.Vector3(2, 0, 1.3335),
  new THREE.Vector3(0, 0, 1.3335),
]

export function RoomPlacementStage({
  roomUrl,
  modelUrl,
  coverUrl,
  innerUrl,
  placement,
  onPlacementChange,
  animation,
  frame,
  onFrameChange,
  playing,
  onPlayingChange,
  interactive = true,
  onCanvasClick,
  hideRoom = false,
  pagePreview,
  onBookRect,
  onReady,
  radioUrl,
  radioTextureUrl,
  radioPlacement,
  onRadioClick,
  radioInteractive = false,
  onRadioPlacementChange,
}: RoomPlacementStageProps) {
  const { t } = useLanguage()
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const actionRef = useRef<THREE.AnimationAction | null>(null)
  const materialsRef = useRef<Map<string, THREE.Material>>(new Map())
  const appliedTexturesRef = useRef<THREE.Texture[]>([])
  const frameRef = useRef(frame)
  const animationRef = useRef(animation)
  const playingRef = useRef(playing)
  const rafRef = useRef(0)
  const lastReportRef = useRef(0)
  const pageNodesRef = useRef<THREE.Object3D[]>([])
  const onBookRectRef = useRef(onBookRect)
  const onReadyRef = useRef(onReady)
  /** Latched: the page reveals once, and a texture swap must not re-fire it. */
  const readyFiredRef = useRef(false)

  const radioGroupRef = useRef<THREE.Group | null>(null)
  const radioTextureRef = useRef<THREE.Texture | null>(null)
  const onRadioClickRef = useRef(onRadioClick)
  const [radioReady, setRadioReady] = useState(false)
  /** Reused across clicks — allocating a raycaster per pointer event is waste. */
  const raycasterRef = useRef(new THREE.Raycaster())
  const lastRectRef = useRef(0)
  const prevRectRef = useRef<{ xPct: number; yPct: number; wPct: number; hPct: number } | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modelReady, setModelReady] = useState(false)

  // Mirror props into refs so the render loop closure always sees current values
  useEffect(() => { animationRef.current = animation }, [animation])
  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => { frameRef.current = frame }, [frame])
  useEffect(() => { onBookRectRef.current = onBookRect }, [onBookRect])
  useEffect(() => { onReadyRef.current = onReady }, [onReady])
  useEffect(() => { onRadioClickRef.current = onRadioClick }, [onRadioClick])

  // ── Scene setup (once) ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    // Render at 2x CSS resolution regardless of the display, then let the
    // browser downsample. The book covers only about a fifth of the stage
    // width, so on a 1x screen its cover art lands on ~260 device pixels out of
    // a 1536px texture and reads soft; supersampling doubles that to ~520.
    // Cheap here — three planes, so cost is vertex/morph work, not fragment
    // shading — and a fixed 2 keeps the buffer bounded on large high-DPI
    // monitors, where devicePixelRatio 3 would mean a 20+ megapixel target.
    renderer.setPixelRatio(2)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.OrthographicCamera(-3, 3, 2, -2, 0.1, 100)
    camera.position.set(0, 0, 10)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    scene.add(new THREE.HemisphereLight(0xfff4dd, 0x263d45, 2.35))
    const keyLight = new THREE.DirectionalLight(0xffe4bc, 3.2)
    keyLight.position.set(-4, 6, 8)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight(0x9ac8e8, 1.25)
    fillLight.position.set(5, 1, 6)
    scene.add(fillLight)

    // Catches the book's shadow so it sits on the painted tabletop
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 6),
      new THREE.ShadowMaterial({ color: 0x172d29, opacity: 0.26 }),
    )
    shadowPlane.position.z = -1.2
    shadowPlane.receiveShadow = true
    scene.add(shadowPlane)

    const resize = () => {
      const rect = stage.getBoundingClientRect()
      const width = Math.max(rect.width, 1)
      const height = Math.max(rect.height, 1)
      renderer.setSize(width, height, false)
      const viewHeight = 4
      const viewWidth = viewHeight * (width / height)
      camera.left = -viewWidth / 2
      camera.right = viewWidth / 2
      camera.top = viewHeight / 2
      camera.bottom = -viewHeight / 2
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    resize()

    const clock = new THREE.Clock()
    const render = (time: number) => {
      const delta = Math.min(clock.getDelta(), 0.05)
      const action = actionRef.current
      const cfg = animationRef.current

      if (action && playingRef.current) {
        const rate = cfg.playbackFps / cfg.sourceFps
        mixerRef.current?.update(delta * rate)
        const endTime = cfg.endFrame / cfg.sourceFps
        const startTime = cfg.startFrame / cfg.sourceFps

        if (action.time >= endTime) {
          if (cfg.loop) {
            action.time = startTime
            mixerRef.current?.update(0)
          } else {
            // Hold the settled spread rather than drifting past it
            action.time = endTime
            action.paused = true
            mixerRef.current?.update(0)
            playingRef.current = false
            onPlayingChange(false)
            onFrameChange(cfg.endFrame)
          }
        } else if (time - lastReportRef.current > 100) {
          lastReportRef.current = time
          onFrameChange(Math.round(action.time * cfg.sourceFps))
        }
      }

      renderer.render(scene, camera)

      // Report where the book landed, so callers can anchor labels to it.
      // Projecting the page quads is the only reliable way — the group origin
      // is the spine edge, not the book's centre. Throttled and change-gated so
      // it does not re-render the parent every frame.
      if (onBookRectRef.current && pageNodesRef.current.length > 0
          && time - lastRectRef.current > 120) {
        lastRectRef.current = time
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        const point = new THREE.Vector3()
        for (const node of pageNodesRef.current) {
          for (const corner of PAGE_CORNERS) {
            point.copy(corner).applyMatrix4(node.matrixWorld).project(camera)
            const x = (point.x * 0.5 + 0.5) * 100
            const y = (-point.y * 0.5 + 0.5) * 100
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
        const rect = {
          xPct: (minX + maxX) / 2,
          yPct: (minY + maxY) / 2,
          wPct: maxX - minX,
          hPct: maxY - minY,
        }
        const prev = prevRectRef.current
        if (
          !prev ||
          Math.abs(prev.xPct - rect.xPct) > 0.4 ||
          Math.abs(prev.yPct - rect.yPct) > 0.4 ||
          Math.abs(prev.wPct - rect.wPct) > 0.4
        ) {
          prevRectRef.current = rect
          onBookRectRef.current(rect)
        }
      }

      rafRef.current = window.requestAnimationFrame(render)
    }
    rafRef.current = window.requestAnimationFrame(render)

    return () => {
      window.cancelAnimationFrame(rafRef.current)
      observer.disconnect()
      shadowPlane.geometry.dispose()
      shadowPlane.material.dispose()
      for (const texture of appliedTexturesRef.current) texture.dispose()
      appliedTexturesRef.current = []
      renderer.dispose()
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load the book model ───────────────────────────────────────────────────
  useEffect(() => {
    if (!modelUrl || !sceneRef.current) return
    let cancelled = false
    setLoading(true)
    setError('')

    const loader = new GLTFLoader()
    loader.load(
      modelUrl,
      gltf => {
        if (cancelled || !sceneRef.current) return

        const model = gltf.scene
        model.updateMatrixWorld(true)
        const bounds = new THREE.Box3().setFromObject(model)
        const center = bounds.getCenter(new THREE.Vector3())
        const size = bounds.getSize(new THREE.Vector3())
        const longest = Math.max(size.x, size.y, size.z) || 1
        model.position.sub(center)
        model.scale.setScalar(MODEL_TARGET_SIZE / longest)

        const group = new THREE.Group()
        group.add(model)
        sceneRef.current.add(group)
        groupRef.current = group

        pageNodesRef.current = []
        model.traverse(object => {
          if (object.name.startsWith('Page-')) pageNodesRef.current.push(object)
        })
        prevRectRef.current = null

        const materials = new Map<string, THREE.Material>()
        model.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return
          object.castShadow = true
          object.receiveShadow = true
          const list = Array.isArray(object.material) ? object.material : [object.material]
          for (const material of list) {
            if (material?.name) materials.set(material.name, material)
          }
        })
        materialsRef.current = materials

        const clip =
          gltf.animations.find(c => c.name === animationRef.current.clip) ?? gltf.animations[0]
        if (clip) {
          const mixer = new THREE.AnimationMixer(model)
          mixerRef.current = mixer
          const action = mixer.clipAction(clip)
          action.setLoop(THREE.LoopOnce, 1)
          action.clampWhenFinished = true
          action.play()
          action.time = frameRef.current / animationRef.current.sourceFps
          action.paused = !playingRef.current
          mixer.update(0)
          actionRef.current = action
        }

        setModelReady(true)
        setLoading(false)
      },
      undefined,
      loadError => {
        if (cancelled) return
        console.error('[RoomPlacementStage] model load failed:', loadError)
        setError('The book model could not be loaded. Check the model URL.')
        setLoading(false)
        /*
          Report ready even on failure. The texture effect is gated on
          modelReady, so on this path it never runs and never announces — which
          would leave the page sitting on its loading screen until the ceiling
          for a room that is never going to arrive. Revealing shows the error
          message below, which is the useful outcome.
        */
        if (!readyFiredRef.current) {
          readyFiredRef.current = true
          onReadyRef.current?.()
        }
      },
    )

    return () => {
      cancelled = true
      const group = groupRef.current
      if (group && sceneRef.current) {
        sceneRef.current.remove(group)
        group.traverse(object => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose()
            const list = Array.isArray(object.material) ? object.material : [object.material]
            for (const material of list) material?.dispose()
          }
        })
      }
      groupRef.current = null
      mixerRef.current = null
      actionRef.current = null
      materialsRef.current = new Map()
      pageNodesRef.current = []
      setModelReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl])

  // ── Apply placement ──────────────────────────────────────────────────────
  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    group.position.set(placement.x, placement.y, 0)
    group.scale.setScalar(placement.scale)
    group.rotation.set(deg(placement.tilt), deg(placement.turn), deg(placement.roll))
  }, [placement, modelReady])

  // ── Load the radio ───────────────────────────────────────────────────────
  /*
    A second object in the same scene, camera and lighting as the book — the
    room stays a flat <img> behind both.

    Normalised the same way the book is: centred on its own bounds and scaled to
    a fixed longest side, so the saved placement means the same thing no matter
    what the source model's units were.
  */
  useEffect(() => {
    if (!radioUrl || !sceneRef.current) return
    let cancelled = false

    new GLTFLoader().load(
      radioUrl,
      gltf => {
        if (cancelled || !sceneRef.current) return

        const model = gltf.scene
        model.updateMatrixWorld(true)
        const bounds = new THREE.Box3().setFromObject(model)
        const center = bounds.getCenter(new THREE.Vector3())
        const size = bounds.getSize(new THREE.Vector3())
        const longest = Math.max(size.x, size.y, size.z) || 1
        model.position.sub(center)
        model.scale.setScalar(RADIO_TARGET_SIZE / longest)

        model.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return
          object.castShadow = true
          object.receiveShadow = true
          // Cloned before anything is changed on it. GLTFLoader caches
          // materials across loads, and painting a palette onto a shared
          // instance would repaint every other radio using it — the handoff's
          // AGENTS.md calls this out for the same reason.
          object.material = (object.material as THREE.Material).clone()
        })

        const group = new THREE.Group()
        group.add(model)
        sceneRef.current.add(group)
        radioGroupRef.current = group
        setRadioReady(true)
      },
      undefined,
      loadError => {
        // A missing radio is a room without one, not a broken room. The book is
        // the point of the page and must not be held hostage to a prop.
        if (!cancelled) console.error('[RoomPlacementStage] radio load failed:', loadError)
      },
    )

    return () => {
      cancelled = true
      const group = radioGroupRef.current
      if (group && sceneRef.current) {
        sceneRef.current.remove(group)
        group.traverse(object => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose()
            const list = Array.isArray(object.material) ? object.material : [object.material]
            for (const material of list) material?.dispose()
          }
        })
      }
      radioGroupRef.current = null
      radioTextureRef.current?.dispose()
      radioTextureRef.current = null
      setRadioReady(false)
    }
  }, [radioUrl])

  // ── Paint the radio with the chosen palette ──────────────────────────────
  useEffect(() => {
    if (!radioReady || !radioTextureUrl) return
    let cancelled = false

    new THREE.TextureLoader().load(radioTextureUrl, texture => {
      if (cancelled || !radioGroupRef.current) { texture.dispose(); return }
      texture.colorSpace = THREE.SRGBColorSpace
      // glTF UV convention, same as the book's pages.
      texture.flipY = false
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.anisotropy = rendererRef.current?.capabilities.getMaxAnisotropy() ?? 1

      radioTextureRef.current?.dispose()
      radioTextureRef.current = texture

      // Every region shares the one baked image: the palette was baked as a
      // single texture covering all seven UV islands at once.
      radioGroupRef.current.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return
        const material = object.material as THREE.MeshStandardMaterial
        material.map = texture
        material.needsUpdate = true
      })
    })

    return () => { cancelled = true }
  }, [radioReady, radioTextureUrl])

  // ── Apply the radio's placement ──────────────────────────────────────────
  useEffect(() => {
    const group = radioGroupRef.current
    if (!group || !radioPlacement) return
    group.position.set(radioPlacement.x, radioPlacement.y, 0)
    group.scale.setScalar(radioPlacement.scale)
    group.rotation.set(deg(radioPlacement.tilt), deg(radioPlacement.turn), deg(radioPlacement.roll))
  }, [radioPlacement, radioReady])

  // ── Scrub to a frame when not playing ────────────────────────────────────
  useEffect(() => {
    const action = actionRef.current
    if (!action || playing) return
    action.time = frame / animation.sourceFps
    action.paused = true
    mixerRef.current?.update(0)
  }, [frame, playing, animation.sourceFps, modelReady])

  useEffect(() => {
    const action = actionRef.current
    if (action) action.paused = !playing
  }, [playing, modelReady])

  // ── Apply cover / inner-page textures ────────────────────────────────────
  useEffect(() => {
    if (!modelReady) return
    let cancelled = false
    const loader = new THREE.TextureLoader()

    // The pages sit at roughly 58 degrees to the camera, which is the worst
    // case for the default anisotropy of 1 — page art and any text go soft and
    // shimmer under minification. Max anisotropy (usually 16) is the single
    // biggest sharpness win here and costs nothing at this triangle count.
    const maxAnisotropy = rendererRef.current?.capabilities.getMaxAnisotropy() ?? 1

    const load = (src?: string | null) =>
      new Promise<THREE.Texture | null>(resolve => {
        if (!src) return resolve(null)
        loader.load(
          src,
          texture => {
            texture.colorSpace = THREE.SRGBColorSpace
            // glTF UV convention — without this every page is upside down
            texture.flipY = false
            texture.wrapS = THREE.ClampToEdgeWrapping
            texture.wrapT = THREE.ClampToEdgeWrapping
            texture.anisotropy = maxAnisotropy
            texture.generateMipmaps = true
            texture.minFilter = THREE.LinearMipmapLinearFilter
            resolve(texture)
          },
          undefined,
          () => resolve(null),
        )
      })

    Promise.all([load(coverUrl), load(innerUrl)]).then(([cover, inner]) => {
      if (cancelled) {
        cover?.dispose()
        inner?.dispose()
        return
      }

      for (const texture of appliedTexturesRef.current) texture.dispose()
      appliedTexturesRef.current = []

      /**
       * Mirrored faces need their own texture instance because the fix mutates
       * repeat/offset, which would otherwise leak to every page sharing it.
       * Everything else shares one instance — at 1536x2048 each extra upload
       * costs ~12 MB of VRAM, which adds up fast on a school tablet.
       */
      const mirroredCache = new Map<THREE.Texture, THREE.Texture>()
      const mirroredOf = (source: THREE.Texture) => {
        const cached = mirroredCache.get(source)
        if (cached) return cached
        const texture = source.clone()
        // ClampToEdge ignores a negative repeat, so switch to Repeat first.
        texture.wrapS = THREE.RepeatWrapping
        texture.repeat.x = -1
        texture.offset.x = 1
        texture.needsUpdate = true
        mirroredCache.set(source, texture)
        appliedTexturesRef.current.push(texture)
        return texture
      }

      const assign = (materialName: string, source: THREE.Texture | null) => {
        const material = materialsRef.current.get(materialName)
        if (!material || !('map' in material)) return
        const target = source
          ? MIRRORED_U_MATERIALS.includes(materialName)
            ? mirroredOf(source)
            : source
          : null
        ;(material as THREE.MeshStandardMaterial).map = target
        material.needsUpdate = true
      }

      /**
       * Bake the problem/solution preview into the two visible page textures so
       * it reads as writing on the paper — the 3D pipeline then supplies the
       * perspective, curl and lighting. The mirror correction above still runs,
       * which is what keeps the left page's text the right way round.
       */
      const printed = (content: PageContent | undefined) => {
        if (!content || !inner?.image) return null
        try {
          const canvas = renderPageCanvas(inner.image as CanvasImageSource, content)
          const texture = new THREE.CanvasTexture(canvas)
          texture.colorSpace = THREE.SRGBColorSpace
          texture.flipY = false
          texture.wrapS = THREE.ClampToEdgeWrapping
          texture.wrapT = THREE.ClampToEdgeWrapping
          texture.anisotropy = maxAnisotropy
          texture.needsUpdate = true
          appliedTexturesRef.current.push(texture)
          return texture
        } catch (err) {
          // A tainted canvas or missing 2D context must not cost us the book
          console.error('[RoomPlacementStage] page preview render failed:', err)
          return null
        }
      }

      const leftPrinted = printed(pagePreview?.left)
      const rightPrinted = printed(pagePreview?.right)

      assign(BOOK_MATERIALS.cover, cover)
      assign(BOOK_MATERIALS.leftPage, leftPrinted ?? inner)
      assign(BOOK_MATERIALS.rightPage, rightPrinted ?? inner)
      for (const name of BOOK_MATERIALS.otherPages) assign(name, inner)

      // Retain the shared originals too — they are now bound to materials, so
      // they must live until the next swap rather than being disposed here.
      if (cover) appliedTexturesRef.current.push(cover)
      if (inner) appliedTexturesRef.current.push(inner)

      /*
        The book is dressed. Announced from HERE and nowhere earlier: this is
        the first instant at which what the student would see is the finished
        book rather than a bare one.

        One frame of grace so the renderer has actually drawn with the new maps
        before the page cross-fades in — announcing on the same tick reveals the
        frame before the upload lands.
      */
      if (!readyFiredRef.current) {
        readyFiredRef.current = true
        requestAnimationFrame(() => onReadyRef.current?.())
      }
    })

    return () => { cancelled = true }
  }, [coverUrl, innerUrl, modelReady, pagePreview])

  // ── Drag to move, wheel to scale ─────────────────────────────────────────
  const dragRef = useRef<{ id: number; x: number; y: number; startX: number; startY: number } | null>(null)

  /*
    Which placement the drag and wheel act on. The admin tool points the same
    six controls at either object rather than growing a second editor, so the
    stage has to know which one is live.
  */
  const dragTarget = radioInteractive && radioPlacement ? radioPlacement : placement
  const emitTarget = radioInteractive && radioPlacement
    ? (onRadioPlacementChange ?? (() => {}))
    : onPlacementChange
  const dragEnabled = interactive || (radioInteractive && !!radioPlacement)

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragEnabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: dragTarget.x,
      startY: dragTarget.y,
    }
  }, [dragEnabled, dragTarget.x, dragTarget.y])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    const stage = stageRef.current
    if (!drag || !stage || drag.id !== event.pointerId) return
    const rect = stage.getBoundingClientRect()
    const viewHeight = 4
    const viewWidth = viewHeight * (rect.width / rect.height)
    // Convert pixel delta into world units via the orthographic frustum
    const dx = ((event.clientX - drag.x) / rect.width) * viewWidth
    const dy = -((event.clientY - drag.y) / rect.height) * viewHeight
    emitTarget({ ...dragTarget, x: drag.startX + dx, y: drag.startY + dy })
  }, [emitTarget, dragTarget])

  const endDrag = useCallback(() => { dragRef.current = null }, [])

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    if (!dragEnabled) return
    event.preventDefault()
    const next = dragTarget.scale * (event.deltaY > 0 ? 0.96 : 1.04)
    emitTarget({ ...dragTarget, scale: Math.min(4, Math.max(0.2, next)) })
  }, [dragEnabled, emitTarget, dragTarget])

  /**
   * Which region of the radio is under the pointer, or null.
   *
   * The stripped GLB is one mesh per region material, so the intersected
   * object's material name IS the region — no lookup table, no extra data.
   */
  const pickRadioRegion = useCallback((clientX: number, clientY: number): string | null => {
    const group = radioGroupRef.current
    const camera = cameraRef.current
    const stage = stageRef.current
    if (!group || !camera || !stage) return null

    const rect = stage.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycasterRef.current.setFromCamera(ndc, camera)
    const hit = raycasterRef.current.intersectObject(group, true)[0]
    if (!hit) return null
    const material = (hit.object as THREE.Mesh).material as THREE.Material
    return material?.name || null
  }, [])

  const [radioHover, setRadioHover] = useState(false)

  const handleCanvasPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    handlePointerMove(event)
    // Only worth a raycast when something can respond to it.
    if (!onRadioClickRef.current || !radioReady) return
    setRadioHover(pickRadioRegion(event.clientX, event.clientY) !== null)
  }, [handlePointerMove, pickRadioRegion, radioReady])

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    // The radio gets first refusal. Without this the click falls through to the
    // book and opens it, which is not what clicking a radio should do.
    if (onRadioClickRef.current && radioReady) {
      const region = pickRadioRegion(event.clientX, event.clientY)
      if (region) { onRadioClickRef.current(region); return }
    }
    onCanvasClick?.()
  }, [onCanvasClick, pickRadioRegion, radioReady])

  return (
    <div
      ref={stageRef}
      className={`relative w-full overflow-hidden ${hideRoom ? '' : 'rounded-xl bg-gray-900'}`}
      style={{ aspectRatio: '3 / 2' }}
    >
      {!hideRoom && (
        /*
          crossOrigin matches useAdaptiveInk, which loads this same URL with
          crossOrigin='anonymous' to sample the edge band. CORS mode is part of
          the HTTP cache key, so without this the room plate is fetched TWICE —
          once for the picture and once for the ink.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={roomUrl}
          alt="Challenge room background"
          crossOrigin="anonymous"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full ${
          dragEnabled ? 'cursor-move' : radioHover || onCanvasClick ? 'cursor-pointer' : ''
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setRadioHover(false)}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="flex items-center gap-3 rounded-xl bg-white/90 px-4 py-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            <span className="text-sm font-medium text-gray-700">{t('challenge.loadingBook')}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-4 bottom-4 rounded-lg bg-red-600/90 px-3 py-2 text-sm text-white">
          {error}
        </div>
      )}
    </div>
  )
}
