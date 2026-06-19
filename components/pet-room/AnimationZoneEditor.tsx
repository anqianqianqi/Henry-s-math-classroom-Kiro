'use client'

// AnimationZoneEditor — admin tool for drawing freehand polygon animation zones
// on a pet room background image.
//
// Usage:
//   <AnimationZoneEditor
//     imageUrl="..."
//     zones={zones}
//     onChange={setZones}
//   />
//
// UX:
//   - Click on image to add polygon vertices
//   - Click first vertex (or press Enter) to close polygon
//   - Each zone gets an animation type + intensity picker
//   - Pivot point = click inside completed polygon to set anchor (base of object)
//   - Multiple zones per image

import { useEffect, useRef, useState } from 'react'

export interface AnimPoint { x: number; y: number }
export interface AnimZone {
  id: string
  polygon: AnimPoint[]
  pivot: AnimPoint
  animation: 'sway' | 'float' | 'shimmer' | 'flicker' | 'bling'
  intensity: number
  speed: number
  containOverflow?: boolean  // when true, static layer fills polygon so overflow is hidden behind static background
}

const ANIM_OPTIONS: { value: AnimZone['animation']; label: string; desc: string }[] = [
  { value: 'sway', label: '🌿 Sway', desc: 'Gentle side-to-side sway (trees, curtains)' },
  { value: 'float', label: '✨ Float', desc: 'Slow up-down float (clouds, dust)' },
  { value: 'shimmer', label: '💧 Shimmer', desc: 'Subtle opacity flicker (water, light)' },
  { value: 'flicker', label: '🕯️ Flicker', desc: 'Random flicker (candles, fire)' },
  { value: 'bling', label: '💎 Bling', desc: 'Rainbow colour-shift sparkle (jewels, lights)' },
]

const ZONE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

interface Props {
  imageUrl: string
  zones: AnimZone[]
  onChange: (zones: AnimZone[]) => void
}

export default function AnimationZoneEditor({ imageUrl, zones, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  // Drawing state
  const [drawing, setDrawing] = useState(false)
  const [currentPoints, setCurrentPoints] = useState<AnimPoint[]>([])
  const [mousePos, setMousePos] = useState<AnimPoint | null>(null)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)

  // New zone defaults
  const [newAnim, setNewAnim] = useState<AnimZone['animation']>('sway')
  const [newIntensity, setNewIntensity] = useState(0.5)
  const [newSpeed, setNewSpeed] = useState(1.0)

  // Load image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; setImgLoaded(true) }
    img.src = imageUrl
  }, [imageUrl])

  // Draw everything onto canvas
  useEffect(() => {
    if (!imgLoaded || !canvasRef.current || !imgRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const img = imgRef.current

    // Size canvas to container
    const container = containerRef.current!
    const cw = container.clientWidth
    const ch = (cw / img.naturalWidth) * img.naturalHeight
    canvas.width = cw
    canvas.height = ch

    // Draw background
    ctx.drawImage(img, 0, 0, cw, ch)

    // Draw saved zones
    zones.forEach((zone, zi) => {
      const color = ZONE_COLORS[zi % ZONE_COLORS.length]
      const pts = zone.polygon.map(p => ({ x: p.x / 100 * cw, y: p.y / 100 * ch }))
      if (pts.length < 2) return
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      ctx.closePath()
      ctx.fillStyle = color + '33'
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.stroke()

      // Pivot marker
      const piv = { x: zone.pivot.x / 100 * cw, y: zone.pivot.y / 100 * ch }
      ctx.beginPath()
      ctx.arc(piv.x, piv.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()

      // Label
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
      ctx.fillStyle = 'white'
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.font = 'bold 11px system-ui'
      ctx.strokeText(zone.animation, cx - 20, cy)
      ctx.fillText(zone.animation, cx - 20, cy)

      // Highlight selected
      if (zone.id === selectedZone) {
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 3
        ctx.setLineDash([5, 3])
        ctx.stroke()
        ctx.setLineDash([])
      }
    })

    // Draw in-progress polygon
    if (drawing && currentPoints.length > 0) {
      const color = ZONE_COLORS[zones.length % ZONE_COLORS.length]
      const pts = currentPoints.map(p => ({ x: p.x / 100 * cw, y: p.y / 100 * ch }))
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      if (mousePos) {
        ctx.lineTo(mousePos.x / 100 * cw, mousePos.y / 100 * ch)
      }
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      // Vertex dots
      pts.forEach((p, i) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, i === 0 ? 7 : 4, 0, Math.PI * 2)
        ctx.fillStyle = i === 0 ? color : 'white'
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.fill()
        ctx.stroke()
      })
    }
  }, [imgLoaded, zones, currentPoints, mousePos, drawing, selectedZone])

  function getRelPct(e: React.MouseEvent<HTMLCanvasElement>): AnimPoint {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    }
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const pt = getRelPct(e)

    if (!drawing) {
      // Start drawing new zone
      setDrawing(true)
      setCurrentPoints([pt])
      return
    }

    // Close polygon if clicking near first point
    if (currentPoints.length >= 3) {
      const first = currentPoints[0]
      const dist = Math.hypot(pt.x - first.x, pt.y - first.y)
      if (dist < 3) {
        finishZone()
        return
      }
    }

    setCurrentPoints(prev => [...prev, pt])
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return
    setMousePos(getRelPct(e))
  }

  function finishZone() {
    if (currentPoints.length < 3) {
      cancelDrawing()
      return
    }
    // Pivot = centroid of polygon by default
    const cx = currentPoints.reduce((s, p) => s + p.x, 0) / currentPoints.length
    const maxY = Math.max(...currentPoints.map(p => p.y))
    const newZone: AnimZone = {
      id: `zone_${Date.now()}`,
      polygon: currentPoints,
      pivot: { x: cx, y: maxY },  // bottom-centre by default
      animation: newAnim,
      intensity: newIntensity,
      speed: newSpeed,
      containOverflow: newAnim === 'float',  // auto-contain for float
    }
    onChange([...zones, newZone])
    setDrawing(false)
    setCurrentPoints([])
    setMousePos(null)
    setSelectedZone(newZone.id)
  }

  function cancelDrawing() {
    setDrawing(false)
    setCurrentPoints([])
    setMousePos(null)
  }

  function deleteZone(id: string) {
    onChange(zones.filter(z => z.id !== id))
    if (selectedZone === id) setSelectedZone(null)
  }

  function updateZone(id: string, patch: Partial<AnimZone>) {
    onChange(zones.map(z => z.id === id ? { ...z, ...patch } : z))
  }

  return (
    <div className="space-y-3">
      {/* Instructions */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 border border-gray-200">
        {drawing
          ? `${currentPoints.length} point${currentPoints.length !== 1 ? 's' : ''} placed — click to add more, click near ● to close, or press Esc to cancel`
          : 'Click anywhere on the image to start drawing a zone. Trace around the object you want to animate.'}
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative w-full rounded-xl overflow-hidden border border-gray-200 cursor-crosshair">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          className="w-full"
        />
      </div>

      {/* Controls while drawing */}
      {drawing && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-blue-700">Drawing zone…</span>
          <select value={newAnim} onChange={e => setNewAnim(e.target.value as AnimZone['animation'])}
            className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white">
            {ANIM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <label className="text-xs text-gray-600 flex items-center gap-1">
            Intensity
            <input type="range" min={0.1} max={1} step={0.1} value={newIntensity}
              onChange={e => setNewIntensity(Number(e.target.value))} className="w-20 accent-blue-500" />
            {newIntensity.toFixed(1)}
          </label>
          <button onClick={finishZone} disabled={currentPoints.length < 3}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg">
            ✓ Close zone
          </button>
          <button onClick={cancelDrawing}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg">
            ✕ Cancel
          </button>
        </div>
      )}

      {/* Saved zones list */}
      {zones.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-700">Saved zones ({zones.length})</div>
          {zones.map((zone, zi) => {
            const color = ZONE_COLORS[zi % ZONE_COLORS.length]
            return (
              <div key={zone.id}
                className={`flex items-center gap-3 p-2 rounded-xl border-2 cursor-pointer transition-colors ${selectedZone === zone.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                onClick={() => setSelectedZone(zone.id === selectedZone ? null : zone.id)}
              >
                <div className="w-4 h-4 rounded-full shrink-0" style={{ background: color }} />
                <select value={zone.animation}
                  onChange={e => {
                    const anim = e.target.value as AnimZone['animation']
                    updateZone(zone.id, {
                      animation: anim,
                      // Float moves the image vertically — auto-enable containOverflow to avoid gaps
                      containOverflow: anim === 'float' ? true : zone.containOverflow,
                    })
                  }}
                  onClick={e => e.stopPropagation()}
                  className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white">
                  {ANIM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <label className="text-xs text-gray-600 flex items-center gap-1 flex-1">
                  <input type="range" min={0.1} max={1} step={0.1} value={zone.intensity}
                    onChange={e => updateZone(zone.id, { intensity: Number(e.target.value) })}
                    onClick={e => e.stopPropagation()}
                    className="w-16 accent-blue-500" />
                  {zone.intensity.toFixed(1)}
                </label>
                <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer shrink-0"
                  onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={!!zone.containOverflow}
                    onChange={e => updateZone(zone.id, { containOverflow: e.target.checked })}
                    className="accent-blue-500" />
                  <span title="Static layer fills the polygon so animation overflow is hidden behind the background">Contain</span>
                </label>
                <span className="text-[10px] text-gray-400">{zone.polygon.length} pts</span>
                <button onClick={e => { e.stopPropagation(); deleteZone(zone.id) }}
                  className="text-xs text-red-400 hover:text-red-600 font-bold px-1">✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
