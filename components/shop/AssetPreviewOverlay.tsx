'use client'

/**
 * Full-screen preview for a shop asset, stacked on top of a browse modal.
 *
 * ── WHY IT TAKES A LIST OF PANES ────────────────────────────
 * A challenge room is one picture. A book bundle is a PAIR — the cover wraps
 * the closed book and the inner texture backs both open pages — and the folder
 * thumbnail can only show the cover, so half of what is being bought is
 * invisible until it is owned. Showing both halves is the whole reason this
 * exists, and it is the same call BundleCollection made for the decorations
 * page.
 *
 * ── WHY IT IS NOT THE 3D STAGE ──────────────────────────────
 * RoomPlacementStage would show the room with the book actually on the table,
 * which is more faithful. It also pulls in three.js and a 2.6 MiB GLB — the
 * exact cost ChallengeBookShell refuses to pay on mobile, where the 3D path
 * never runs at all. A student browsing a shop folder should not download a
 * model to look at a product photo.
 *
 * The empty middle of a room plate is not a rendering gap, so nothing is being
 * hidden by leaving it out: the room is sold without a book, and whichever
 * bundle the student owns is what lands there.
 */

import { useEffect } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

export interface PreviewPane {
  url: string
  /** Shown under the image when there is more than one — 'Cover', 'Inner pages'. */
  label?: string
}

export function AssetPreviewOverlay({
  name,
  panes,
  onClose,
}: {
  name: string
  panes: PreviewPane[]
  onClose: () => void
}) {
  const { t } = useLanguage()

  // Escape closes. The browse modal underneath has its own click-outside, and
  // without this the only way out of a preview opened by keyboard is the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (panes.length === 0) return null
  const pair = panes.length > 1

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={name}
    >
      <div
        className={`relative w-full ${pair ? 'max-w-4xl' : 'max-w-3xl'}`}
        onClick={e => e.stopPropagation()}
      >
        {/*
          A toolbar row rather than a corner button.

          Absolute in the corner, it landed on the artwork — the wrapper is
          max-w-4xl while the images centre at their own narrower width, so
          "top-3 right-3" is over the picture, measured ~50px into the inner
          page. Pinned to the viewport instead, it disappeared under the
          language switcher, which is fixed at z-[70] and outranks this overlay.
          A row above the images collides with neither.
        */}
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="bg-black/50 hover:bg-black/70 text-white text-sm font-bold px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors"
          >
            ✕ {t('shop.closePreview')}
          </button>
        </div>

        <div className={`flex justify-center items-start gap-3 ${pair ? '' : 'block'}`}>
          {panes.map((pane, i) => (
            <figure key={i} className="rounded-2xl overflow-hidden shadow-2xl bg-black/20 min-w-0">
              {/*
                w-auto with both maxima, not w-full: a replaced element only
                keeps its aspect ratio when one axis is free. Fixed at w-full,
                max-h squashes the picture instead of shrinking it.

                The height cap is what makes a PAIR viable at all — two 3:4
                covers at half of max-w-4xl are ~590px tall each, which
                overflows a laptop viewport before the caption is even counted.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pane.url}
                alt={pane.label ? `${name} — ${pane.label}` : name}
                className="block w-auto max-w-full max-h-[70vh] object-contain"
                draggable={false}
              />
              {pane.label && (
                <figcaption className="bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-3 py-2 text-center">
                  {pane.label}
                </figcaption>
              )}
            </figure>
          ))}
        </div>

        {/* Author-written name, so it is shown as typed and never translated. */}
        <div className="mt-3 text-center text-white/90 text-sm font-semibold">{name}</div>
      </div>
    </div>
  )
}
