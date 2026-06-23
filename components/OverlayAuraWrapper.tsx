'use client'
/**
 * OverlayAuraWrapper
 *
 * Wraps an overlay object to add a canvas-based "boundary darkening aura":
 * - Renders a canvas element behind the overlay image
 * - The canvas samples the cover image pixels in the region this overlay sits on
 * - Applies a radial multiply-darken: cover pixels at the outer boundary are
 *   darkened (multiplied by a dark value), fading to transparent at the center
 * - The result looks like the baked-in asset effect: a soft dark mist around
 *   the object boundary that blends into the cover
 *
 * Props:
 *   coverImageUrl: string — the cover image URL (needed to sample cover pixels)
 *   xPct, yPct: number — overlay anchor position as % of cover container
 *   widthPct: string — overlay width as % string (from overlayWidthPct())
 *   auraStrength: number — 0–1, how strong the darkening is (default 0.4)
 *   containerRef: React.RefObject<HTMLElement> — the cover container element
 *   children: the overlay <img> + any animation
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface OverlayAuraWrapperProps {
  coverImageUrl: string
  xPct: number
  yPct: number
  widthPct: string          // e.g. "7.8%" — from overlayWidthPct(scale)
  auraStrength?: number     // 0–1, default 0.4
  containerWidthPx?: number // rendered width of the cover container in px
  style?: React.CSSProperties
  children: ReactNode
}

export function OverlayAuraWrapper({
  coverImageUrl,
  xPct,
  yPct,
  widthPct,
  auraStrength = 0.4,
  containerWidthPx = 480,
  style,
  children,
}: OverlayAuraWrapperProps) {
  const auraCanvasRef = useRef<HTMLCanvasElement>(null)
  const coverImgRef = useRef<HTMLImageElement | null>(null)
  const [coverLoaded, setCoverLoaded] = useState(false)

  // Parse widthPct string to a fraction (e.g. "7.8%" → 0.078)
  const widthFrac = parseFloat(widthPct) / 100

  // Load cover image once
  useEffect(() => {
    if (!coverImageUrl) return
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { coverImgRef.current = img; setCoverLoaded(true) }
    img.onerror = () => setCoverLoaded(false)
    img.src = coverImageUrl
  }, [coverImageUrl])

  // Draw aura whenever position/size/cover changes
  useEffect(() => {
    const canvas = auraCanvasRef.current
    if (!canvas || !coverLoaded || !coverImgRef.current) return
    if (auraStrength <= 0) { canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); return }

    const coverImg = coverImgRef.current

    // Canvas size = overlay rendered size in px
    const sizePx = Math.round(containerWidthPx * widthFrac)
    if (sizePx < 4) return
    canvas.width = sizePx
    canvas.height = sizePx

    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, sizePx, sizePx)

    // Sample cover pixels in the region this overlay covers:
    // Overlay anchor is at (xPct%, yPct%) of the cover container.
    // The overlay square spans [-sizePx/2, +sizePx/2] around the anchor.
    // Map back to cover image coordinates.
    const coverW = coverImg.naturalWidth
    const coverH = coverImg.naturalHeight

    // Cover may render with letterboxing — compute actual rendered cover rect
    // Assume cover fills the container width (object-contain, h-auto pattern)
    const renderW = containerWidthPx
    const renderH = Math.round(coverH * (containerWidthPx / coverW))

    // Anchor position in rendered px
    const anchorPx = (xPct / 100) * renderW
    const anchorPy = (yPct / 100) * renderH

    // Top-left of the overlay square in rendered px
    const tlX = anchorPx - sizePx / 2
    const tlY = anchorPy - sizePx / 2

    // Map to cover image coordinates
    const scaleX = coverW / renderW
    const scaleY = coverH / renderH
    const srcX = Math.round(tlX * scaleX)
    const srcY = Math.round(tlY * scaleY)
    const srcW = Math.round(sizePx * scaleX)
    const srcH = Math.round(sizePx * scaleY)

    // Draw the cover region onto our canvas at full overlay size
    ctx.drawImage(coverImg, srcX, srcY, srcW, srcH, 0, 0, sizePx, sizePx)

    // Now apply radial darkening in 'multiply' composite mode:
    // A radial gradient going from opaque-dark at edges to transparent at center.
    // 'multiply' will darken the cover pixels by the gradient alpha.
    ctx.globalCompositeOperation = 'multiply'

    const innerStop = 0.35  // center region stays bright
    const outerStop = 1.0   // full darkening at exact edge

    const grad = ctx.createRadialGradient(
      sizePx / 2, sizePx / 2, sizePx * innerStop * 0.5,  // inner circle (transparent)
      sizePx / 2, sizePx / 2, sizePx * 0.5               // outer circle (fully dark)
    )
    // Dark color: the same amber/brown tone of the cover, but darker
    // Using rgba(40, 20, 0, strength) — dark amber, creates warm darkening
    grad.addColorStop(0, `rgba(30, 15, 0, 0)`)
    grad.addColorStop(innerStop, `rgba(30, 15, 0, 0)`)
    grad.addColorStop(outerStop, `rgba(30, 15, 0, ${auraStrength.toFixed(2)})`)

    ctx.fillStyle = grad
    ctx.fillRect(0, 0, sizePx, sizePx)

    // Reset composite
    ctx.globalCompositeOperation = 'source-over'
  }, [coverLoaded, xPct, yPct, widthFrac, auraStrength, containerWidthPx])

  return (
    <div style={{ position: 'absolute', left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%,-50%)', width: widthPct, height: widthPct, ...style }}>
      {/* Aura canvas — behind the object, same size */}
      {auraStrength > 0 && (
        <canvas
          ref={auraCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />
      )}
      {/* Overlay object — on top of aura */}
      {children}
    </div>
  )
}
