'use client'
/**
 * OverlayBurstRenderer
 *
 * Canvas-based burst/explode animation for overlay objects.
 * Takes a polygon (defined as % of the canvas dimensions) and a burst center,
 * then renders N particles that each:
 *   1. Show the image clipped to the polygon
 *   2. Radiate outward from the center (each at a different angle)
 *   3. Fade to transparent as they move
 *   4. Loop continuously (each particle at a staggered phase)
 *
 * The canvas is sized to the overlay's rendered pixel dimensions so it slots
 * into the same position/size slot as a regular <img> overlay.
 */

import { useEffect, useRef, useMemo } from 'react'
import { COVER_NATIVE_WIDTH, overlayWidthPct } from '@/lib/overlayAnimations'

export interface BurstConfig {
  /** Polygon vertices as % of the overlay box (0–100) */
  polygon: { x: number; y: number }[]
  /** Explosion origin as % of the overlay box (0–100) */
  center: { x: number; y: number }
  /** Number of particles (default 8) */
  particles?: number
  /** How far particles travel as % of cover width (default 15) */
  radius?: number
}

interface OverlayBurstRendererProps {
  imageUrl: string
  /** Rendered container width in pixels — used to compute absolute sizes */
  containerWidthPx: number
  scale: number
  speed?: number
  burst: BurstConfig
  /** Whether animation is paused (e.g. during book flip) */
  paused?: boolean
  style?: React.CSSProperties
}

// Duration of a single particle's full travel (ms) at speed=1
const BASE_DURATION_MS = 2000

export function OverlayBurstRenderer({
  imageUrl,
  containerWidthPx,
  scale,
  speed = 1.0,
  burst,
  paused = false,
  style,
}: OverlayBurstRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const imgLoadedRef = useRef(false)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const pausedAtRef = useRef<number>(0)
  const pausedRef = useRef(paused)

  // Compute canvas pixel size from scale + container
  const sizePx = Math.round((COVER_NATIVE_WIDTH * parseFloat(overlayWidthPct(scale)) / 100) * (containerWidthPx / COVER_NATIVE_WIDTH))
  // More direct: sizePx = overlay base size * scale, proportional to container
  const canvasPx = Math.max(20, Math.round(containerWidthPx * 0.08 * scale))

  // Normalised burst params
  const N = Math.max(2, Math.min(24, burst.particles ?? 8))
  const radiusPx = (burst.radius ?? 15) / 100 * containerWidthPx
  const durationMs = BASE_DURATION_MS / Math.max(0.1, speed)
  const cx = (burst.center.x / 100) * canvasPx
  const cy = (burst.center.y / 100) * canvasPx

  const polyPx = useMemo(() =>
    burst.polygon.map(v => ({ x: (v.x / 100) * canvasPx, y: (v.y / 100) * canvasPx })),
    [burst.polygon, canvasPx]
  )

  // Load image once
  useEffect(() => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; imgLoadedRef.current = true }
    img.src = imageUrl
    return () => { img.onload = null }
  }, [imageUrl])

  // Track paused state without restarting the loop
  useEffect(() => {
    pausedRef.current = paused
    if (paused) {
      pausedAtRef.current = performance.now()
    } else if (pausedAtRef.current > 0) {
      // Shift startRef forward by the paused duration so animation resumes seamlessly
      const pausedDuration = performance.now() - pausedAtRef.current
      startRef.current += pausedDuration
      pausedAtRef.current = 0
    }
  }, [paused])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function draw(now: number) {
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      if (!startRef.current) startRef.current = now

      const elapsed = now - startRef.current
      ctx!.clearRect(0, 0, canvasPx, canvasPx)

      if (!imgLoadedRef.current || !imgRef.current || polyPx.length < 3) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const img = imgRef.current

      for (let i = 0; i < N; i++) {
        // Each particle is offset in phase by i/N of the full duration
        const phaseMs = (i / N) * durationMs
        // t: 0→1 representing how far this particle has traveled
        const t = ((elapsed + phaseMs) % durationMs) / durationMs

        const angle = (2 * Math.PI * i) / N
        const tx = Math.cos(angle) * radiusPx * t
        const ty = Math.sin(angle) * radiusPx * t
        const alpha = 1 - t  // fully opaque at t=0, invisible at t=1

        ctx!.save()
        ctx!.globalAlpha = alpha

        // Clip to polygon (translated for this particle)
        ctx!.beginPath()
        polyPx.forEach((v, idx) => {
          const vx = v.x - cx + cx + tx
          const vy = v.y - cy + cy + ty
          if (idx === 0) ctx!.moveTo(vx, vy)
          else ctx!.lineTo(vx, vy)
        })
        ctx!.closePath()
        ctx!.clip()

        // Draw image, offset so image content moves with the polygon
        ctx!.drawImage(img, tx, ty, canvasPx, canvasPx)

        ctx!.restore()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [canvasPx, N, radiusPx, durationMs, cx, cy, polyPx])

  return (
    <canvas
      ref={canvasRef}
      width={canvasPx}
      height={canvasPx}
      style={{
        position: 'absolute',
        width: overlayWidthPct(scale),
        height: overlayWidthPct(scale),
        objectFit: 'contain',
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}
