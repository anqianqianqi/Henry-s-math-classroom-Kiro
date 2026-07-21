'use client'
/**
 * BurstPolygonEditor
 *
 * Inline sub-panel shown in OverlayEditorInline when animation='burst'.
 * Lets the admin:
 *   1. Draw a polygon by clicking on the overlay image preview
 *   2. Drag vertices to adjust
 *   3. Click to set the burst center (⊕)
 *   4. Set particle count and radius
 *
 * Coordinates are stored as % of the overlay box (0–100) so they're resolution-independent.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react'
import type { BurstConfig } from './OverlayBurstRenderer'

interface Props {
  imageUrl: string
  burst: BurstConfig
  onChange: (burst: BurstConfig) => void
}

const HANDLE_RADIUS = 7  // px — hit-test radius for vertex drag

type Mode = 'draw' | 'drag-vertex' | 'set-center' | 'idle'

export function BurstPolygonEditor({ imageUrl, burst, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [mode, setMode] = useState<Mode>('idle')
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 280, h: 280 })

  // Load image and set canvas aspect ratio
  useEffect(() => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      setImgLoaded(true)
      // Fit into max 280px wide, preserve aspect ratio
      const maxW = 280
      const ratio = img.naturalHeight / img.naturalWidth
      setCanvasSize({ w: maxW, h: Math.round(maxW * ratio) })
    }
    img.src = imageUrl
  }, [imageUrl])

  // Draw on every change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgLoaded || !imgRef.current) return
    const ctx = canvas.getContext('2d')!
    const { w, h } = canvasSize
    ctx.clearRect(0, 0, w, h)

    // Background image
    ctx.drawImage(imgRef.current, 0, 0, w, h)

    // Polygon fill + outline
    if (burst.polygon.length >= 2) {
      const pts = burst.polygon.map(v => ({ x: (v.x / 100) * w, y: (v.y / 100) * h }))

      ctx.beginPath()
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
      if (burst.polygon.length >= 3) ctx.closePath()

      // Semi-transparent fill
      ctx.fillStyle = 'rgba(139, 92, 246, 0.25)'
      ctx.fill()

      // Stroke
      ctx.strokeStyle = '#7c3aed'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 3])
      ctx.stroke()
      ctx.setLineDash([])

      // Vertex handles
      pts.forEach((p, i) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = '#7c3aed'
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.stroke()
        // Index label
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 9px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(i + 1), p.x, p.y)
      })
    }

    // Burst center ⊕
    const cpx = (burst.center.x / 100) * w
    const cpy = (burst.center.y / 100) * h
    ctx.beginPath()
    ctx.arc(cpx, cpy, 8, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(234, 88, 12, 0.85)'
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.stroke()
    // crosshair
    ctx.beginPath()
    ctx.moveTo(cpx - 5, cpy); ctx.lineTo(cpx + 5, cpy)
    ctx.moveTo(cpx, cpy - 5); ctx.lineTo(cpx, cpy + 5)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }, [burst, canvasSize, imgLoaded])

  const getCanvasPt = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const scaleX = canvasSize.w / rect.width
    const scaleY = canvasSize.h / rect.height
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) * scaleX / canvasSize.w) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) * scaleY / canvasSize.h) * 100)),
    }
  }, [canvasSize])

  const hitTestVertex = useCallback((pct: { x: number; y: number }) => {
    const { w, h } = canvasSize
    const px = (pct.x / 100) * w
    const py = (pct.y / 100) * h
    return burst.polygon.findIndex(v => {
      const dx = (v.x / 100) * w - px
      const dy = (v.y / 100) * h - py
      return Math.hypot(dx, dy) <= HANDLE_RADIUS * 2
    })
  }, [burst.polygon, canvasSize])

  function handleMouseDown(e: React.MouseEvent) {
    const pt = getCanvasPt(e)

    if (mode === 'set-center') {
      onChange({ ...burst, center: pt })
      setMode('idle')
      return
    }

    if (mode === 'idle' || mode === 'draw') {
      // Check if clicking near a vertex → switch to drag
      const idx = hitTestVertex(pt)
      if (idx !== -1) {
        setDraggingIdx(idx)
        setMode('drag-vertex')
        return
      }
    }

    if (mode === 'draw') {
      onChange({ ...burst, polygon: [...burst.polygon, pt] })
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (mode === 'drag-vertex' && draggingIdx !== null) {
      const pt = getCanvasPt(e)
      const newPoly = burst.polygon.map((v, i) => i === draggingIdx ? pt : v)
      onChange({ ...burst, polygon: newPoly })
    }
  }

  function handleMouseUp() {
    if (mode === 'drag-vertex') {
      setDraggingIdx(null)
      setMode('idle')
    }
  }

  function removeLastVertex() {
    if (burst.polygon.length > 0) {
      onChange({ ...burst, polygon: burst.polygon.slice(0, -1) })
    }
  }

  function clearPolygon() {
    onChange({ ...burst, polygon: [] })
  }

  const cursorClass = mode === 'draw' ? 'cursor-crosshair' : mode === 'set-center' ? 'cursor-cell' : 'cursor-pointer'

  return (
    <div className="space-y-3 border border-purple-200 rounded-xl p-3 bg-purple-50/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-purple-800">💥 Burst Settings</p>
        <div className="flex gap-1">
          <button
            onClick={() => setMode(mode === 'draw' ? 'idle' : 'draw')}
            className={`text-[11px] px-2 py-1 rounded-lg font-semibold border transition-colors ${mode === 'draw' ? 'bg-purple-600 text-white border-purple-700' : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'}`}
          >
            ✏️ {mode === 'draw' ? 'Drawing…' : 'Draw polygon'}
          </button>
          <button
            onClick={() => setMode(mode === 'set-center' ? 'idle' : 'set-center')}
            className={`text-[11px] px-2 py-1 rounded-lg font-semibold border transition-colors ${mode === 'set-center' ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-orange-600 border-orange-300 hover:bg-orange-50'}`}
          >
            ⊕ {mode === 'set-center' ? 'Click to set…' : 'Set center'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative rounded-lg overflow-hidden border border-purple-200">
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          className={`w-full h-auto block select-none ${cursorClass}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400 text-xs">Loading…</div>
        )}
      </div>

      {/* Polygon controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-gray-500">{burst.polygon.length} vertices</span>
        <button onClick={removeLastVertex} disabled={burst.polygon.length === 0}
          className="text-[11px] px-2 py-0.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          ↩ Undo last
        </button>
        <button onClick={clearPolygon} disabled={burst.polygon.length === 0}
          className="text-[11px] px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40">
          🗑 Clear
        </button>
        {burst.polygon.length < 3 && mode === 'draw' && (
          <span className="text-[11px] text-purple-500">Click image to add vertices. Need ≥3.</span>
        )}
      </div>

      {/* Particle count */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Particles</label>
        <div className="flex gap-1.5">
          {[4, 6, 8, 12, 16].map(n => (
            <button key={n} onClick={() => onChange({ ...burst, particles: n })}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border-2 transition-colors ${(burst.particles ?? 8) === n ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Radius */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
          Travel radius ({burst.radius ?? 15}% of cover)
        </label>
        <input type="range" min={3} max={40} step={1} value={burst.radius ?? 15}
          onChange={e => onChange({ ...burst, radius: Number(e.target.value) })}
          className="w-full accent-purple-600" />
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>3% tight</span><span>40% wide</span>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 leading-snug">
        Tip: Draw the polygon around the part of the image you want to burst (e.g. the face of the pharaoh).
        Then click ⊕ Set center to mark where particles radiate from.
      </p>
    </div>
  )
}
