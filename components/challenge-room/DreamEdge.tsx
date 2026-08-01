/**
 * Finishes the challenge room like a drawing on a page rather than a cropped
 * photograph: the picture feathers gently at its edge, and a loose graphite
 * line is drawn around it, overshooting at the corners the way a hand does.
 *
 * ── TWO HALVES, AND WHY ─────────────────────────────────────
 * A mask can only ever REMOVE pixels. It cannot put a pencil line on the page,
 * and the line is what actually ends the picture here — earlier attempts that
 * were mask-only had to fade enormous amounts to read as anything but a
 * rectangle, which ate the corners of the room. With a drawn boundary the fade
 * can be slight, because the line does the work.
 *
 *   1. a feather      — a soft, slightly wandering alpha edge on the block
 *   2. the ink        — an SVG overlay above it, drawn strokes, no mask
 *
 * ── WHY GEOMETRY, NOT A FILTER, FOR THE INK ─────────────────
 * feDisplacementMap on a 1px stroke does not wobble it, it shreds it: the line
 * dissolves into a grey haze and reads as a blurry frame. Hand-drawn lines have
 * to come from jittered path POINTS, so the stroke stays a stroke.
 *
 * ── WHY THE RANDOMNESS IS SEEDED ────────────────────────────
 * A border that reshuffles itself on every render reads as a glitch, not as a
 * drawing. The PRNG is fixed, so this is the same drawing everywhere, forever.
 *
 * ── A BOLT-ON ───────────────────────────────────────────────
 * It wraps the room block and changes nothing inside it. Deleting the two
 * wrapper lines restores the plain rectangle exactly.
 *
 * ── THE position:fixed TRAP ─────────────────────────────────
 * Book3DReveal keeps its zoomed reading surface as a SIBLING of the stage on
 * purpose: an ancestor carrying filter or transform becomes the containing
 * block for position:fixed, which once trapped the page spread in a small box.
 * A mask can do the same. So this must wrap only the room block — never
 * anything containing the zoomed reader, or the pages get cramped again.
 */

/**
 * Authored in a 600×400 space and stretched to whatever the room block
 * actually is, so these numbers are proportions rather than pixels.
 */
const W = 600
const H = 400

// ── 1. The feather ──────────────────────────────────────────

/**
 * Deliberately slight. The picture should merely soften as it reaches the drawn
 * line; it is the LINE that ends it. Anything heavier here and we are back to
 * the fog version that ate the shelves.
 */
const FEATHER = { inset: 14, blur: 9, freq: 0.022, scale: 10, seed: 5 }

const FEATHER_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" ` +
  `viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">` +
  `<filter id="f" x="-25%" y="-25%" width="150%" height="150%" ` +
  `color-interpolation-filters="sRGB">` +
  `<feGaussianBlur stdDeviation="${FEATHER.blur}" result="s"/>` +
  `<feTurbulence type="fractalNoise" baseFrequency="${FEATHER.freq}" numOctaves="3" ` +
  `seed="${FEATHER.seed}" result="n"/>` +
  `<feDisplacementMap in="s" in2="n" scale="${FEATHER.scale}" ` +
  `xChannelSelector="R" yChannelSelector="G"/></filter>` +
  `<rect x="${FEATHER.inset}" y="${FEATHER.inset}" width="${W - FEATHER.inset * 2}" ` +
  `height="${H - FEATHER.inset * 2}" rx="10" fill="#fff" filter="url(#f)"/></svg>`

const FEATHER_MASK = `url("data:image/svg+xml;utf8,${encodeURIComponent(FEATHER_SVG)}")`

// ── 2. The ink ──────────────────────────────────────────────

/** passes is how many times the pencil goes round; more reads as worked-over. */
const INK = {
  passes: 5,
  inset: 9,
  wobble: 5.5,
  /** How far a stroke runs past the corner. The main thing that says "drawn". */
  overshoot: 26,
  width: 1.05,
  opacity: 0.5,
  colour: '#44403c',
  seed: 77,
}

/** Small deterministic PRNG — see the note on seeding above. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/**
 * One stroke from A to B: walk the line in segments, pushing each waypoint
 * sideways a little, and run past both ends.
 *
 * The sideways push is tapered towards the ends so the strokes still meet near
 * the corners — untapered, every pass flies apart there and the frame stops
 * looking like a rectangle anybody meant to draw.
 */
function strokePath(
  x1: number, y1: number, x2: number, y2: number,
  rand: () => number,
): string {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.hypot(dx, dy)
  const ux = dx / len, uy = dy / len
  const px = -uy, py = ux
  const sx = x1 - ux * INK.overshoot * rand()
  const sy = y1 - uy * INK.overshoot * rand()
  const ex = x2 + ux * INK.overshoot * rand()
  const ey = y2 + uy * INK.overshoot * rand()

  let d = `M ${sx.toFixed(1)} ${sy.toFixed(1)}`
  const SEGMENTS = 9
  for (let i = 1; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS
    const taper = Math.sin(t * Math.PI) * 0.7 + 0.3
    const o = (rand() * 2 - 1) * INK.wobble * taper
    const bx = sx + (ex - sx) * t
    const by = sy + (ey - sy) * t
    d += ` L ${(bx + px * o).toFixed(1)} ${(by + py * o).toFixed(1)}`
  }
  return d
}

interface InkStroke { d: string; opacity: string }

/** Built once at module load: the same drawing on every render. */
const INK_STROKES: InkStroke[] = (() => {
  const rand = makeRandom(INK.seed)
  const strokes: InkStroke[] = []
  for (let i = 0; i < INK.passes; i++) {
    // Each pass sits at its own inset, giving the bundle width the way a
    // pencil worked back and forth does.
    const o = INK.inset + (i - (INK.passes - 1) / 2) * 3.2
    const corners: Array<[number, number]> = [
      [o, o], [W - o, o], [W - o, H - o], [o, H - o],
    ]
    for (let e = 0; e < 4; e++) {
      const [ax, ay] = corners[e]
      const [bx, by] = corners[(e + 1) % 4]
      strokes.push({
        d: strokePath(ax, ay, bx, by, rand),
        opacity: (INK.opacity * (0.7 + rand() * 0.5)).toFixed(2),
      })
    }
  }
  return strokes
})()

export interface DreamEdgeProps {
  children: React.ReactNode
  /**
   * Sizing for the wrapper, forwarded from the call site.
   *
   * The caller owns the box; this component only draws on it. They have to be
   * the SAME box: when the room carried its own width and this wrapper took
   * whatever its parent gave, the border was drawn around the full-width
   * breakout while the picture sat centred and narrower inside it — strokes
   * across the whole page, and a room still ending in a hard rectangle.
   */
  style?: React.CSSProperties
}

export function DreamEdge({ children, style }: DreamEdgeProps) {
  return (
    <div className="relative mx-auto" style={style}>
      <div
        style={{
          maskImage: FEATHER_MASK,
          WebkitMaskImage: FEATHER_MASK,
          // Without an explicit size the SVG's intrinsic 600×400 is used and
          // the mask tiles or sits in a corner.
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
        }}
      >
        {children}
      </div>

      {/* The drawn boundary. Outside the masked element so the feather does not
          eat the very line it is meant to sit under, and pointer-events-none so
          it never swallows a click meant for the book. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        /* An <svg> clips to its viewport by default, which would shear the
           corner overshoots off flat — the one detail that says "drawn". */
        style={{ overflow: 'visible' }}
      >
        {INK_STROKES.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill="none"
            stroke={INK.colour}
            strokeWidth={INK.width}
            strokeOpacity={s.opacity}
            strokeLinecap="round"
            // Keeps the line one pixel wide however the box is stretched.
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  )
}
