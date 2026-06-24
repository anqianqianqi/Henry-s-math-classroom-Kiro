'use client'
/**
 * OverlayShadowCanvas — SDF-based contact shadow + directional shadow for overlay PNGs.
 *
 * Key guarantee: the AO boundary is the ORIGINAL alpha silhouette of the PNG.
 * No dilation, no bounding box, no padded outline is used as the occluder.
 *
 * The SDF stores:
 *   positive value → distance (in natural image px) from this pixel to the
 *                    nearest opaque (alpha >= 128) pixel outward.
 *   negative / zero → this pixel is inside the opaque region.
 *
 * Contact shadow formula (for background pixels only, i.e. dist > 0):
 *   ao = contactStrength × clamp(1 − dist / contactRadius, 0, 1) ^ contactFalloff
 *   output.rgb *= 1 − ao
 */

import { useEffect, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type OverlayShadowConfig = {
  contactEnabled:    boolean
  contactRadius:     number   // px (in natural image space, ~1024px reference)
  contactStrength:   number   // 0–1
  contactFalloff:    number   // > 0

  directionalEnabled: boolean
  lightAngleDeg:      number
  shadowLength:       number   // px (natural image space)
  shadowStrength:     number   // 0–1
  shadowSoftness:     number   // 0–1
  shadowFalloff:      number   // > 0

  alphaThreshold: number  // unused — always 128 internally
}

export const DEFAULT_OVERLAY_SHADOW: OverlayShadowConfig = {
  contactEnabled:  true,
  contactRadius:   30,
  contactStrength: 0.55,
  contactFalloff:  2.0,

  directionalEnabled: true,
  lightAngleDeg:      315,
  shadowLength:       40,
  shadowStrength:     0.5,
  shadowSoftness:     0.35,
  shadowFalloff:      1.2,

  alphaThreshold: 128,  // kept for API compat, always 128 internally
}

interface Props {
  coverImageUrl:     string  // kept for API compat, not used
  overlayImageUrl:   string
  widthPx:           number
  heightPx:          number
  leftPx:            number
  topPx:             number
  containerWidthPx:  number
  containerHeightPx: number
  shadow:            OverlayShadowConfig
  style?:            React.CSSProperties
}

// ─────────────────────────────────────────────────────────────────────────────
// SDF computation
//
// Uses ONLY the original alpha channel as the occluder mask.
// "Opaque" = alpha >= 128.  No dilation.
//
// Returns Float32Array where:
//   value > 0 : outside the silhouette, distance in natural px to nearest opaque edge
//   value <= 0 : inside or on the silhouette
// ─────────────────────────────────────────────────────────────────────────────

const ALPHA_THRESHOLD = 128  // hard-wired, never exposed as a variable

const sdfCache = new Map<string, Float32Array>()

function computeSDF(alphaData: Uint8ClampedArray, w: number, h: number): Float32Array {
  const INF = 1e7
  const n   = w * h

  // opaque[i] === 1 if alpha >= 128, else 0
  const opaque = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    opaque[i] = alphaData[i * 4 + 3] >= ALPHA_THRESHOLD ? 1 : 0
  }

  /**
   * 2-pass Chebyshev EDT.
   * When `invertMask` is false: computes distance from transparent→nearest opaque (dOut).
   * When `invertMask` is true:  computes distance from opaque→nearest transparent (dIn).
   */
  function edt(invertMask: boolean): Float32Array {
    const d = new Float32Array(n).fill(INF)
    // Forward scan (top-left → bottom-right)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i   = y * w + x
        // Hit = the pixel we want distance FROM (source class)
        const hit = invertMask ? opaque[i] === 0 : opaque[i] === 1
        if (hit) { d[i] = 0; continue }
        const u  = y > 0           ? d[(y - 1) * w + x]       : INF
        const l  = x > 0           ? d[y * w + x - 1]         : INF
        const ul = (x > 0 && y > 0) ? d[(y - 1) * w + x - 1] : INF
        const ur = (x < w-1 && y > 0) ? d[(y - 1) * w + x+1] : INF
        d[i] = Math.min(d[i], u + 1, l + 1, ul + 1.414, ur + 1.414)
      }
    }
    // Backward scan (bottom-right → top-left)
    for (let y = h - 1; y >= 0; y--) {
      for (let x = w - 1; x >= 0; x--) {
        const i  = y * w + x
        if (d[i] === 0) continue
        const dn = y < h-1             ? d[(y + 1) * w + x]       : INF
        const r  = x < w-1             ? d[y * w + x + 1]         : INF
        const dl = (x > 0 && y < h-1) ? d[(y + 1) * w + x - 1]  : INF
        const dr = (x < w-1 && y < h-1) ? d[(y + 1) * w + x + 1] : INF
        d[i] = Math.min(d[i], dn + 1, r + 1, dl + 1.414, dr + 1.414)
      }
    }
    return d
  }

  // dOut[i] = distance from pixel i to nearest OPAQUE pixel (for transparent pixels)
  // dIn[i]  = distance from pixel i to nearest TRANSPARENT pixel (for opaque pixels)
  const dOut = edt(false)
  const dIn  = edt(true)

  const sdf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    // Positive outside (transparent region), negative/zero inside (opaque region)
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

    // ── When URL changes, flush stale refs immediately so we never render
    //    a previous object's shadow while the new one is loading.
    if (lastOverlayUrl.current !== overlayImageUrl) {
      overlayBitmapRef.current = null
      sdfRef.current           = null
      lastOverlayUrl.current   = overlayImageUrl
      // Clear canvas so nothing old shows
      const ctx2 = canvas.getContext('2d')
      ctx2?.clearRect(0, 0, widthPx, heightPx)
    }

    // ── Load overlay image ─────────────────────────────────────────────────
    if (!overlayBitmapRef.current) {
      try {
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((res, rej) => {
          img.onload  = () => res()
          img.onerror = rej
          img.src     = overlayImageUrl
        })
        overlayBitmapRef.current = await createImageBitmap(img)
      } catch (_e) {
        return
      }
    }

    // ── Compute / retrieve SDF ─────────────────────────────────────────────
    // Cache key includes URL — no threshold suffix since threshold is always 128.
    if (!sdfRef.current) {
      const cacheKey = overlayImageUrl
      if (sdfCache.has(cacheKey)) {
        sdfRef.current = sdfCache.get(cacheKey)!
      } else {
        const bmp = overlayBitmapRef.current!
        const ow  = bmp.width
        const oh  = bmp.height
        const tmp = document.createElement('canvas')
        tmp.width = ow; tmp.height = oh
        const tCtx = tmp.getContext('2d')!
        tCtx.drawImage(bmp, 0, 0)
        const pixels = tCtx.getImageData(0, 0, ow, oh).data
        const sdf    = computeSDF(pixels as Uint8ClampedArray, ow, oh)
        sdfCache.set(cacheKey, sdf)
        sdfRef.current = sdf
      }
    }

    const overlayBitmap = overlayBitmapRef.current!
    const sdf           = sdfRef.current!
    const natW          = overlayBitmap.width
    const natH          = overlayBitmap.height

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    // Output canvas is TRANSPARENT.  Only darkness pixels are written.
    // CSS mix-blend-mode: multiply composites these over the cover below.
    ctx.clearRect(0, 0, widthPx, heightPx)

    const imgData = ctx.createImageData(widthPx, heightPx)
    const d       = imgData.data

    // Light direction (from the light source, shadow cast opposite)
    const rad = (shadow.lightAngleDeg * Math.PI) / 180
    const ldx = Math.cos(rad)
    const ldy = Math.sin(rad)

    // Scale: rendered pixel → natural image pixel
    const rx = natW / widthPx
    const ry = natH / heightPx

    for (let py = 0; py < heightPx; py++) {
      for (let px2 = 0; px2 < widthPx; px2++) {
        // Map rendered pixel centre to natural image space
        const nx = (px2 + 0.5) * rx
        const ny = (py + 0.5) * ry
        const ni = Math.round(ny) * natW + Math.round(nx)

        const dist = (ni >= 0 && ni < sdf.length) ? sdf[ni] : 1e7

        // dist > 0  → background pixel (outside the opaque silhouette)
        // dist <= 0 → inside the opaque object — never darken these
        if (dist <= 0) continue

        let darkness = 0

        // ── Contact / AO shadow ──────────────────────────────────────────
        // ao = contactStrength × clamp(1 − dist/radius, 0, 1)^falloff
        if (shadow.contactEnabled && dist < shadow.contactRadius) {
          const t  = dist / shadow.contactRadius          // 0 at edge, 1 at radius
          const ao = shadow.contactStrength * Math.pow(Math.max(0, 1 - t), shadow.contactFalloff)
          if (ao > darkness) darkness = ao
        }

        // ── Directional shadow — ray march toward light ──────────────────
        if (shadow.directionalEnabled) {
          const natShadowLen = shadow.shadowLength * ((rx + ry) / 2)
          const steps        = Math.ceil(natShadowLen)
          for (let s = 1; s <= steps; s++) {
            const t   = s / steps
            const snx = nx - ldx * natShadowLen * t
            const sny = ny - ldy * natShadowLen * t
            const six = Math.round(snx)
            const siy = Math.round(sny)
            if (six < 0 || six >= natW || siy < 0 || siy >= natH) break
            const sd2 = sdf[siy * natW + six]
            if (sd2 <= 0) {
              // This pixel is occluded from the light
              const depth   = shadow.shadowSoftness > 0
                ? Math.min(1, -sd2 / Math.max(0.1, shadow.shadowSoftness * 20))
                : 1
              const falloff = Math.pow(1 - t, shadow.shadowFalloff)
              const occ     = shadow.shadowStrength * depth * (1 - falloff * 0.2)
              if (occ > darkness) darkness = occ
              break
            }
          }
        }

        if (darkness <= 0) continue

        const idx  = (py * widthPx + px2) * 4
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
        position:       'absolute',
        inset:          0,
        width:          '100%',
        height:         '100%',
        pointerEvents:  'none',
        mixBlendMode:   'multiply',
        zIndex:         0,
        ...style,
      }}
    />
  )
}
