'use client'
/**
 * OverlayAuraWrapper — canvas-based boundary darkening aura
 *
 * Renders a canvas that extends BEYOND the overlay object's bounding box.
 * The canvas:
 *   1. Loads the overlay object image to find the actual object silhouette
 *   2. For pixels OUTSIDE the object (transparent in the overlay PNG),
 *      applies a darkening to the cover background proportional to
 *      proximity to the nearest opaque object pixel
 *   3. Pixels AT the object boundary get maximum darkening
 *   4. Darkening fades to transparent over `auraDistance` pixels outward
 *
 * The result looks like the soft dark mist seen on baked-in book cover assets.
 *
 * The canvas is positioned larger than the overlay — it extends outward by
 * `auraDistance` px on all sides.
 */

import { useEffect, useRef, useState } from 'react'

interface OverlayAuraWrapperProps {
  /** The overlay object image URL — used to read its alpha silhouette */
  overlayImageUrl: string
  /** Cover image URL — used to sample cover pixels for the aura region */
  coverImageUrl: string
  /** Anchor position as % of cover container */
  xPct: number
  yPct: number
  /** Overlay rendered width as % string, e.g. "7.8%" */
  widthPct: string
  /** How far the aura extends outward from the object boundary in px (at rendered size) */
  auraDistance?: number
  /** Darkening strength 0–1 (default 0.5) */
  auraStrength?: number
  /** Rendered width of cover container in px */
  containerWidthPx?: number
  style?: React.CSSProperties
  children: React.ReactNode
}

export function OverlayAuraWrapper({
  overlayImageUrl,
  coverImageUrl,
  xPct,
  yPct,
  widthPct,
  auraDistance = 20,
  auraStrength = 0.5,
  containerWidthPx = 480,
  style,
  children,
}: OverlayAuraWrapperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const coverImgRef = useRef<HTMLImageElement | null>(null)
  const overlayImgRef = useRef<HTMLImageElement | null>(null)
  const [bothLoaded, setBothLoaded] = useState(false)

  const widthFrac = parseFloat(widthPct) / 100
  const objSizePx = Math.round(containerWidthPx * widthFrac)
  // Canvas is larger: object size + aura margin on all sides
  const canvasSize = objSizePx + auraDistance * 2

  // Load both images
  useEffect(() => {
    if (!coverImageUrl || !overlayImageUrl) return
    let coverDone = false, overlayDone = false
    function checkDone() { if (coverDone && overlayDone) setBothLoaded(true) }

    const cImg = new window.Image(); cImg.crossOrigin = 'anonymous'
    cImg.onload = () => { coverImgRef.current = cImg; coverDone = true; checkDone() }
    cImg.onerror = () => { coverDone = true; checkDone() }
    cImg.src = coverImageUrl

    const oImg = new window.Image(); oImg.crossOrigin = 'anonymous'
    oImg.onload = () => { overlayImgRef.current = oImg; overlayDone = true; checkDone() }
    oImg.onerror = () => { overlayDone = true; checkDone() }
    oImg.src = overlayImageUrl
  }, [coverImageUrl, overlayImageUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !bothLoaded) return
    if (auraStrength <= 0 || auraDistance <= 0) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    const coverImg = coverImgRef.current
    const overlayImg = overlayImgRef.current
    if (!coverImg || !overlayImg) return

    canvas.width = canvasSize
    canvas.height = canvasSize
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvasSize, canvasSize)

    // ── Step 1: Draw the cover region under + around this overlay ──────────────
    // The canvas is (objSizePx + 2*auraDistance) square, centered on the anchor.
    // Map canvas pixel (0,0) = anchor - (objSizePx/2 + auraDistance) in rendered px.

    const coverW = coverImg.naturalWidth
    const coverH = coverImg.naturalHeight
    const renderW = containerWidthPx
    const renderH = Math.round(coverH * (renderW / coverW))

    const anchorPx = (xPct / 100) * renderW
    const anchorPy = (yPct / 100) * renderH

    // Top-left of the CANVAS in rendered cover px (includes aura margin)
    const canvasTLx = anchorPx - objSizePx / 2 - auraDistance
    const canvasTLy = anchorPy - objSizePx / 2 - auraDistance

    const scaleX = coverW / renderW
    const scaleY = coverH / renderH
    const srcX = Math.round(canvasTLx * scaleX)
    const srcY = Math.round(canvasTLy * scaleY)
    const srcW = Math.round(canvasSize * scaleX)
    const srcH = Math.round(canvasSize * scaleY)

    ctx.drawImage(coverImg, srcX, srcY, srcW, srcH, 0, 0, canvasSize, canvasSize)

    // ── Step 2: Read the overlay image alpha to find the object silhouette ────────
    // Draw the overlay image at objSizePx size, offset by auraDistance
    const offscreenCanvas = document.createElement('canvas')
    offscreenCanvas.width = objSizePx
    offscreenCanvas.height = objSizePx
    const offCtx = offscreenCanvas.getContext('2d')!
    offCtx.drawImage(overlayImg, 0, 0, objSizePx, objSizePx)
    const overlayData = offCtx.getImageData(0, 0, objSizePx, objSizePx).data

    // ── Step 3: Build distance-from-boundary map ──────────────────────────────
    // For every pixel in the canvas, compute distance to nearest opaque overlay pixel.
    // Opaque = alpha > 20 in the overlay image.
    // We use a simplified approach: iterate each canvas pixel, find distance to nearest
    // opaque overlay pixel. For performance, limit search to auraDistance radius.

    const mainData = ctx.getImageData(0, 0, canvasSize, canvasSize)
    const d = mainData.data

    for (let cy = 0; cy < canvasSize; cy++) {
      for (let cx = 0; cx < canvasSize; cx++) {
        // Map canvas pixel to overlay image pixel
        const ox = cx - auraDistance  // overlay-space x
        const oy = cy - auraDistance  // overlay-space y

        // If this pixel is inside the overlay bounds and object is opaque here → skip (no aura inside)
        if (ox >= 0 && ox < objSizePx && oy >= 0 && oy < objSizePx) {
          const overlayAlpha = overlayData[(oy * objSizePx + ox) * 4 + 3]
          if (overlayAlpha > 30) continue  // inside object → no darkening
        }

        // Find distance to nearest opaque overlay pixel (within auraDistance)
        let minDist = auraDistance + 1
        const searchR = Math.min(auraDistance, 12)  // cap search radius for performance

        outer: for (let dy = -searchR; dy <= searchR; dy++) {
          for (let dx = -searchR; dx <= searchR; dx++) {
            const px = ox + dx
            const py = oy + dy
            if (px < 0 || px >= objSizePx || py < 0 || py >= objSizePx) continue
            const alpha = overlayData[(py * objSizePx + px) * 4 + 3]
            if (alpha > 30) {
              const dist = Math.sqrt(dx * dx + dy * dy)
              if (dist < minDist) {
                minDist = dist
                if (minDist < 1) break outer
              }
            }
          }
        }

        if (minDist > auraDistance) continue  // too far from object → no effect

        // Darkening amount: 1 at distance 0 (boundary), 0 at auraDistance
        const t = 1 - minDist / auraDistance
        const darken = t * t * auraStrength  // quadratic falloff

        const i = (cy * canvasSize + cx) * 4
        d[i]     = Math.round(d[i]     * (1 - darken))
        d[i + 1] = Math.round(d[i + 1] * (1 - darken))
        d[i + 2] = Math.round(d[i + 2] * (1 - darken))
        // Keep alpha from cover (fully opaque where cover is)
      }
    }

    ctx.putImageData(mainData, 0, 0)

    // ── Step 4: Mask out the interior of the overlay (leave it transparent) ───
    // The canvas interior (inside the object silhouette) should show nothing
    // since the overlay image sits on top. Clear the object interior pixels.
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(overlayImg, auraDistance, auraDistance, objSizePx, objSizePx)
    ctx.restore()

  }, [bothLoaded, xPct, yPct, widthFrac, auraDistance, auraStrength, containerWidthPx, canvasSize, objSizePx])

  // The canvas is centered on the same anchor as the overlay, but larger
  // by auraDistance on all sides.
  const marginPct = (auraDistance / containerWidthPx) * 100

  return (
    <div style={{ position: 'absolute', left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%,-50%)', width: widthPct, height: widthPct, ...style }}>
      {/* Aura canvas: larger than the overlay box, centered on same anchor */}
      {auraStrength > 0 && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            left: `${-auraDistance}px`,
            top: `${-auraDistance}px`,
            width: `calc(100% + ${auraDistance * 2}px)`,
            height: `calc(100% + ${auraDistance * 2}px)`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      {/* Overlay children on top */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}
