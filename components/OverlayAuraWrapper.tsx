'use client'
/**
 * OverlayAuraWrapper — canvas-based boundary darkening using the overlay's own alpha
 *
 * The overlay PNG already encodes the perfect darkening decay:
 *   - Fully opaque pixels (α=255): the jar itself → show nothing (jar <img> renders on top)
 *   - Semi-transparent pixels (0<α<255): the shadow zone → darken the cover by α/255 × strength
 *   - Fully transparent pixels (α=0): far from the jar → no darkening
 *
 * This uses the AI-generated shadow as the decay function directly.
 * No distance calculation needed. Canvas is exactly objSizePx × objSizePx.
 */

import { useEffect, useRef, useState } from 'react'

interface OverlayAuraWrapperProps {
  overlayImageUrl: string
  coverImageUrl: string
  xPct: number
  yPct: number
  widthPct: string        // e.g. "7.8%"
  auraStrength?: number  // multiply the shadow alpha by this (0–2, default 1.0)
  containerWidthPx?: number
  style?: React.CSSProperties
  children: React.ReactNode
}

export function OverlayAuraWrapper({
  overlayImageUrl,
  coverImageUrl,
  xPct, yPct,
  widthPct,
  auraStrength = 1.0,
  containerWidthPx = 480,
  style,
  children,
}: OverlayAuraWrapperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const coverImgRef = useRef<HTMLImageElement | null>(null)
  const overlayImgRef = useRef<HTMLImageElement | null>(null)
  const [tick, setTick] = useState(0)

  const widthFrac = parseFloat(widthPct) / 100
  const objSizePx = Math.max(4, Math.round(containerWidthPx * widthFrac))

  // Load both images
  useEffect(() => {
    let n = 0
    function done() { if (++n === 2) setTick(t => t + 1) }

    const c = new window.Image(); c.crossOrigin = 'anonymous'
    c.onload = () => { coverImgRef.current = c; done() }
    c.onerror = done; c.src = coverImageUrl

    const o = new window.Image(); o.crossOrigin = 'anonymous'
    o.onload = () => { overlayImgRef.current = o; done() }
    o.onerror = done; o.src = overlayImageUrl
  }, [coverImageUrl, overlayImageUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !coverImgRef.current || !overlayImgRef.current) return

    canvas.width = objSizePx
    canvas.height = objSizePx
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, objSizePx, objSizePx)

    if (auraStrength <= 0) return

    const coverImg = coverImgRef.current
    const overlayImg = overlayImgRef.current

    // ── 1. Sample the cover pixels under this overlay region ─────────────────
    const coverNW = coverImg.naturalWidth
    const coverNH = coverImg.naturalHeight
    const renderW = containerWidthPx
    const renderH = Math.round(coverNH * (renderW / coverNW))

    const anchorPx = (xPct / 100) * renderW
    const anchorPy = (yPct / 100) * renderH

    const tlX = anchorPx - objSizePx / 2
    const tlY = anchorPy - objSizePx / 2

    const sx = Math.round(tlX * coverNW / renderW)
    const sy = Math.round(tlY * coverNH / renderH)
    const sw = Math.round(objSizePx * coverNW / renderW)
    const sh = Math.round(objSizePx * coverNH / renderH)

    // Clamp source rectangle to valid cover image bounds to avoid black edges
    const clampedSx = Math.max(0, Math.min(coverNW - 1, sx))
    const clampedSy = Math.max(0, Math.min(coverNH - 1, sy))
    const clampedSw = Math.max(1, Math.min(coverNW - clampedSx, sw))
    const clampedSh = Math.max(1, Math.min(coverNH - clampedSy, sh))
    // Destination offset on canvas (if source was clamped)
    const dstOffX = Math.round((clampedSx - sx) * objSizePx / sw)
    const dstOffY = Math.round((clampedSy - sy) * objSizePx / sh)
    const dstW = Math.round(clampedSw * objSizePx / sw)
    const dstH = Math.round(clampedSh * objSizePx / sh)

    ctx.drawImage(coverImg, clampedSx, clampedSy, clampedSw, clampedSh, dstOffX, dstOffY, dstW, dstH)

    // ── 2. Read the overlay alpha map ─────────────────────────────────────────
    const offscreen = document.createElement('canvas')
    offscreen.width = objSizePx; offscreen.height = objSizePx
    const offCtx = offscreen.getContext('2d')!
    offCtx.drawImage(overlayImg, 0, 0, objSizePx, objSizePx)
    const oPx = offCtx.getImageData(0, 0, objSizePx, objSizePx).data

    // ── 3. For each pixel: use overlay alpha as the darkening weight ──────────
    const imgData = ctx.getImageData(0, 0, objSizePx, objSizePx)
    const d = imgData.data

    for (let i = 0; i < objSizePx * objSizePx; i++) {
      const overlayAlpha = oPx[i * 4 + 3]  // 0–255

      if (overlayAlpha >= 250) {
        // Fully opaque: jar pixel — make canvas transparent so jar <img> shows through
        d[i * 4 + 3] = 0
        continue
      }

      if (overlayAlpha === 0) {
        // Fully transparent: no shadow here, no darkening
        d[i * 4 + 3] = 0
        continue
      }

      // Semi-transparent shadow pixel: darken the cover proportionally
      // darken = (overlayAlpha / 255) * auraStrength, clamped to [0, 1]
      const darken = Math.min(1, (overlayAlpha / 255) * auraStrength)

      d[i * 4]     = Math.round(d[i * 4]     * (1 - darken))
      d[i * 4 + 1] = Math.round(d[i * 4 + 1] * (1 - darken))
      d[i * 4 + 2] = Math.round(d[i * 4 + 2] * (1 - darken))
      d[i * 4 + 3] = 255  // fully opaque — show the darkened cover
    }

    // ── 4. Fade canvas edges to transparent so canvas boundary is invisible ──
    // Apply a soft margin so the canvas blends into the surrounding cover.
    const edgeFadeMarginPx = Math.round(objSizePx * 0.08)  // 8% of object size
    for (let y = 0; y < objSizePx; y++) {
      for (let x = 0; x < objSizePx; x++) {
        const idx = (y * objSizePx + x) * 4
        if (d[idx + 3] === 0) continue  // skip transparent pixels
        // Distance from each edge
        const distLeft   = x
        const distRight  = objSizePx - 1 - x
        const distTop    = y
        const distBottom = objSizePx - 1 - y
        const minEdgeDist = Math.min(distLeft, distRight, distTop, distBottom)
        if (minEdgeDist < edgeFadeMarginPx) {
          const fade = minEdgeDist / edgeFadeMarginPx  // 0 at edge, 1 inside
          d[idx + 3] = Math.round(d[idx + 3] * fade)
        }
      }
    }

    ctx.putImageData(imgData, 0, 0)
  }, [tick, xPct, yPct, widthFrac, auraStrength, containerWidthPx, objSizePx])

  return (
    <div style={{
      position: 'absolute', left: `${xPct}%`, top: `${yPct}%`,
      transform: 'translate(-50%,-50%)', width: widthPct, height: widthPct,
      ...style
    }}>
      {/* Aura canvas: exactly the same size as the overlay box */}
      {auraStrength > 0 && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 0,
            outline: 'none',
          }}
        />
      )}
      {/* Overlay image on top */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}
