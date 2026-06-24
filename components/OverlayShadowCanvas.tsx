'use client'
/**
 * OverlayShadowCanvas — SDF-based physical shadow for transparent overlay PNGs.
 *
 * Renders a transparent canvas with multiply-blend darkening pixels.
 * The canvas sits between the cover <img> and the overlay <img> in z-order.
 * CSS mix-blend-mode:'multiply' makes the black pixels darken whatever is below.
 *
 * Pipeline:
 *   1. Load overlay PNG, extract alpha channel.
 *   2. Compute SDF (Signed Distance Field): positive = outside, negative = inside.
 *   3. For each pixel in the overlay bounding box:
 *      a. Contact shadow: darken pixels close to the silhouette boundary.
 *      b. Directional shadow: ray-march toward light; darken pixels that are
 *         occluded by the opaque silhouette.
 *   4. Write darkening map to canvas (transparent background, black at alpha=darkness).
 *   5. mix-blend-mode:multiply composites the darkening over the cover image.
 */

import { useEffect, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type OverlayShadowConfig = {
  contactEnabled:    boolean
  contactRadius:     number   // px spread
  contactStrength:   number   // 0–1
  contactFalloff:    number   // >0, higher = faster decay

  directionalEnabled: boolean
  lightAngleDeg:      number   // 0=right 90=down 180=left 270=up
  shadowLength:       number   // px
  shadowStrength:     number   // 0–1
  shadowSoftness:     number   // 0–1 penumbra
  shadowFalloff:      number   // >0

  alphaThreshold: number  // 0–255
}

export const DEFAULT_OVERLAY_SHADOW: OverlayShadowConfig = {
  contactEnabled:  true,
  contactRadius:   18,
  contactStrength: 0.55,
  contactFalloff:  2.0,

  directionalEnabled: true,
  lightAngleDeg:      315,
  shadowLength:       30,
  shadowStrength:     0.5,
  shadowSoftness:     0.35,
  shadowFalloff:      1.2,

  alphaThreshold: 10,
}

interface Props {
  coverImageUrl:      string  // kept in props for API compat but not sampled
  overlayImageUrl:    string
  widthPx:            number
  heightPx:           number
  leftPx:             number
  topPx:              number
  containerWidthPx:   number
  containerHeightPx:  number
  shadow:             OverlayShadowConfig
  style?:             React.CSSProperties
}

// ─────────────────────────────────────────────────────────────────────────────
// SDF computation — CPU, runs once per overlay URL
// 2-pass Chebyshev distance transform (O(n))
// Returns Float32Array: positive = outside silhouette, negative = inside
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
  const opaque = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    opaque[i] = alphaData[i * 4 + 3] > threshold ? 1 : 0
  }

  function edt(invert: boolean): Float32Array {
    const d = new Float32Array(n).fill(INF)
    // Forward scan
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const hit = invert ? opaque[i] === 0 : opaque[i] === 1
        if (hit) { d[i] = 0; continue }
        const u  = y > 0           ? d[(y - 1) * w + x]     : INF
        const l  = x > 0           ? d[y * w + x - 1]       : INF
        const ul = x > 0 && y > 0  ? d[(y - 1) * w + x - 1] : INF
        const ur = x < w - 1 && y > 0 ? d[(y - 1) * w + x + 1] : INF
        d[i] = Math.min(d[i], u + 1, l + 1, ul + 1.414, ur + 1.414)
      }
    }
    // Backward scan
    for (let y = h - 1; y >= 0; y--) {
      for (let x = w - 1; x >= 0; x--) {
        const i = y * w + x
        if (d[i] === 0) continue
        const dn = y < h - 1             ? d[(y + 1) * w + x]     : INF
        const r  = x < w - 1             ? d[y * w + x + 1]       : INF
        const dl = x > 0 && y < h - 1   ? d[(y + 1) * w + x - 1] : INF
        const dr = x < w - 1 && y < h - 1 ? d[(y + 1) * w + x + 1] : INF
        d[i] = Math.min(d[i], dn + 1, r + 1, dl + 1.414, dr + 1.414)
      }
    }
    return d
  }

  const dOut = edt(false)
  const dIn  = edt(true)
  const sdf  = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    sdf[i] = opaque[i] ? -dIn[i] : dOut[i]
  }
  return sdf
}

// ─────────────────────────────────────────────────────────────────────────────
// React component
// ─────────────────────────────────────────────────────────────────────────────

export function OverlayShadowCanvas({
  overlayImageUrl,
  widthPx,
  heightPx,
  shadow,
  style,
}: Props) {
  const canvasRef        = useRef<HTMLCanvasElement>(null)
  const overlayBitmapRef = useRef<ImageBitmap | null>(null)
  const sdfRef           = useRef<Float32Array | null>(null)
  const lastOverlayUrl   = useRef('')

  const draw = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || widthPx < 1 || heightPx < 1) return

    canvas.width  = widthPx
    canvas.height = heightPx

    // Load overlay image and compute SDF (cached by URL)
    if (overlayBitmapRef.current === null || lastOverlayUrl.current !== overlayImageUrl) {
      try {
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((res, rej) => {
          img.onload = () => res()
          img.onerror = rej
          img.src = overlayImageUrl
        })
        overlayBitmapRef.current = await createImageBitmap(img)
        lastOverlayUrl.current = overlayImageUrl

        const ow = overlayBitmapRef.current.width
        const oh = overlayBitmapRef.current.height
        const cacheKey = overlayImageUrl + ':' + shadow.alphaThreshold
        if (!sdfCache.has(cacheKey)) {
          const tmp = document.createElement('canvas')
          tmp.width = ow
          tmp.height = oh
          const tCtx = tmp.getContext('2d')!
          tCtx.drawImage(overlayBitmapRef.current, 0, 0)
          const pixels = tCtx.getImageData(0, 0, ow, oh).data
          sdfCache.set(cacheKey, computeSDF(pixels as Uint8ClampedArray, ow, oh, shadow.alphaThreshold))
        }
        sdfRef.current = sdfCache.get(cacheKey)!
      } catch (_e) {
        return
      }
    }

    const overlayBitmap = overlayBitmapRef.current
    const sdf = sdfRef.current
    if (!overlayBitmap || !sdf) return

    const natW = overlayBitmap.width
    const natH = overlayBitmap.height

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    // Canvas is transparent — only darkness pixels are written.
    // mix-blend-mode:multiply on the canvas element darkens the cover below.
    ctx.clearRect(0, 0, widthPx, heightPx)

    const imgData = ctx.createImageData(widthPx, heightPx)
    const d = imgData.data

    // Light direction from angle (FROM light source, so shadow goes opposite)
    const rad = (shadow.lightAngleDeg * Math.PI) / 180
    const ldx = Math.cos(rad)
    const ldy = Math.sin(rad)

    // Scale: rendered px → natural image px
    const rx = natW / widthPx
    const ry = natH / heightPx

    for (let py = 0; py < heightPx; py++) {
      for (let px2 = 0; px2 < widthPx; px2++) {
        const nx = (px2 + 0.5) * rx
        const ny = (py + 0.5) * ry
        const ni = Math.round(ny) * natW + Math.round(nx)
        const dist = (ni >= 0 && ni < sdf.length) ? sdf[ni] : 1e7

        // Skip pixels inside the opaque object (don't darken those)
        if (dist <= 0) continue

        let darkness = 0

        // Contact shadow
        if (shadow.contactEnabled && dist < shadow.contactRadius) {
          const t = dist / shadow.contactRadius
          const c = shadow.contactStrength * Math.pow(Math.max(0, 1 - t), shadow.contactFalloff)
          if (c > darkness) darkness = c
        }

        // Directional shadow — ray march toward light
        if (shadow.directionalEnabled) {
          const natShadowLen = shadow.shadowLength * ((rx + ry) / 2)
          const steps = Math.ceil(natShadowLen)
          for (let s = 1; s <= steps; s++) {
            const t = s / steps
            const snx = nx - ldx * natShadowLen * t
            const sny = ny - ldy * natShadowLen * t
            const six = Math.round(snx)
            const siy = Math.round(sny)
            if (six < 0 || six >= natW || siy < 0 || siy >= natH) break
            const sd2 = sdf[siy * natW + six]
            if (sd2 <= 0) {
              const depth = shadow.shadowSoftness > 0
                ? Math.min(1, -sd2 / Math.max(0.1, shadow.shadowSoftness * 20))
                : 1
              const falloff = Math.pow(1 - t, shadow.shadowFalloff)
              const occ = shadow.shadowStrength * depth * (1 - falloff * 0.2)
              if (occ > darkness) darkness = occ
              break
            }
          }
        }

        if (darkness <= 0) continue

        const idx = (py * widthPx + px2) * 4
        d[idx]     = 0
        d[idx + 1] = 0
        d[idx + 2] = 0
        d[idx + 3] = Math.round(Math.min(1, darkness) * 255)
      }
    }

    ctx.putImageData(imgData, 0, 0)
  }, [overlayImageUrl, widthPx, heightPx, shadow])

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
  )
}
