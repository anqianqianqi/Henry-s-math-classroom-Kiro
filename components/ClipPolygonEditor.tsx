'use client'
/**
 * ClipPolygonEditor
 *
 * Inline sub-panel shown in the animation editor for sway / shimmer / flicker.
 * Lets the admin draw a polygon crop region directly on the overlay image preview.
 * Only the area inside the polygon will be visible during the animation.
 *
 * Coordinates are stored as % of the overlay box (0–100), resolution-independent.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react'

export interface ClipPolygonPoint { x: number; y: number }

interface Props {
  imageUrl:  string
  polygon:   ClipPolygonPoint[]
  onChange:  (polygon: ClipPolygonPoint[]) => void
  /** Label shown in the header, e.g. "✨ Shimmer Crop" */
  label?:    string
  /** Accent colour class for UI chrome, e.g. 'teal' | 'indigo' | 'emerald'. Default: 'teal' */
  color?:    'teal' | 'indigo' | 'emerald'
}

const HANDLE_R = 7  // hit-test radius px

type Mode = 'idle' | 'draw' | 'drag'

const COLOR_MAP = {
  teal:    { fill: 'rgba(20,184,166,0.22)',  stroke: '#0d9488', btn: 'bg-teal-600',    ring: 'border-teal-300',   text: 'text-teal-700',   bg: 'bg-teal-50/30',   border: 'border-teal-200'   },
  indigo:  { fill: 'rgba(99,102,241,0.22)',  stroke: '#4f46e5', btn: 'bg-indigo-600',  ring: 'border-indigo-300', text: 'text-indigo-700', bg: 'bg-indigo-50/30', border: 'border-indigo-200' },
  emerald: { fill: 'rgba(16,185,129,0.22)',  stroke: '#059669', btn: 'bg-emerald-600', ring: 'border-emerald-300',text: 'text-emerald-700',bg: 'bg-emerald-50/30',border: 'border-emerald-200'},
}

export function ClipPolygonEditor({ imageUrl, polygon, onChange, label = '✂️ Crop polygon', color = 'teal' }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const imgRef     = useRef<HTMLImageElement | null>(null)
  const [loaded,   setLoaded]   = useState(false)
  const [mode,     setMode]     = useState<Mode>('idle')
  const [dragIdx,  setDragIdx]  = useState<number | null>(null)
  const [cvSize,   setCvSize]   = useState({ w: 280, h: 280 })

  const c = COLOR_MAP[color]

  // Load image → set canvas aspect ratio
  useEffect(() => {
    setLoaded(false)
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      setLoaded(true)
      const maxW = 280
      const ratio = img.naturalHeight / img.naturalWidth
      setCvSize({ w: maxW, h: Math.round(maxW * ratio) })
    }
    img.src = imageUrl
  }, [imageUrl])

  // Redraw on every change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !loaded || !imgRef.current) return
    const ctx = canvas.getContext('2d')!
    const { w, h } = cvSize
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(imgRef.current, 0, 0, w, h)

    if (polygon.length >= 2) {
      const pts = polygon.map(v => ({ x: (v.x / 100) * w, y: (v.y / 100) * h }))

      // Darken area outside polygon
      if (polygon.length >= 3) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, w, h)
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
        ctx.closePath()
        ctx.fillStyle = 'rgba(0,0,0,0.45)'
        ctx.fill('evenodd')
        ctx.restore()
      }

      // Polygon outline
      ctx.beginPath()
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
      if (polygon.length >= 3) ctx.closePath()
      ctx.strokeStyle = c.stroke
      ctx.lineWidth = 2
      ctx.setLineDash([5, 3])
      ctx.stroke()
      ctx.setLineDash([])

      // Vertex handles
      pts.forEach((p, i) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, HANDLE_R, 0, Math.PI * 2)
        ctx.fillStyle = c.stroke
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 9px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(i + 1), p.x, p.y)
      })
    }
  }, [polygon, cvSize, loaded, c])

  const getPct = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY
    const sx = cvSize.w / rect.width
    const sy = cvSize.h / rect.height
    return {
      x: Math.max(0, Math.min(100, ((cx - rect.left) * sx / cvSize.w) * 100)),
      y: Math.max(0, Math.min(100, ((cy - rect.top)  * sy / cvSize.h) * 100)),
    }
  }, [cvSize])

  const hitVertex = useCallback((pct: ClipPolygonPoint) => {
    const { w, h } = cvSize
    return polygon.findIndex(v => {
      const dx = (v.x / 100) * w - (pct.x / 100) * w
      const dy = (v.y / 100) * h - (pct.y / 100) * h
      return Math.hypot(dx, dy) <= HANDLE_R * 2
    })
  }, [polygon, cvSize])

  function handleDown(e: React.MouseEvent) {
    const pt = getPct(e)
    if (mode === 'idle' || mode === 'draw') {
      const idx = hitVertex(pt)
      if (idx !== -1) { setDragIdx(idx); setMode('drag'); return }
    }
    if (mode === 'draw') {
      onChange([...polygon, pt])
    }
  }

  function handleMove(e: React.MouseEvent) {
    if (mode === 'drag' && dragIdx !== null) {
      const pt = getPct(e)
      onChange(polygon.map((v, i) => i === dragIdx ? pt : v))
    }
  }

  function handleUp() {
    if (mode === 'drag') { setDragIdx(null); setMode('idle') }
  }

  const cursorCls = mode === 'draw' ? 'cursor-crosshair' : mode === 'drag' ? 'cursor-grabbing' : 'cursor-pointer'

  return (
    <div className={`space-y-3 border ${c.border} rounded-xl p-3 ${c.bg}`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-bold ${c.text}`}>{label}</p>
        <div className="flex gap-1">
          <button
            onClick={() => setMode(mode === 'draw' ? 'idle' : 'draw')}
            className={`text-[11px] px-2 py-1 rounded-lg font-semibold border transition-colors
              ${mode === 'draw'
                ? `${c.btn} text-white border-transparent`
                : `bg-white ${c.text} ${c.ring} hover:opacity-80`}`}
          >
            ✏️ {mode === 'draw' ? 'Drawing…' : 'Draw polygon'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className={`relative rounded-lg overflow-hidden border ${c.border}`}>
        <canvas
          ref={canvasRef}
          width={cvSize.w}
          height={cvSize.h}
          className={`w-full h-auto block select-none ${cursorCls}`}
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={handleUp}
          onMouseLeave={handleUp}
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400 text-xs">Loading…</div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-gray-500">{polygon.length} vertices</span>
        <button onClick={() => polygon.length > 0 && onChange(polygon.slice(0, -1))}
          disabled={polygon.length === 0}
          className="text-[11px] px-2 py-0.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          ↩ Undo
        </button>
        <button onClick={() => onChange([])}
          disabled={polygon.length === 0}
          className="text-[11px] px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40">
          🗑 Clear
        </button>
        {polygon.length === 0 && (
          <button
            onClick={() => onChange([{ x:10,y:10 },{ x:90,y:10 },{ x:90,y:90 },{ x:10,y:90 }])}
            className={`text-[11px] px-2 py-0.5 rounded border ${c.ring} bg-white ${c.text} hover:opacity-80`}
          >
            ⬜ Full rect
          </button>
        )}
      </div>

      {polygon.length < 3 && mode === 'draw' && (
        <p className={`text-[11px] ${c.text}`}>Click on the image to add vertices. Need ≥ 3 to form a crop.</p>
      )}
      {polygon.length >= 3 && (
        <p className="text-[11px] text-gray-400 leading-snug">
          Only the area inside the polygon will be visible. Drag vertices to adjust. Click ✏️ Draw to add more.
        </p>
      )}
    </div>
  )
}

/**
 * Convert a ClipPolygonPoint[] to a CSS clip-path polygon() string.
 * Points are in % units (0–100), CSS expects "x% y%" pairs.
 * Returns undefined when polygon has fewer than 3 points.
 */
export function clipPolygonToCssPath(polygon: ClipPolygonPoint[] | undefined): string | undefined {
  if (!polygon || polygon.length < 3) return undefined
  return `polygon(${polygon.map(p => `${p.x.toFixed(2)}% ${p.y.toFixed(2)}%`).join(', ')})`
}
