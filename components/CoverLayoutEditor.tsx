'use client'

import { useState, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface TextLayer {
  x: number       // % from left  (0–100)
  y: number       // % from top   (0–100)
  fontSize: number
  color: string
  shadow: boolean
}

export interface CoverLayout {
  title: TextLayer
  prompt: TextLayer
}

export const DEFAULT_LAYOUT: CoverLayout = {
  title:  { x: 50, y: 22, fontSize: 20, color: '#f0dea0', shadow: true },
  prompt: { x: 50, y: 82, fontSize: 14, color: '#f5e6b0', shadow: true },
}

interface Props {
  imageUrl: string          // preview URL of the uploaded cover image
  layout: CoverLayout
  onChange: (layout: CoverLayout) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// CoverLayoutEditor
//
// Shows a live preview of the cover image with two draggable text overlays:
//   • Title  (e.g. "Challenge Title")
//   • Prompt (e.g. "Open the Book")
//
// Drag either element to reposition. Use the controls below to change
// font size, color, and text shadow.
// ─────────────────────────────────────────────────────────────────────────────
export function CoverLayoutEditor({ imageUrl, layout, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<'title' | 'prompt' | null>(null)
  const [activeLayer, setActiveLayer] = useState<'title' | 'prompt'>('title')

  // ── Drag logic ──────────────────────────────────────────────────────────────
  const startDrag = useCallback(
    (layer: 'title' | 'prompt') =>
      (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault()
        setDragging(layer)
        setActiveLayer(layer)
      },
    []
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100))
      const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100))
      onChange({ ...layout, [dragging]: { ...layout[dragging], x, y } })
    },
    [dragging, layout, onChange]
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!dragging || !containerRef.current) return
      const touch = e.touches[0]
      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(5, Math.min(95, ((touch.clientX - rect.left) / rect.width) * 100))
      const y = Math.max(5, Math.min(95, ((touch.clientY - rect.top) / rect.height) * 100))
      onChange({ ...layout, [dragging]: { ...layout[dragging], x, y } })
    },
    [dragging, layout, onChange]
  )

  const stopDrag = useCallback(() => setDragging(null), [])

  // ── Controls for active layer ───────────────────────────────────────────────
  const layer = layout[activeLayer]

  function updateLayer(patch: Partial<TextLayer>) {
    onChange({ ...layout, [activeLayer]: { ...layer, ...patch } })
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        <strong>Drag</strong> the title or prompt on the preview to reposition. Click a label to select it for styling.
      </p>

      {/* ── Live preview ── */}
      <div
        ref={containerRef}
        className="relative mx-auto overflow-hidden rounded-xl select-none"
        style={{ width: '100%', maxWidth: 360, aspectRatio: '2/3', cursor: dragging ? 'grabbing' : 'default' }}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onTouchMove={onTouchMove}
        onTouchEnd={stopDrag}
      >
        {/* Cover image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Cover preview"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          draggable={false}
        />

        {/* Title label */}
        <DraggableLabel
          text="Challenge Title"
          layer={layout.title}
          isActive={activeLayer === 'title'}
          isDragging={dragging === 'title'}
          onMouseDown={startDrag('title')}
          onTouchStart={startDrag('title')}
          onClick={() => setActiveLayer('title')}
        />

        {/* Prompt label */}
        <DraggableLabel
          text="📜 Open the Book"
          layer={layout.prompt}
          isActive={activeLayer === 'prompt'}
          isDragging={dragging === 'prompt'}
          onMouseDown={startDrag('prompt')}
          onTouchStart={startDrag('prompt')}
          onClick={() => setActiveLayer('prompt')}
          pill
        />
      </div>

      {/* ── Controls ── */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        {/* Layer selector */}
        <div className="flex gap-2">
          {(['title', 'prompt'] as const).map(l => (
            <button
              key={l}
              onClick={() => setActiveLayer(l)}
              className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-semibold transition-colors ${
                activeLayer === l
                  ? 'bg-amber-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-amber-300'
              }`}
            >
              {l === 'title' ? '📝 Title' : '📜 Open Prompt'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Font size */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Font size: <strong>{layer.fontSize}px</strong>
            </label>
            <input
              type="range" min={10} max={40} step={1}
              value={layer.fontSize}
              onChange={e => updateLayer({ fontSize: +e.target.value })}
              className="w-full accent-amber-500"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={layer.color}
                onChange={e => updateLayer({ color: e.target.value })}
                className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer"
              />
              <input
                type="text"
                value={layer.color}
                onChange={e => {
                  if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                    updateLayer({ color: e.target.value })
                  }
                }}
                className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg font-mono"
                maxLength={7}
              />
            </div>
          </div>
        </div>

        {/* Text shadow toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={layer.shadow}
            onChange={e => updateLayer({ shadow: e.target.checked })}
            className="accent-amber-500"
          />
          <span className="text-sm text-gray-700">Text shadow (improves readability)</span>
        </label>

        {/* Position display */}
        <p className="text-xs text-gray-400">
          Position: {Math.round(layer.x)}% from left, {Math.round(layer.y)}% from top
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DraggableLabel — a positioned text element on the preview canvas
// ─────────────────────────────────────────────────────────────────────────────
function DraggableLabel({
  text,
  layer,
  isActive,
  isDragging,
  onMouseDown,
  onTouchStart,
  onClick,
  pill = false,
}: {
  text: string
  layer: TextLayer
  isActive: boolean
  isDragging: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onTouchStart: (e: React.TouchEvent) => void
  onClick: () => void
  pill?: boolean
}) {
  const shadow = layer.shadow
    ? '0 1px 6px rgba(0,0,0,0.9), 0 0 16px rgba(0,0,0,0.6)'
    : undefined

  return (
    <div
      className="absolute"
      style={{
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        transform: 'translate(-50%, -50%)',
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isActive ? 20 : 10,
        touchAction: 'none',
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={onClick}
    >
      <div
        style={{
          fontSize: layer.fontSize,
          color: layer.color,
          textShadow: shadow,
          fontFamily: '"Georgia", serif',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          padding: pill ? '4px 14px' : undefined,
          borderRadius: pill ? '999px' : undefined,
          background: pill ? 'rgba(40,25,5,0.65)' : undefined,
          border: pill ? '1px solid rgba(200,160,60,0.5)' : undefined,
          backdropFilter: pill ? 'blur(4px)' : undefined,
          outline: isActive ? '2px dashed rgba(255,180,0,0.8)' : '2px dashed transparent',
          outlineOffset: '3px',
        }}
      >
        {text}
      </div>
    </div>
  )
}
