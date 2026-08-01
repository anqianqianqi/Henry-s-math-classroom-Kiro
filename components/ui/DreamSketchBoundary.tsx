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

  /**
   * Scales the ink alone, leaving the fade where it is.
   *
   * Separate from `strength` because the two are tuned against different
   * things: the fade against how much picture you can spare, the ink against
   * how busy the artwork underneath is. Wanting a firmer pencil is not a
   * reason to deepen the fade.
   */
  inkStrength?: number

  /**
   * URL of a drawn frame to use instead of the generated strokes.
   *
   * Must be a PNG whose ALPHA is the drawing — it is used as a mask and filled
   * with `lineColor`, so the artwork's own colours are discarded and the ink
   * stays tunable in CSS. scripts/png-to-alpha.mjs converts a drawing on a
   * green screen or white paper into that form.
   *
   * Worth the asset: procedural strokes can get the geometry right — placement,
   * smoothness, breaks — but not the texture. Real graphite has paper tooth,
   * pressure falling off mid-stroke, edges that are not a constant width. An
   * SVG path is a perfect ribbon of uniform opacity, so it reads as synthetic
   * however carefully the shape is tuned.
   *
   * The image is stretched to the box, so its aspect ratio should match. Ours
   * is 3:2, which is what the room always is.
   */
  edgeTexture?: string

  /** Change for a different drawing at identical settings. Generated mode only. */
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
 * Where a distance round the outside lands: which edge, and how far along it.
 *
 * Edges are numbered clockwise from the top. Working in perimeter distance
 * rather than per-edge keeps the marks evenly spread on any aspect ratio — on
 * a 21:9 box the long sides get proportionally more of them, which is what a
 * hand tracing the shape would actually do.
 */
function perimeterPoint(s: number, w: number, h: number): { edge: number; t: number } {
  let d = s * 2 * (w + h)
  if (d < w) return { edge: 0, t: d / w }
  d -= w
  if (d < h) return { edge: 1, t: d / h }
  d -= h
  if (d < w) return { edge: 2, t: d / w }
  d -= w
  return { edge: 3, t: d / h }
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
  strength: number, inkStrength: number, density: number, seed: number,
): Stroke[] {
  const g = geometry(w, h, fadeWidth, irregularity, strength)
  const rand = makeRandom(seed)
  const strokes: Stroke[] = []

  /** One mark. Pulled out so a stroke can be drawn twice, slightly apart. */
  function mark(edge: number, start: number, length: number, off: number,
                opacity: number, width: number, dash?: string) {
    const horizontal = edge === 0 || edge === 2
    const along = horizontal ? w : h
    const a = start * along
    const b = Math.min(1.04, start + length) * along
    const fixed = edge === 0 ? off
      : edge === 1 ? w - off
      : edge === 2 ? h - off
      : off

    /*
      A pencil line deviates SMOOTHLY. Offsetting each point by its own random
      amount is white noise, and white noise draws a sawtooth — which is what
      those stray zigzags along the edge were. So the deviation is a continuous
      function of position instead: one gentle bow along the whole stroke, plus
      at most a cycle or so of undulation on top.
    */
    const wobble = g.band * (0.5 + irregularity)
    const bow = (rand() * 2 - 1) * wobble * 0.30
    const amplitude = wobble * 0.14 * (0.4 + rand())
    const phase = rand() * Math.PI * 2
    const cycles = 0.5 + rand() * 1.1

    const pts: Array<[number, number]> = []
    const SEGMENTS = 14
    for (let k = 0; k <= SEGMENTS; k++) {
      const t = k / SEGMENTS
      const p = a + (b - a) * t
      // Taper so the ends settle onto the line rather than flicking outward.
      const taper = Math.sin(t * Math.PI) * 0.75 + 0.25
      const o = taper * (
        bow * Math.sin(t * Math.PI) +
        amplitude * Math.sin(phase + t * Math.PI * 2 * cycles)
      )
      pts.push(horizontal ? [p, fixed + o] : [fixed + o, p])
    }

    strokes.push({
      d: pts.map(([x, y], k) =>
        `${k === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' '),
      opacity,
      width,
      dash,
    })
  }

  for (let i = 0; i < density; i++) {
    // Walk the perimeter at even intervals with a little jitter, rather than
    // picking an edge at random. Random picking clusters marks on one or two
    // sides and leaves whole edges bare, which reads as scattered debris
    // instead of a hand tracing round the outside.
    const s = ((i + 0.5 + (rand() - 0.5) * 0.7) / density + 1) % 1
    const { edge, t } = perimeterPoint(s, w, h)
    const along = edge === 0 || edge === 2 ? w : h

    // Length set in pixels, then converted, so a mark is the same physical
    // length on the short sides as on the long ones.
    const lengthPx = (0.03 + Math.pow(rand(), 1.5) * 0.12) * Math.min(w, h) * 1.6
    const length = Math.min(0.9, lengthPx / along)

    // Kept close to the boundary: this is a traced outline, not confetti. The
    // spread is about half the band, enough that the marks are not one clean
    // line but not so much that they drift into the picture.
    const off = g.inset * (0.7 + rand() * 0.7)
    const start = Math.max(-0.03, Math.min(t, 1 - length * 0.35))

    const opacity = (0.08 + rand() * 0.14) * strength * inkStrength
    const width = 0.8 + rand() * 0.8
    // Dry brush on roughly half: the line skips rather than holding an even
    // weight, which is most of what separates pencil from a drawn border.
    const dash = rand() < 0.45
      ? `${(5 + rand() * 16).toFixed(1)} ${(3 + rand() * 10).toFixed(1)}`
      : undefined

    mark(edge, start, length, off, opacity, width, dash)

    // Pencil doubles back. A second, fainter pass a hair off the first is the
    // single clearest tell of graphite rather than a vector stroke.
    if (rand() < 0.4) {
      mark(edge, start + (rand() * 0.03 - 0.015), length * (0.6 + rand() * 0.5),
           off + (rand() * 2 - 1) * g.inset * 0.3,
           opacity * 0.65, width * 0.8, dash)
    }

    // Dry brush: thinner, fainter, broken into short dashes. These carry the
    // texture of the perimeter without darkening it — the weight comes from
    // the marks above, the sketchiness from these.
    if (rand() < 0.7) {
      mark(edge, start + (rand() * 0.06 - 0.03), length * (0.5 + rand() * 0.8),
           off + (rand() * 2 - 1) * g.inset * 0.55,
           opacity * 0.45, width * 0.55,
           `${(1.5 + rand() * 5).toFixed(1)} ${(2 + rand() * 6).toFixed(1)}`)
    }
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
  inkStrength = 1,
  edgeTexture,
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
    () => buildStrokes(w, h, fadeWidth, irregularity, strength, inkStrength, lineDensity, seed),
    [w, h, fadeWidth, irregularity, strength, inkStrength, lineDensity, seed],
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

      {/* Both ink layers sit OUTSIDE the masked element, so the fade does not
          erase the very marks meant to sit in it, and pointer-events-none so
          neither can eat a click meant for the content. */}

      {edgeTexture ? (
        // The drawing is the mask; the colour comes from CSS. That way the ink
        // can be re-tinted or dimmed without regenerating the artwork.
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: lineColor,
            opacity: Math.max(0, Math.min(1, inkStrength)),
            maskImage: `url(${edgeTexture})`,
            WebkitMaskImage: `url(${edgeTexture})`,
            maskSize: '100% 100%',
            WebkitMaskSize: '100% 100%',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        />
      ) : (
      /* overflow visible because an outermost <svg> otherwise clips its own
         strokes flat at the corners. */
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
      )}
    </div>
  )
}
