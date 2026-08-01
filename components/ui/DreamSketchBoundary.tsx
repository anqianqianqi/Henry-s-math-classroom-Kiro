'use client'

/**
 * Finishes any image or block as an unfinished drawing rather than a cropped
 * rectangle — without touching the artwork.
 *
 * Two independent layers, neither of which modifies the content:
 *
 *   1. an alpha mask that fades only a narrow band at the four edges, on a
 *      softly irregular contour, to TRANSPARENT — so it works over any page
 *      background rather than only over a known colour
 *   2. an inline SVG of sparse, broken pencil strokes drawn over the boundary
 *
 * The centre is never blurred, tinted or filtered. The mask's opaque core
 * covers everything inside the band.
 *
 * ── WHY THE LINES MATTER MORE THAN THE FADE ─────────────────
 * On a pale image over a pale page an alpha fade is nearly invisible: there is
 * no luminance difference to reveal it. Fading harder to compensate eats the
 * picture and reads as fog. So the fade only removes the hard cut, and the
 * STROKES are what say where the picture ends. That is why the defaults here
 * are a narrow band and very light ink rather than the reverse.
 *
 * ── WHY IT MEASURES ITSELF ──────────────────────────────────
 * The obvious implementation authors the effect in a fixed viewBox and lets it
 * stretch. That quietly breaks at any aspect ratio but the one it was drawn
 * for: turbulence blobs stretch into streaks, the band ends up thicker on two
 * sides than the other two, and stroke jitter squashes. Measuring and
 * generating in real pixels keeps the noise isotropic and the band even.
 *
 * ── WHY THE INK IS INLINE AND THE MASK IS A DATA URI ────────
 * CSS custom properties do not resolve inside a data-URI SVG, so `lineColor`
 * would silently fall back if the ink were built the same way as the mask. The
 * mask needs no colour, so a data URI is fine there — and is the safer choice,
 * since SVG <mask> elements referencing HTML content are still uneven across
 * browsers.
 *
 * ── CONSUMER BEWARE ─────────────────────────────────────────
 * Strokes may reach slightly outside the box on purpose. An ancestor with
 * overflow:hidden will shear them off flat.
 *
 * An ancestor carrying filter or transform becomes the containing block for
 * position:fixed descendants, and a mask can do the same — so do not wrap
 * anything that contains a position:fixed overlay.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

export interface DreamSketchBoundaryProps {
  children: React.ReactNode

  /**
   * Depth of the fade band, as a fraction of the shorter side.
   *
   * The whole fade lives inside this: at the default the outer 6% dissolves
   * and the inner 94% is untouched, comfortably past the 88% the design calls
   * for.
   */
  fadeWidth?: number

  /**
   * 0–1: how far the boundary wanders off the rectangle.
   *
   * Below about 0.3 the wander stops being legible and you get a soft-edged
   * rectangle, which looks like a mistake rather than an effect. Above about
   * 0.8 it starts to read as torn paper.
   */
  irregularity?: number

  /** Roughly how many strokes are drawn. Sparse on purpose — see buildStrokes. */
  lineDensity?: number

  /** Any CSS colour. A var() works because this layer is inline SVG. */
  lineColor?: string

  /** Scales fade depth and ink opacity together. 0 disables the effect. */
  strength?: number

  /** Change for a different drawing at identical settings. */
  seed?: number

  className?: string
  style?: React.CSSProperties
}

/**
 * Small deterministic PRNG.
 *
 * Seeded because a boundary that reshuffles itself on every render reads as a
 * glitch rather than as a drawing.
 */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/**
 * The band geometry, derived so the entire fade fits within `fadeWidth`.
 *
 * A blur reaches about 2σ and a displacement about half its scale, so the rect
 * has to be inset by at least that much or the parent clips the result — and
 * anything clipped comes back as a straight line, which is the whole problem
 * this component exists to solve.
 */
function geometry(w: number, h: number, fadeWidth: number, irregularity: number, strength: number) {
  const band = Math.min(w, h) * fadeWidth * strength
  return {
    band,
    inset: band * 0.5,
    blur: band * 0.15,
    /** feDisplacementMap moves pixels by ±scale/2, hence the halving above. */
    displace: band * 0.8 * irregularity,
    /** Corners softened by a radius, not erased by one. */
    radius: band * 1.5,
    /** Low frequency: a few gentle undulations per edge, not a rough texture. */
    frequency: 3.2 / Math.min(w, h),
  }
}

function buildMask(
  w: number, h: number, fadeWidth: number, irregularity: number,
  strength: number, seed: number,
): string {
  const g = geometry(w, h, fadeWidth, irregularity, strength)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
    `viewBox="0 0 ${w} ${h}">` +
    `<filter id="m" x="-20%" y="-20%" width="140%" height="140%" ` +
    `color-interpolation-filters="sRGB">` +
    `<feGaussianBlur stdDeviation="${g.blur.toFixed(2)}" result="s"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="${g.frequency.toFixed(5)}" ` +
    `numOctaves="2" seed="${seed}" result="n"/>` +
    `<feDisplacementMap in="s" in2="n" scale="${g.displace.toFixed(2)}" ` +
    `xChannelSelector="R" yChannelSelector="G"/>` +
    `</filter>` +
    `<rect x="${g.inset.toFixed(1)}" y="${g.inset.toFixed(1)}" ` +
    `width="${(w - g.inset * 2).toFixed(1)}" height="${(h - g.inset * 2).toFixed(1)}" ` +
    `rx="${g.radius.toFixed(1)}" fill="#fff" filter="url(#m)"/></svg>`
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
}

interface Stroke {
  d: string
  opacity: number
  width: number
  dash?: string
}

/**
 * Sparse, broken strokes around the perimeter.
 *
 * Each covers only a fraction of one edge and each edge is chosen at random,
 * so some edges get two or three marks and some corners get none — which is
 * what makes it read as abandoned partway rather than as a frame. A stroke per
 * edge, evenly spaced, is a border; this is a sketch.
 */
function buildStrokes(
  w: number, h: number, fadeWidth: number, irregularity: number,
  strength: number, density: number, seed: number,
): Stroke[] {
  const g = geometry(w, h, fadeWidth, irregularity, strength)
  const rand = makeRandom(seed)
  const strokes: Stroke[] = []

  for (let i = 0; i < density; i++) {
    const edge = Math.floor(rand() * 4)
    const horizontal = edge === 0 || edge === 2
    const along = horizontal ? w : h
    // Where the line sits across the band — some inside the picture, some out
    // in the fading part, so the bundle is not a single traced outline.
    const off = g.inset * (0.4 + rand() * 1.5)

    const start = rand() * 0.68
    const length = 0.08 + rand() * 0.3
    // A quarter of the strokes run past their corner, the way a hand does.
    const over = rand() < 0.25 ? 0.04 : 0
    const t0 = start - over
    const t1 = Math.min(1.02, start + length + over)

    const a = t0 * along
    const b = t1 * along
    const fixed = edge === 0 ? off
      : edge === 1 ? w - off
      : edge === 2 ? h - off
      : off

    const pts: Array<[number, number]> = []
    const SEGMENTS = 7
    const wobble = g.band * 0.22 * (0.5 + irregularity)
    for (let k = 0; k <= SEGMENTS; k++) {
      const t = k / SEGMENTS
      const p = a + (b - a) * t
      // Taper so the ends settle rather than flick outward.
      const taper = Math.sin(t * Math.PI) * 0.75 + 0.25
      const o = (rand() * 2 - 1) * wobble * taper
      pts.push(horizontal ? [p, fixed + o] : [fixed + o, p])
    }

    strokes.push({
      d: pts.map(([x, y], k) =>
        `${k === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' '),
      opacity: (0.08 + rand() * 0.14) * strength,
      width: 0.8 + rand() * 0.8,
      // Dry brush on roughly half of them: the line skips rather than holding
      // an even weight, which is most of what separates pencil from a border.
      dash: rand() < 0.45
        ? `${(5 + rand() * 16).toFixed(1)} ${(3 + rand() * 10).toFixed(1)}`
        : undefined,
    })
  }
  return strokes
}

/** Assumed until the first measurement lands — see the note on measuring. */
const ASSUMED = { w: 900, h: 600 }

export function DreamSketchBoundary({
  children,
  fadeWidth = 0.06,
  irregularity = 0.5,
  lineDensity = 10,
  lineColor = 'var(--dream-ink, currentColor)',
  strength = 1,
  seed = 20260801,
  className,
  style,
}: DreamSketchBoundaryProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      const r = entries[0].contentRect
      // Rounded to 4px so a scrollbar appearing or a sub-pixel reflow does not
      // rebuild the mask and the drawing on every frame of a resize.
      const w = Math.max(1, Math.round(r.width / 4) * 4)
      const h = Math.max(1, Math.round(r.height / 4) * 4)
      setSize(prev => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { w, h } = size ?? ASSUMED

  const mask = useMemo(
    () => buildMask(w, h, fadeWidth, irregularity, strength, seed),
    [w, h, fadeWidth, irregularity, strength, seed],
  )
  const strokes = useMemo(
    () => buildStrokes(w, h, fadeWidth, irregularity, strength, lineDensity, seed),
    [w, h, fadeWidth, irregularity, strength, lineDensity, seed],
  )

  return (
    <div ref={ref} className={`relative ${className ?? ''}`} style={style}>
      <div
        style={{
          maskImage: mask,
          WebkitMaskImage: mask,
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
        }}
      >
        {children}
      </div>

      {/* Outside the masked element, so the fade does not erase the very lines
          meant to sit in it. pointer-events-none so it never eats a click, and
          overflow visible because an outermost <svg> otherwise clips its own
          strokes flat at the corners. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        {strokes.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill="none"
            stroke={lineColor}
            strokeWidth={s.width}
            strokeOpacity={s.opacity}
            strokeLinecap="round"
            strokeDasharray={s.dash}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  )
}
