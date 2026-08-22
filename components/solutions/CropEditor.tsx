'use client'

/**
 * Drawing the crop by hand, when the measured one is wrong.
 *
 * The page is measured for the block of handwriting under the printed card,
 * which is right most of the time and cannot be right always: an answer
 * written up the side of the sheet, two problems worked in one column, a
 * thumb over the corner of a photo. This is the way out of all of those at
 * once — the whole page, with a box on it, and a drag to redraw it.
 *
 * ── DRAG TO REDRAW, NOT DRAG TO RESIZE ──────────────────────
 * No handles on the corners. Handles are a fiddly target on a phone, where
 * this will mostly be used, and they only help when the box is nearly right —
 * which is the case where nobody opens this. Starting a new rectangle is one
 * gesture, works the same under a finger and a mouse, and needs no
 * instruction beyond the one line above the picture.
 */

import { useRef, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import type { Box } from '@/lib/solutions/crop'
import type { RenderedPage } from '@/lib/solutions/pages'

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** A drag is a crop only once it covers something; a tap is not a box. */
const MIN_DRAG = 0.02

export function CropEditor({
  page, box, title, onCancel, onSave,
}: {
  page: RenderedPage
  /** Where the crop is now, drawn on the page when this opens. */
  box: Box | null
  title: string
  onCancel: () => void
  onSave: (box: Box) => void
}) {
  const { t } = useLanguage()
  const surface = useRef<HTMLDivElement>(null)
  const [drawn, setDrawn] = useState<Box | null>(box)
  const [dragFrom, setDragFrom] = useState<{ x: number; y: number } | null>(null)

  /*
    The page as a picture, made once.

    toDataURL on a 2000px canvas is not free, and re-running it on every
    pointer move — which is what putting it in the render body would do —
    turns a drag into a slideshow.
  */
  const [src] = useState(() => page.canvas.toDataURL('image/jpeg', 0.85))

  /** Pointer position as a fraction of the picture, however it is scaled. */
  function at(e: React.PointerEvent): { x: number; y: number } {
    const rect = surface.current!.getBoundingClientRect()
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    }
  }

  function down(e: React.PointerEvent) {
    // Captured so a drag that leaves the picture — very easy on a phone —
    // keeps reporting instead of stopping at the edge.
    surface.current?.setPointerCapture(e.pointerId)
    const p = at(e)
    setDragFrom(p)
    setDrawn({ x: p.x, y: p.y, w: 0, h: 0 })
  }

  function move(e: React.PointerEvent) {
    if (!dragFrom) return
    const p = at(e)
    setDrawn({
      x: Math.min(dragFrom.x, p.x),
      y: Math.min(dragFrom.y, p.y),
      w: Math.abs(p.x - dragFrom.x),
      h: Math.abs(p.y - dragFrom.y),
    })
  }

  function up(e: React.PointerEvent) {
    surface.current?.releasePointerCapture(e.pointerId)
    setDragFrom(null)
    // A tap, or a twitch: keep whatever was there rather than leaving a
    // sliver of a box that would crop to nothing.
    setDrawn(d => (d && (d.w < MIN_DRAG || d.h < MIN_DRAG) ? box : d))
  }

  const usable = Boolean(drawn && drawn.w >= MIN_DRAG && drawn.h >= MIN_DRAG)
  const pct = (n: number) => `${n * 100}%`

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-black/70 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="mx-auto my-2 w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{title}</p>
            <p className="text-xs text-gray-600">{t('sol.cropHint')}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('sol.closePreview')}
            className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
          >
            ✕
          </button>
        </div>

        <div
          ref={surface}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          // Without this the browser claims the gesture for scrolling and the
          // drag never reaches us on a touch screen.
          style={{ touchAction: 'none' }}
          className="relative select-none overflow-hidden rounded-lg border border-gray-300 bg-gray-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={title} draggable={false} className="block w-full select-none" />

          {drawn && (
            <>
              {/* Everything outside the box, dimmed, so the crop reads as the
                  part that stays rather than the part that is highlighted. */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-x-0 top-0 bg-black/45" style={{ height: pct(drawn.y) }} />
                <div className="absolute inset-x-0 bottom-0 bg-black/45" style={{ height: pct(1 - drawn.y - drawn.h) }} />
                <div className="absolute left-0 bg-black/45"
                  style={{ top: pct(drawn.y), height: pct(drawn.h), width: pct(drawn.x) }} />
                <div className="absolute right-0 bg-black/45"
                  style={{ top: pct(drawn.y), height: pct(drawn.h), width: pct(1 - drawn.x - drawn.w) }} />
              </div>
              <div
                className="pointer-events-none absolute border-2 border-primary-500"
                style={{ left: pct(drawn.x), top: pct(drawn.y), width: pct(drawn.w), height: pct(drawn.h) }}
              />
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!usable}
            onClick={() => drawn && onSave(drawn)}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white
                       transition-colors hover:bg-primary-700 disabled:opacity-40"
          >
            {t('sol.cropSave')}
          </button>
          {box && (
            <button
              type="button"
              onClick={() => setDrawn(box)}
              className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              {t('sol.cropReset')}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            {t('action.cancel')}
          </button>
          <button
            type="button"
            onClick={() => setDrawn({ x: 0, y: 0, w: 1, h: 1 })}
            className="ml-auto rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
          >
            {t('sol.cropWholePage')}
          </button>
        </div>
      </div>
    </div>
  )
}
