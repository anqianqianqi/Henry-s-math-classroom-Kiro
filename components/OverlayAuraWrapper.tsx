'use client'
/**
 * OverlayAuraWrapper — canvas-based boundary darkening aura
 *
 * For each pixel in the canvas region (cover + aura margin):
 *   - Object pixel (overlay alpha > 30):     alpha = 0 — object image renders on top
 *   - Cover pixel within auraDistance:       darken cover RGB proportional to proximity
 *                                            distance=0 (boundary) → max darkening
 *                                            distance=auraDistance → no darkening (alpha=0)
 *   - Cover pixel outside auraDistance:      alpha = 0 — invisible, hides canvas edge
 *
 * Canvas extends `auraDistance` px beyond the object bounding box on all sides
 * so the aura is visible outside the object silhouette.
 */

import { useEffect, useRef, useState } from 'react'

interface OverlayAuraWrapperProps {
  overlayImageUrl: string
  coverImageUrl: string
  xPct: number
  yPct: number
  widthPct: string        // e.g. "7.8%"
  auraDistance?: number  // px (default 16)
  auraStrength?: number  // darkening 0–1 (default 0.5)
  containerWidthPx?: number
  style?: React.CSSProperties
  children: React.ReactNode
}

export function OverlayAuraWrapper({
  overlayImageUrl,
  coverImageUrl,
  xPct, yPct,
  widthPct,
  auraDistance = 16,
  auraStrength = 0.5,
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
  const pad = Math.ceil(auraDistance)
  const canvasW = objSizePx + pad * 2
  const canvasH = canvasW

  // Load both images
  useEffect(() => {
    let n = 0
    function done() { if (++n === 2) setTick(t => t + 1) }

    const c = new window.Image(); c.crossOrigin = 'anonymous'
    c.onload = () => { coverImgRef.current = c; done() }
    c.onerror = done
    c.src = coverImageUrl

    const o = new window.Image(); o.crossOrigin = 'anonymous'
    o.onload = () => { overlayImgRef.current = o; done() }
    o.onerror = done
    o.src = overlayImageUrl
  }, [coverImageUrl, overlayImageUrl])

  // Redraw when images load or params change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !coverImgRef.current || !overlayImgRef.current) return

    canvas.width = canvasW
    canvas.height = canvasH
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvasW, canvasH)

    if (auraStrength <= 0 || auraDistance <= 0) return

    const coverImg = coverImgRef.current
    const overlayImg = overlayImgRef.current

    // ── 1. Sample cover pixels for the full canvas region (obj + pad on all sides) ──
    const coverNW = coverImg.naturalWidth
    const coverNH = coverImg.naturalHeight
    const renderW = containerWidthPx
    const renderH = Math.round(coverNH * (renderW / coverNW))

    // Anchor in rendered px
    const anchorPx = (xPct / 100) * renderW
    const anchorPy = (yPct / 100) * renderH

    // Top-left of the canvas in rendered px
    const tlX = anchorPx - objSizePx / 2 - pad
    const tlY = anchorPy - objSizePx / 2 - pad

    // Source rectangle in cover image pixels
    const sx = Math.round(tlX * coverNW / renderW)
    const sy = Math.round(tlY * coverNH / renderH)
    const sw = Math.round(canvasW * coverNW / renderW)
    const sh = Math.round(canvasH * coverNH / renderH)

    ctx.drawImage(coverImg, sx, sy, sw, sh, 0, 0, canvasW, canvasH)

    // ── 2. Read overlay alpha at objSizePx resolution ─────────────────────────
    const offscreen = document.createElement('canvas')
    offscreen.width = objSizePx; offscreen.height = objSizePx
    const offCtx = offscreen.getContext('2d')!
    offCtx.drawImage(overlayImg, 0, 0, objSizePx, objSizePx)
    const oPx = offCtx.getImageData(0, 0, objSizePx, objSizePx).data

    // Helper: overlay alpha at overlay-space coords
    function oAlpha(ox: number, oy: number): number {
      const ix = Math.round(ox), iy = Math.round(oy)
      if (ix < 0 || ix >= objSizePx || iy < 0 || iy >= objSizePx) return 0
      return oPx[(iy * objSizePx + ix) * 4 + 3]
    }

    // ── 3. Process each canvas pixel ─────────────────────────────────────────
    const imgData = ctx.getImageData(0, 0, canvasW, canvasH)
    const d = imgData.data
    const searchR = Math.min(pad, 16)

    for (let cy = 0; cy < canvasH; cy++) {
      for (let cx = 0; cx < canvasW; cx++) {
        // Map canvas pixel → overlay-image-space coords
        const ox = cx - pad   // overlay x
        const oy = cy - pad   // overlay y

        const i = (cy * canvasW + cx) * 4

        // Is this pixel inside the object silhouette?
        if (oAlpha(ox, oy) > 30) {
          // Object pixel → fully transparent (the overlay <img> draws here)
          d[i + 3] = 0
          continue
        }

        // Cover pixel — find distance to nearest opaque object pixel
        let minDist = pad + 1
        for (let dy = -searchR; dy <= searchR && minDist > 0.5; dy++) {
          for (let dx = -searchR; dx <= searchR; dx++) {
            if (oAlpha(ox + dx, oy + dy) > 30) {
              const dist = Math.sqrt(dx * dx + dy * dy)
              if (dist < minDist) minDist = dist
            }
          }
        }

        if (minDist > auraDistance) {
          // Outside aura range → fully transparent (eliminates rectangular canvas edge)
          d[i + 3] = 0
          continue
        }

        // Within aura range: darken the cover pixel
        // t = 1 at boundary (minDist=0), t = 0 at auraDistance
        const t = Math.max(0, 1 - minDist / auraDistance)
        const darken = t * t * auraStrength  // quadratic decay

        d[i]     = Math.round(d[i]     * (1 - darken))
        d[i + 1] = Math.round(d[i + 1] * (1 - darken))
        d[i + 2] = Math.round(d[i + 2] * (1 - darken))
        // Alpha: fully opaque so the darkened cover shows — the object's <img> clips over it
        d[i + 3] = 255
      }
    }

    ctx.putImageData(imgData, 0, 0)
  }, [tick, xPct, yPct, widthFrac, auraDistance, auraStrength, containerWidthPx, canvasW, canvasH, objSizePx, pad])

  return (
    <div style={{
      position: 'absolute', left: `${xPct}%`, top: `${yPct}%`,
      transform: 'translate(-50%,-50%)', width: widthPct, height: widthPct,
      ...style
    }}>
      {/* Aura canvas: extends beyond object box by `pad` on all sides */}
      {auraStrength > 0 && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            left: `${-pad}px`,
            top: `${-pad}px`,
            width: `calc(100% + ${pad * 2}px)`,
            height: `calc(100% + ${pad * 2}px)`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      {/* Overlay object renders on top of the aura canvas */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}
