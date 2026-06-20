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
import AnimatedRoomLayer from './AnimatedRoomLayer'

export interface AnimPoint { x: number; y: number }
export interface AnimZone {
  id: string
  polygon: AnimPoint[]
  pivot: AnimPoint
  animation: 'sway' | 'float' | 'shimmer' | 'flicker' | 'bling' | 'glow' | 'wind'
  intensity: number
  speed: number
  containOverflow?: boolean  // when true, strictly clip animation to original polygon
  fillColor?: string          // solid hex color to fill the gap area
  fillImage?: boolean         // when true, use the original background image as the gap fill
}

const ANIM_OPTIONS: { value: AnimZone['animation']; label: string; desc: string }[] = [
  { value: 'sway', label: '🌿 Sway', desc: 'Gentle side-to-side sway (trees, curtains)' },
  { value: 'float', label: '✨ Float', desc: 'Slow up-down float (clouds, dust)' },
  { value: 'shimmer', label: '💧 Shimmer', desc: 'Subtle opacity flicker (water, light)' },
  { value: 'flicker', label: '🕯️ Flicker', desc: 'Random flicker (candles, fire)' },
  { value: 'bling', label: '💎 Bling', desc: 'Rainbow colour-shift sparkle (jewels, lights)' },
  { value: 'glow', label: '🌟 Glow', desc: 'Pulsing brightness without colour change (embers, lamps)' },
  { value: 'wind', label: '🌬️ Wind', desc: 'Blown by wind — skew + shift (blankets, curtains, fabric)' },
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

  // Zoom state — viewport is a % region of the image [x0,y0,x1,y1]
  type ZoomMode = 'none' | 'selecting'
  const [zoomMode, setZoomMode] = useState<ZoomMode>('none')
  const [viewport, setViewport] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [zoomDragStart, setZoomDragStart] = useState<AnimPoint | null>(null)
  const [zoomDragCurrent, setZoomDragCurrent] = useState<AnimPoint | null>(null)

  // Eyedropper state — when set, next canvas click samples pixel and sets fillColor on that zone
  const [eyedropperZoneId, setEyedropperZoneId] = useState<string | null>(null)

  // Pivot drag state — when dragging a pivot dot
  const [pivotDragZoneId, setPivotDragZoneId] = useState<string | null>(null)

  // Vertex drag state — when dragging a polygon vertex of a saved zone
  const [vertexDrag, setVertexDrag] = useState<{ zoneId: string; vertexIndex: number } | null>(null)

  // Preview modal
  const [showPreview, setShowPreview] = useState(false)

  // Load image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; setImgLoaded(true) }
    img.src = imageUrl
  }, [imageUrl])

  // Keyboard: Escape cancels drawing or zoom mode
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showPreview) { setShowPreview(false); return }
        if (drawing) cancelDrawing()
        if (zoomMode !== 'none') {
          setZoomMode('none')
          setZoomDragStart(null)
          setZoomDragCurrent(null)
        }
        if (eyedropperZoneId) setEyedropperZoneId(null)
      }
      if ((e.key === 'Enter') && drawing && currentPoints.length >= 3) {
        finishZone()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawing, zoomMode, currentPoints, eyedropperZoneId, showPreview])

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

    // Determine the visible region in % coords
    const vp = viewport ?? { x0: 0, y0: 0, x1: 100, y1: 100 }
    const vpW = vp.x1 - vp.x0   // width of viewport in % units
    const vpH = vp.y1 - vp.y0
    // Scale: how many canvas px per 1% of original image
    const scaleX = cw / vpW
    const scaleY = ch / vpH

    // Helper: convert % coords → canvas px (accounting for viewport)
    const pctToCanvas = (px: number, py: number) => ({
      x: (px - vp.x0) * scaleX,
      y: (py - vp.y0) * scaleY,
    })

    // Draw the image cropped to viewport
    const srcX = (vp.x0 / 100) * img.naturalWidth
    const srcY = (vp.y0 / 100) * img.naturalHeight
    const srcW = (vpW / 100) * img.naturalWidth
    const srcH = (vpH / 100) * img.naturalHeight
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, cw, ch)

    // Viewport indicator (mini-map hint when zoomed)
    if (viewport) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.strokeRect(2, 2, cw - 4, ch - 4)
      ctx.setLineDash([])
    }

    // Draw saved zones
    zones.forEach((zone, zi) => {
      const color = ZONE_COLORS[zi % ZONE_COLORS.length]
      const pts = zone.polygon.map(p => pctToCanvas(p.x, p.y))
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
      const piv = pctToCanvas(zone.pivot.x, zone.pivot.y)
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

      // Vertex dots — always visible on saved zones so user can drag them
      // (larger and brighter when zone is selected or being vertex-dragged)
      const isActive = zone.id === selectedZone || vertexDrag?.zoneId === zone.id
      pts.forEach((p, vi) => {
        const isDragging = vertexDrag?.zoneId === zone.id && vertexDrag?.vertexIndex === vi
        const r = isDragging ? 8 : isActive ? 6 : 4
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = isDragging ? 'white' : isActive ? color : color + 'aa'
        ctx.strokeStyle = color
        ctx.lineWidth = isDragging ? 3 : 2
        ctx.fill()
        ctx.stroke()
      })
    })

    // Draw in-progress polygon
    if (drawing && currentPoints.length > 0) {
      const color = ZONE_COLORS[zones.length % ZONE_COLORS.length]
      const pts = currentPoints.map(p => pctToCanvas(p.x, p.y))
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      if (mousePos) {
        const mp = pctToCanvas(mousePos.x, mousePos.y)
        ctx.lineTo(mp.x, mp.y)
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

    // Draw zoom selection rectangle (while dragging in zoom mode)
    if (zoomMode === 'selecting' && zoomDragStart && zoomDragCurrent) {
      const s = pctToCanvas(zoomDragStart.x, zoomDragStart.y)
      const c = pctToCanvas(zoomDragCurrent.x, zoomDragCurrent.y)
      const rx = Math.min(s.x, c.x)
      const ry = Math.min(s.y, c.y)
      const rw = Math.abs(s.x - c.x)
      const rh = Math.abs(s.y - c.y)
      ctx.strokeStyle = '#facc15'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(rx, ry, rw, rh)
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(250, 204, 21, 0.12)'
      ctx.fillRect(rx, ry, rw, rh)
    }
  }, [imgLoaded, zones, currentPoints, mousePos, drawing, selectedZone, viewport, zoomMode, zoomDragStart, zoomDragCurrent, vertexDrag])

  // Map a canvas mouse event → % coords in the original image space (viewport-aware)
  function getRelPct(e: React.MouseEvent<HTMLCanvasElement>): AnimPoint {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    // Fractional position within the canvas [0..1]
    const fx = (e.clientX - rect.left) / rect.width
    const fy = (e.clientY - rect.top) / rect.height
    // Map through viewport back to original % space
    const vp = viewport ?? { x0: 0, y0: 0, x1: 100, y1: 100 }
    const vpW = vp.x1 - vp.x0
    const vpH = vp.y1 - vp.y0
    return {
      x: vp.x0 + fx * vpW,
      y: vp.y0 + fy * vpH,
    }
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (zoomMode === 'selecting') {
      e.preventDefault()
      const pt = getRelPct(e)
      setZoomDragStart(pt)
      setZoomDragCurrent(pt)
      return
    }
    if (!drawing && !eyedropperZoneId) {
      const pt = getRelPct(e)
      const vp = viewport ?? { x0: 0, y0: 0, x1: 100, y1: 100 }
      const threshold = (vp.x1 - vp.x0) * 0.03

      // Check vertices first (higher priority than pivot)
      for (const zone of zones) {
        for (let vi = 0; vi < zone.polygon.length; vi++) {
          const v = zone.polygon[vi]
          if (Math.hypot(pt.x - v.x, pt.y - v.y) < threshold) {
            e.preventDefault()
            setVertexDrag({ zoneId: zone.id, vertexIndex: vi })
            setSelectedZone(zone.id)
            return
          }
        }
      }

      // Then check pivot dots
      for (const zone of zones) {
        if (Math.hypot(pt.x - zone.pivot.x, pt.y - zone.pivot.y) < threshold) {
          e.preventDefault()
          setPivotDragZoneId(zone.id)
          setSelectedZone(zone.id)
          return
        }
      }
    }
  }

  function handleCanvasMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (vertexDrag) {
      setVertexDrag(null)
      return
    }
    if (pivotDragZoneId) {
      setPivotDragZoneId(null)
      return
    }
    if (zoomMode === 'selecting' && zoomDragStart && zoomDragCurrent) {
      e.preventDefault()
      const x0 = Math.min(zoomDragStart.x, zoomDragCurrent.x)
      const y0 = Math.min(zoomDragStart.y, zoomDragCurrent.y)
      const x1 = Math.max(zoomDragStart.x, zoomDragCurrent.x)
      const y1 = Math.max(zoomDragStart.y, zoomDragCurrent.y)
      // Only commit if the selection is meaningful (> 2% wide/tall)
      if (x1 - x0 > 2 && y1 - y0 > 2) {
        setViewport({ x0, y0, x1, y1 })
      }
      setZoomDragStart(null)
      setZoomDragCurrent(null)
      setZoomMode('none')
    }
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    // In zoom-select mode clicks are handled by mousedown/up
    if (zoomMode === 'selecting') return

    // Eyedropper mode — sample the pixel color and assign to the zone
    if (eyedropperZoneId) {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const px = Math.round((e.clientX - rect.left) * scaleX)
      const py = Math.round((e.clientY - rect.top) * scaleY)
      const ctx = canvas.getContext('2d')!
      const [r, g, b] = ctx.getImageData(px, py, 1, 1).data
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
      updateZone(eyedropperZoneId, { fillColor: hex })
      setEyedropperZoneId(null)
      return
    }

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
      // Proximity threshold scales with viewport size (3% of viewport width)
      const vp = viewport ?? { x0: 0, y0: 0, x1: 100, y1: 100 }
      const threshold = (vp.x1 - vp.x0) * 0.04
      if (dist < threshold) {
        finishZone()
        return
      }
    }

    setCurrentPoints(prev => [...prev, pt])
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    // Vertex drag
    if (vertexDrag) {
      const pt = getRelPct(e)
      const zone = zones.find(z => z.id === vertexDrag.zoneId)
      if (zone) {
        const newPoly = zone.polygon.map((v, i) =>
          i === vertexDrag.vertexIndex ? pt : v
        )
        updateZone(vertexDrag.zoneId, { polygon: newPoly })
      }
      return
    }
    // Pivot drag
    if (pivotDragZoneId) {
      const pt = getRelPct(e)
      updateZone(pivotDragZoneId, { pivot: pt })
      return
    }
    // Update zoom drag rectangle
    if (zoomMode === 'selecting' && zoomDragStart) {
      setZoomDragCurrent(getRelPct(e))
      return
    }
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
        {eyedropperZoneId
          ? '🎨 Click any spot on the image to sample that color as the fill for this zone. Press Esc to cancel.'
          : zoomMode === 'selecting'
          ? 'Drag a rectangle on the image to zoom into that area. Release to commit.'
          : drawing
          ? `${currentPoints.length} point${currentPoints.length !== 1 ? 's' : ''} placed — click to add more, click near ● to close, or press Esc to cancel`
          : 'Click anywhere on the image to start drawing a zone. Drag the ● pivot dot to set the sway anchor. Use 🔍 below to zoom in for precision.'
        }
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative w-full rounded-xl overflow-hidden border border-gray-200"
        style={{ cursor: eyedropperZoneId ? 'crosshair' : zoomMode === 'selecting' ? 'crosshair' : drawing ? 'crosshair' : (pivotDragZoneId || vertexDrag) ? 'grabbing' : 'default' }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
          className="w-full select-none"
        />
        {/* Eyedropper active overlay hint */}
        {eyedropperZoneId && (
          <div className="absolute inset-0 border-4 border-orange-400 rounded-xl pointer-events-none" />
        )}
      </div>

      {/* Zoom toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => {
            setZoomMode(zoomMode === 'selecting' ? 'none' : 'selecting')
            setZoomDragStart(null)
            setZoomDragCurrent(null)
          }}
          className={`text-xs px-3 py-1.5 font-semibold rounded-lg border transition-colors ${
            zoomMode === 'selecting'
              ? 'bg-yellow-400 border-yellow-500 text-yellow-900'
              : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
          }`}
        >
          🔍 {zoomMode === 'selecting' ? 'Cancel zoom select' : 'Select zoom area'}
        </button>
        {viewport && (
          <button
            onClick={() => { setViewport(null); setZoomMode('none') }}
            className="text-xs px-3 py-1.5 font-semibold rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
          >
            ✕ Reset zoom
          </button>
        )}
        {viewport && (
          <span className="text-[10px] text-gray-400">
            Zoomed: {viewport.x0.toFixed(0)}–{viewport.x1.toFixed(0)}% × {viewport.y0.toFixed(0)}–{viewport.y1.toFixed(0)}%
          </span>
        )}
        {/* Preview button — always visible when there are zones */}
        {zones.length > 0 && (
          <button
            onClick={() => setShowPreview(true)}
            className="text-xs px-3 py-1.5 font-semibold rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 ml-auto"
          >
            ▶ Preview animation
          </button>
        )}
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
                {/* Fill color — eyedropper to sample + swatch + clear */}
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    title="Sample a background color to fill the polygon gap"
                    onClick={() => setEyedropperZoneId(eyedropperZoneId === zone.id ? null : zone.id)}
                    className={`text-xs px-1.5 py-0.5 rounded border font-semibold transition-colors ${
                      eyedropperZoneId === zone.id
                        ? 'bg-orange-400 border-orange-500 text-white'
                        : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    🎨
                  </button>
                  {/* Use original image as fill */}
                  <button
                    title="Use the original background image as the gap fill"
                    onClick={() => updateZone(zone.id, { fillImage: !zone.fillImage, fillColor: zone.fillImage ? zone.fillColor : undefined })}
                    className={`text-xs px-1.5 py-0.5 rounded border font-semibold transition-colors ${
                      zone.fillImage
                        ? 'bg-blue-500 border-blue-600 text-white'
                        : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    📷
                  </button>
                  {zone.fillColor && !zone.fillImage && (
                    <>
                      <div
                        className="w-4 h-4 rounded border border-gray-300 shrink-0"
                        style={{ background: zone.fillColor }}
                      />
                      <span className="text-[10px] text-gray-500 font-mono">{zone.fillColor}</span>
                      <button
                        onClick={() => updateZone(zone.id, { fillColor: undefined })}
                        className="text-[10px] text-gray-400 hover:text-red-500 leading-none"
                        title="Remove fill color"
                      >✕</button>
                    </>
                  )}
                </div>
                <span className="text-[10px] text-gray-400">{zone.polygon.length} pts</span>
                <button onClick={e => { e.stopPropagation(); deleteZone(zone.id) }}
                  className="text-xs text-red-400 hover:text-red-600 font-bold px-1">✕</button>
              </div>
            )
          })}
        </div>
      )}
      {/* ── Fullscreen animation preview modal ─────────────────────────── */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="relative w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* The live room — background image + animated zones on top */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Room preview"
              className="w-full block"
              draggable={false}
            />
            <AnimatedRoomLayer imageUrl={imageUrl} zones={zones} />

            {/* Close button */}
            <button
              onClick={() => setShowPreview(false)}
              className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white text-sm font-bold px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors"
            >
              ✕ Close
            </button>

            {/* Zone legend */}
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 max-w-[80%]">
              {zones.map((zone, zi) => (
                <span
                  key={zone.id}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white backdrop-blur-sm"
                  style={{ background: ZONE_COLORS[zi % ZONE_COLORS.length] + 'cc' }}
                >
                  {ANIM_OPTIONS.find(o => o.value === zone.animation)?.label ?? zone.animation}
                </span>
              ))}
            </div>

            <p className="absolute bottom-3 right-3 text-[11px] text-white/60">Press Esc or click outside to close</p>
          </div>
        </div>
      )}

    </div>
  )
}

