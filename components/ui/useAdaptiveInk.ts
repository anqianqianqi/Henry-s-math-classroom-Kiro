'use client'

/**
 * Picks the sketch-boundary ink from the artwork it will be drawn on.
 *
 * Samples only the band where the frame actually sits — the outer few percent —
 * because that is what the ink has to contrast against. Averaging the whole
 * image would let a bright window in the middle of a dark room vote for an ink
 * that is invisible at the edges, which is exactly the failure being fixed.
 *
 * See lib/ui/adaptiveInk.ts for the rule and the measurements behind it.
 */

import { useEffect, useState } from 'react'
import { INK_DARK, inkForLuminance, luminance } from '@/lib/ui/adaptiveInk'

/** Sampled at low resolution: this decides one boolean, not a colour grade. */
const SAMPLE_WIDTH = 240

/** The band the frame occupies, as a fraction of the shorter side. */
const BAND_INNER = 0.02
const BAND_OUTER = 0.06

function edgeLuminance(img: HTMLImageElement): number {
  const w = SAMPLE_WIDTH
  const h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(img, 0, 0, w, h)

  // Throws a SecurityError if the image tainted the canvas — caught by the
  // caller, which then keeps the default rather than failing.
  const { data } = ctx.getImageData(0, 0, w, h)

  const short = Math.min(w, h)
  const lo = Math.max(1, Math.round(short * BAND_INNER))
  const hi = Math.max(lo + 1, Math.round(short * BAND_OUTER))

  let sum = 0
  let n = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inset = Math.min(x, y, w - 1 - x, h - 1 - y)
      if (inset < lo || inset > hi) continue
      const i = (y * w + x) * 4
      sum += luminance(data[i], data[i + 1], data[i + 2])
      n++
    }
  }
  if (!n) throw new Error('empty sample band')
  return sum / n
}

export function useAdaptiveInk(src: string | undefined | null): string {
  const [ink, setInk] = useState(INK_DARK)

  useEffect(() => {
    if (!src) {
      setInk(INK_DARK)
      return
    }
    let cancelled = false
    const img = new Image()
    // Required before the canvas will hand back pixels for a remote image.
    // Room art is served from Supabase storage, which sends the CORS header;
    // if a future source does not, the read throws and we fall back.
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      if (cancelled) return
      try {
        setInk(inkForLuminance(edgeLuminance(img)))
      } catch {
        // A tainted canvas, a missing 2d context, a zero-size image. None of
        // these are worth breaking a room over — the default ink is correct
        // for the pale rooms that are most common.
        setInk(INK_DARK)
      }
    }
    img.onerror = () => { if (!cancelled) setInk(INK_DARK) }
    img.src = src

    return () => { cancelled = true }
  }, [src])

  return ink
}
