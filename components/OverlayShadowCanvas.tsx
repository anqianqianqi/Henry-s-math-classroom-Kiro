'use client'
/**
 * OverlayShadowCanvas — WebGL2 / Canvas2D 2D lighting system for transparent overlay PNGs.
 *
 * Pipeline:
 *   1. Load the overlay image; extract its alpha channel → 1-channel CPU buffer.
 *   2. Compute a 2-pass approximate SDF (Signed Distance Field) from the alpha mask.
 *      Positive = outside the silhouette, negative = inside.
 *   3. For each background pixel under the overlay bounding box:
 *      a. Contact shadow:   darkness = strength × (1 - dist/radius)^falloff   [when dist < radius]
 *      b. Directional shadow: march a ray in the light direction; if it hits an
 *         opaque pixel within shadowLength, this pixel is occluded.
 *   4. Apply multiply-darkening to the sampled background pixels.
 *   5. Draw the original overlay on top — asset is NEVER modified.
 *
 * The canvas element is sized exactly to the overlay's rendered bounding box so it
 * can sit in the same absolute-positioned stack as the <img> overlay.
 */

import { useEffect, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type OverlayShadowConfig = {
  contactEnabled:   boolean
  contactRadius:    number   // px — how far the contact shadow spreads
  contactStrength:  number   // 0–1
  contactFalloff:   number   // >0, higher = faster decay (1.5–3)

  directionalEnabled:   boolean
  lightAngleDeg:        number   // 0 = right, 90 = down, 180 = left, 270 = up
  shadowLength:         number   // px
  shadowStrength:       number   // 0–1
  shadowSoftness:       number   // 0–1 penumbra softness
  shadowFalloff:        number   // >0 decay along shadow length

  alphaThreshold: number  // 0–255
}

export const DEFAULT_OVERLAY_SHADOW: OverlayShadowConfig = {
  contactEnabled:  true,
  contactRadius:   18,
  contactStrength: 0.55,
  contactFalloff:  2.0,

  directionalEnabled: true,
  lightAngleDeg:      315,   // top-left light → shadow bottom-right
  shadowLength:       30,
  shadowStrength:     0.5,
  shadowSoftness:     0.35,
  shadowFalloff:      1.2,

  alphaThreshold: 10,
}

interface Props {
  /** URL of the cover image (background). Must be CORS-enabled. */
  coverImageUrl: string
  /** URL of the overlay PNG. Must be CORS-enabled. */
  overlayImageUrl: string
  /** Rendered width of the overlay in px (already scaled). */
  widthPx: number
  /** Rendered height of the overlay in px (already scaled). */
  heightPx: number
  /** Left offset of the overlay within the cover container (px). */
  leftPx: number
  /** Top offset of the overlay within the cover container (px). */
  topPx: number
  /** Width of the cover container in px. */
  containerWidthPx: number
  /** Height of the cover container in px. */
  containerHeightPx: number
  shadow: OverlayShadowConfig
  style?: React.CSSProperties
}

// ─────────────────────────────────────────────────────────────────────────────
// SDF computation — CPU, O(n), runs once per overlay image URL
// Uses 8-direction sequential scan (Meijster 8SSEDT approximation).
// Returns Float32Array: positive = outside (background), negative = inside (opaque).
// ─────────────────────────────────────────────────────────────────────────────

const sdfCache = new Map<string, Float32Array>()

function computeSDF(
  alphaData: Uint8ClampedArray,
  w: number,
  h: number,
  threshold: number,
): Float32Array {
  const INF = 1e7
  const n = w * h

  // Binary mask: true = opaque
  const opaque = new Uint8Array(n)
  for (let i = 0; i < n; i++) opaque[i] = alphaData[i * 4 + 3] > threshold ? 1 : 0

  // distanceTransform: for each 0-pixel, find nearest 1-pixel distance
  // Pass 0: get distance-to-opaque (for transparent pixels = "outside" distance)
  // Pass 1: get distance-to-transparent (for opaque pixels = "inside" distance)
  function edt(mask: Uint8Array, invert: boolean): Float32Array {
    const d = new Float32Array(n).fill(INF)

    // Forward scan
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const hit = invert ? mask[i] === 0 : mask[i] === 1
        if (hit) { d[i] = 0; continue }
        const u = y > 0 ? d[(y - 1) * w + x] : INF
        const l = x > 0 ? d[y * w + x - 1] : INF
        const ul = (x > 0 && y > 0) ? d[(y - 1) * w + x - 1] : INF
        const ur = (x < w - 1 && y > 0) ? d[(y - 1) * w + x + 1] : INF
        d[i] = Math.min(d[i], Math.sqrt(Math.min(
          (u + 1) ** 2,
          (l + 1) ** 2,
          ul + Math.SQRT2,
          ur + Math.SQRT2,
        )), Math.sqrt(u * u + 1), Math.sqrt(l * l + 1))
        // Simpler: Chebyshev + correction
        d[i] = Math.min(d[i], u + 1, l + 1, ul + 1.414, ur + 1.414)
      }
    }
    // Backward scan
    for (let y = h - 1; y >= 0; y--) {
      for (let x = w - 1; x >= 0; x--) {
        const i = y * w + x
        if (d[i] === 0) continue
        const dn = y < h - 1 ? d[(y + 1) * w + x] : INF
        const r  = x < w - 1 ? d[y * w + x + 1]   : INF
        const dl = (x > 0 && y < h - 1)     ? d[(y + 1) * w + x - 1] : INF
        const dr = (x < w - 1 && y < h - 1) ? d[(y + 1) * w + x + 1] : INF
        d[i] = Math.min(d[i], dn + 1, r + 1, dl + 1.414, dr + 1.414)
      }
    }
    return d
  }

  const dOut = edt(opaque, false) // distance for transparent pixels (outside)
  const dIn  = edt(opaque, true)  // distance for opaque pixels (inside)

  const sdf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    sdf[i] = opaque[i] ? -dIn[i] : dOut[i]
  }
  return sdf
}

// ─────────────────────────────────────────────────────────────────────────────
// React component
// ─────────────────────────────────────────────────────────────────────────────

export function OverlayShadowCanvas({
  coverImageUrl,
  overlayImageUrl,
  widthPx,
  heightPx,
  leftPx,
  topPx,
  containerWidthPx,
  containerHeightPx,
  shadow,
  style,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayBitmapRef = useRef<ImageBitmap | null>(null)
  const sdfRef           = useRef<Float32Array | null>(null)
  const lastOverlayUrl   = useRef('')

  const draw = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || widthPx < 1 || heightPx < 1) return

    canvas.width  = widthPx
    canvas.height = heightPx

    // ── Load cover image — no longer needed, shadow is SDF-only ─────────
    // (cover pixels are not sampled; darkening is applied via transparent overlay)

    // ── Load overlay image + compute SDF ──────────────────────────────────    if (overlayBitmapRef.current === null || lastOverlayUrl.current !== overlayImageUrl) {
      try {
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((res, rej) => {
          img.onload = () => res(); img.onerror = rej; img.src = overlayImageUrl
        })
        overlayBitmapRef.current = await createImageBitmap(img)
        lastOverlayUrl.current = overlayImageUrl

        // Extract alpha at overlay's natural resolution
        const ow = overlayBitmapRef.current.width
        const oh = overlayBitmapRef.current.height
        const cacheKey = overlayImageUrl + ':' + shadow.alphaThreshold
        if (!sdfCache.has(cacheKey)) {
          const tmp = document.createElement('canvas')
          tmp.width = ow; tmp.height = oh
          const tCtx = tmp.getContext('2d')!
          tCtx.drawImage(overlayBitmapRef.current, 0, 0)
          const pixels = tCtx.getImageData(0, 0, ow, oh).data
          sdfCache.set(cacheKey, computeSDF(pixels as Uint8ClampedArray, ow, oh, shadow.alphaThreshold))
        }
        sdfRef.current = sdfCache.get(cacheKey)!
      } catch (_e) { return }
    }

    const overlayBitmap = overlayBitmapRef.current!
    const sdf           = sdfRef.current!

    // Natural dimensions of overlay (SDF was computed at these)
    const natW = overlayBitmap.width
    const natH = overlayBitmap.height

    // ── Canvas 2D render ──────────────────────────────────────────────────
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    // Output canvas is TRANSPARENT — only the darkening pixels are drawn.
    // The cover <img> is already rendered below in the DOM stacking order.
    // CSS mix-blend-mode:'multiply' on the canvas handles the darkening compositing.
    ctx.clearRect(0, 0, widthPx, heightPx)

    // Build shadow darkness map at overlay's rendered size
    const shadowMap = ctx.createImageData(widthPx, heightPx)
    const sd = shadowMap.data

    // Light direction from angle
    const rad = (shadow.lightAngleDeg * Math.PI) / 180
    // lightDir points FROM light source (so shadow goes opposite)
    const ldx = Math.cos(rad)
    const ldy = Math.sin(rad)

    // Scale factor: rendered px → natural px (for SDF lookup)
    const rx = natW / widthPx
    const ry = natH / heightPx

    for (let py = 0; py < heightPx; py++) {
      for (let px = 0; px < widthPx; px++) {
        // Map rendered pixel → natural image coords
        const nx = (px + 0.5) * rx
        const ny = (py + 0.5) * ry
        const ni = Math.round(ny) * natW + Math.round(nx)

        const dist = ni >= 0 && ni < sdf.length ? sdf[ni] : 1e7
        // Skip pixels inside the opaque object
        if (dist <= 0) continue

        let darkness = 0

        // ── Contact shadow ──────────────────────────────────────────────
        if (shadow.contactEnabled && dist < shadow.contactRadius) {
          const t = dist / shadow.contactRadius
          darkness = Math.max(darkness,
            shadow.contactStrength * Math.pow(Math.max(0, 1 - t), shadow.contactFalloff))
        }

        // ── Directional shadow — ray march toward light ─────────────────
        if (shadow.directionalEnabled) {
          // Scale shadowLength from rendered px to natural px
          const natShadowLen = shadow.shadowLength * ((rx + ry) / 2)
          const steps = Math.ceil(natShadowLen)
          for (let s = 1; s <= steps; s++) {
            const t = s / steps
            // March from current nat pixel toward light (opposite light dir)
            const snx = nx - ldx * natShadowLen * t
            const sny = ny - ldy * natShadowLen * t
            const six = Math.round(snx)
            const siy = Math.round(sny)
            if (six < 0 || six >= natW || siy < 0 || siy >= natH) break
            const sd2 = sdf[siy * natW + six]
            if (sd2 <= 0) {
              // Pixel is in shadow
              // Penumbra: use how deep inside the occluder we are
              const depth = Math.min(1, -sd2 / Math.max(0.1, shadow.shadowSoftness * 20))
              const falloffFactor = Math.pow(1 - t, shadow.shadowFalloff)
              const occ = shadow.shadowStrength * (shadow.shadowSoftness > 0 ? depth : 1) *
                (1 - falloffFactor * 0.2)
              darkness = Math.max(darkness, occ)
              break
            }
          }
        }

        if (darkness <= 0) continue

        // Store darkening amount as black pixels with alpha = darkness.
        // The canvas uses mix-blend-mode: multiply in CSS, so these black pixels
        // will darken whatever is rendered below (the cover image).
        const idx = (py * widthPx + px) * 4
        sd[idx]     = 0
        sd[idx + 1] = 0
        sd[idx + 2] = 0
        sd[idx + 3] = Math.round(Math.min(1, darkness) * 255)
      }
    }

    // Draw the shadow map directly onto the transparent canvas.
    // CSS mix-blend-mode: multiply on the canvas element handles darkening.
    ctx.putImageData(shadowMap, 0, 0)

    // Draw the original overlay on top inside the canvas (z-index 1 on the img handles this in DOM)
  }, [
    overlayImageUrl,
    widthPx, heightPx,
    shadow,
  ])

  useEffect(() => { draw() }, [draw])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        mixBlendMode: 'multiply',
        zIndex: 0,
        ...style,
      }}
    />
      }}
    />
  )
}
