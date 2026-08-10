/**
 * The painted-paper treatment for cards: a warm wash on textured stock, with
 * the edge dissolving on an irregular contour.
 *
 * ── WHY A CARD NEEDS A TINT BEFORE ANY OF THIS WORKS ────────
 * A mask can only remove pixels, so a soft boundary needs something to reveal.
 * Today's card is white on a near-white page and is defined entirely by its
 * border and shadow — both of which a mask destroys: a mask clips box-shadow
 * outright, and a 1px border traces the exact rectangle being softened. Masked
 * and left white, a card becomes an ambiguous shape. The wash is what gives the
 * fade something to show.
 *
 * ── WHY IT IS NOT DreamSketchBoundary ───────────────────────
 * That component measures each element so its noise stays isotropic at any
 * aspect ratio, which matters for a room filling the viewport. Cards do not
 * need it: measured, thirty cards in a grid are all the same size and the
 * browser rasterises ONE mask for the lot. So a single mask authored once and
 * stretched is the same picture for a fraction of the cost — and it keeps Card
 * a plain function with no hooks, no ResizeObserver, and no 'use client'.
 *
 * The band is thin enough that stretching it across the range of real card
 * shapes is not visible.
 *
 * Variants and the reasoning behind the chosen one are in
 * docs/card-boundary-variants.html.
 */

/** Nominal authoring size — a typical stat card. Stretched to whatever it lands on. */
const W = 320
const H = 160

/**
 * Fraction of the shorter side the fade occupies.
 *
 * Much narrower than the room's 0.06, and the reason is the stretch. The mask
 * is authored once at W×H and scaled to each card, so the band scales too: at
 * 0.06 a full-width card ~880px across gets a 26px band, which is wider than
 * Card.Body's 24px padding — and the fade starts eating the text. Measured
 * against the widest real cards, 0.035 keeps the band inside the padding
 * everywhere while still reading as a soft edge at card scale.
 */
const FADE = 0.035

const band = Math.min(W, H) * FADE
const inset = band * 0.5
const blur = band * 0.15
const displace = band * 0.8 * 0.5
const radius = band * 1.5
const frequency = 3.2 / Math.min(W, H)

/*
  preserveAspectRatio="none" is load-bearing, not decoration.

  With a viewBox and no such attribute the default is "meet": the mask
  letterboxes instead of stretching. Authored 2:1 and used on a 3.2:1 card that
  leaves ~106px fully transparent down each side — the card loses a third of
  itself and the text inside it goes with it.

  DreamSketchBoundary never hits this because it regenerates the mask at the
  measured size, so its viewBox always matches and "meet" is a no-op. Here the
  whole point is one mask stretched to many shapes, so the stretch has to be
  asked for explicitly.
*/
const MASK_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" ` +
  `viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">` +
  `<filter id="m" x="-20%" y="-20%" width="140%" height="140%" ` +
  `color-interpolation-filters="sRGB">` +
  `<feGaussianBlur stdDeviation="${blur.toFixed(2)}" result="s"/>` +
  `<feTurbulence type="fractalNoise" baseFrequency="${frequency.toFixed(5)}" ` +
  `numOctaves="2" seed="20260801" result="n"/>` +
  `<feDisplacementMap in="s" in2="n" scale="${displace.toFixed(2)}" ` +
  `xChannelSelector="R" yChannelSelector="G"/>` +
  `</filter>` +
  `<rect x="${inset.toFixed(1)}" y="${inset.toFixed(1)}" ` +
  `width="${(W - inset * 2).toFixed(1)}" height="${(H - inset * 2).toFixed(1)}" ` +
  `rx="${radius.toFixed(1)}" fill="#fff" filter="url(#m)"/></svg>`

/**
 * Paper grain.
 *
 * The single most important part of the effect: a flat fill reads as a UI panel
 * however warm the colour, because real paint always sits on stock with tooth.
 */
const GRAIN_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140">` +
  `<filter id="g">` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="11"/>` +
  `<feColorMatrix type="saturate" values="0"/>` +
  `<feComponentTransfer><feFuncA type="linear" slope="0.10"/></feComponentTransfer>` +
  `</filter><rect width="140" height="140" filter="url(#g)"/></svg>`

const uri = (svg: string) => `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`

const GRAIN = uri(GRAIN_SVG)

/**
 * The three layers a painted surface is made of, in any pigment.
 *
 * Exported as a function rather than left as the one hardcoded card background,
 * because the dashboard hero wants the same paper in a different colour. Written
 * out inline there it would be a fourth copy of this recipe, and the first time
 * either was touched they would stop matching.
 */
export function paperWash(from: string, mid: string, deep: string): string {
  return [
    GRAIN,
    // Light falls from the top-left. The stop fades to transparent rather than
    // to a colour, so it lifts whatever is underneath instead of tinting it.
    `radial-gradient(120% 110% at 22% 0%, ${from} 0%, rgba(255,255,255,0) 62%)`,
    `linear-gradient(155deg, ${mid} 0%, ${deep} 100%)`,
  ].join(', ')
}

/** Grain over a wash: lighter top-left, warmer bottom-right, as light falls. */
export const PAPER_BACKGROUND = [
  GRAIN,
  'radial-gradient(120% 110% at 22% 0%, #fffdf4 0%, rgba(255,253,244,0) 62%)',
  'linear-gradient(155deg, #fdf7e9 0%, #f4ecd6 100%)',
].join(', ')

/**
 * Pigment pooling: watercolour dries darker where the wash stopped, because
 * pigment migrates to the drying edge.
 *
 * An INSET shadow, which matters twice over — it paints inside the border box,
 * so it survives the mask and fades along the same irregular contour, where an
 * outer shadow would be clipped off entirely and take the card's separation
 * from the page with it.
 */
export const PAPER_POOL = 'inset 0 0 26px 6px rgba(176,138,88,0.20)'

/** Deepened on hover — the outer shadow a card used to lift with cannot survive a mask. */
export const PAPER_POOL_HOVER = 'inset 0 0 30px 8px rgba(176,138,88,0.30)'

export const PAPER_MASK = uri(MASK_SVG)

/** Everything a masked card needs, ready to spread onto a style prop. */
export const paperCardStyle: React.CSSProperties = {
  backgroundImage: PAPER_BACKGROUND,
  boxShadow: PAPER_POOL,
  maskImage: PAPER_MASK,
  WebkitMaskImage: PAPER_MASK,
  maskSize: '100% 100%',
  WebkitMaskSize: '100% 100%',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
}

/*
  ── The dashboard hero's pigments ─────────────────────────────
  The hero wears the treatment above, but not its colour: a card-coloured hero
  is just a very wide stat tile, and the greeting stops reading as a greeting.

  Ink travels WITH the wash rather than being shared. None of these will hold
  white — that is what made the old green-to-blue gradient impossible to keep —
  and a brown pool on a blue wash reads as a stain rather than as pigment, so
  the pooling is per-palette too.
*/
export interface PaperPalette {
  id: string
  /**
   * Swatch shown in the picker.
   *
   * A flat colour, not a thumbnail of the painting. Five thumbnails would mean
   * downloading all five paintings to draw a row of 16px dots, on every load,
   * when only one of them is ever shown.
   */
  swatch: string
  /**
   * The painting behind the card.
   *
   * Laid over the wash rather than replacing it: if the file is missing or has
   * not arrived, the card falls back to exactly the gradient it used before,
   * which is a complete design rather than a blank.
   */
  image: string
  /** The wash, top-left light → shallow → deep. Also the fallback under `image`. */
  from: string
  mid: string
  deep: string
  /** Pooling at the rim, in this palette's own pigment. */
  pool: string
  /** Body ink, secondary, and the quietest label. */
  ink: string
  ink2: string
  ink3: string
  /** Hairlines, and the fills a calendar cell needs. */
  rule: string
  cell: string
  today: string
  hover: string
  /** The problem chips on the left half. */
  chip: string
  chipDone: string
  todo: string
  /** Emphasis: today's outline, the next-class ring, a problem mark. */
  accent: string
  accentInk: string
  /** A submitted problem. */
  done: string
  doneInk: string
}

export const PAPER_PALETTES: readonly PaperPalette[] = [
  { id: 'meadow', swatch: '#d5e3bd',
    image: '/welcome-card/meadow.jpg',
    from: '#f6faee', mid: '#e9f1da', deep: '#d5e3bd', pool: 'rgba(112,134,74,0.22)',
    ink: '#2b3720', ink2: '#4f6039', ink3: '#7d8c66', rule: 'rgba(112,134,74,0.30)',
    cell: 'rgba(250,253,244,0.45)', today: 'rgba(226,240,196,0.85)', hover: 'rgba(240,247,224,0.85)',
    chip: 'rgba(112,134,74,0.13)', chipDone: 'rgba(90,140,90,0.24)', todo: 'rgba(150,150,70,0.20)',
    accent: '#6d8a45', accentInk: '#3f5427', done: '#4e8a53', doneInk: '#2f5c34' },

  { id: 'sky', swatch: '#c9dced',
    image: '/welcome-card/sky.jpg',
    from: '#f4f9fc', mid: '#e4eff7', deep: '#c9dced', pool: 'rgba(94,131,163,0.22)',
    ink: '#22323f', ink2: '#425768', ink3: '#71889a', rule: 'rgba(94,131,163,0.28)',
    cell: 'rgba(248,252,255,0.45)', today: 'rgba(214,234,248,0.85)', hover: 'rgba(234,244,251,0.85)',
    chip: 'rgba(94,131,163,0.13)', chipDone: 'rgba(80,150,130,0.22)', todo: 'rgba(120,140,170,0.20)',
    accent: '#4f7fa5', accentInk: '#2c4d67', done: '#3f8a7a', doneInk: '#245c50' },

  { id: 'dusk', swatch: '#f2d3a8',
    image: '/welcome-card/dusk.jpg',
    from: '#fef6ea', mid: '#fbe9d2', deep: '#f2d3a8', pool: 'rgba(184,132,72,0.24)',
    ink: '#3d2a14', ink2: '#6b5334', ink3: '#9a8058', rule: 'rgba(184,132,72,0.30)',
    cell: 'rgba(255,250,240,0.45)', today: 'rgba(252,226,188,0.85)', hover: 'rgba(253,240,220,0.85)',
    chip: 'rgba(184,132,72,0.13)', chipDone: 'rgba(140,150,70,0.24)', todo: 'rgba(200,160,80,0.22)',
    accent: '#b8843f', accentInk: '#7d5520', done: '#84903c', doneInk: '#5a6224' },

  { id: 'sea', swatch: '#bfdfd9',
    image: '/welcome-card/sea.jpg',
    from: '#f1faf8', mid: '#dcefec', deep: '#bfdfd9', pool: 'rgba(80,140,132,0.22)',
    ink: '#1e3835', ink2: '#3e5d57', ink3: '#6b8c85', rule: 'rgba(80,140,132,0.28)',
    cell: 'rgba(246,253,251,0.45)', today: 'rgba(206,236,230,0.85)', hover: 'rgba(230,246,243,0.85)',
    chip: 'rgba(80,140,132,0.13)', chipDone: 'rgba(90,150,110,0.24)', todo: 'rgba(110,150,140,0.20)',
    accent: '#43897e', accentInk: '#245a51', done: '#4a8f62', doneInk: '#28603c' },

  { id: 'rose', swatch: '#eecdc6',
    image: '/welcome-card/rose.jpg',
    from: '#fdf5f3', mid: '#f9e7e3', deep: '#eecdc6', pool: 'rgba(178,124,116,0.22)',
    ink: '#3f2724', ink2: '#684a45', ink3: '#96736d', rule: 'rgba(178,124,116,0.28)',
    cell: 'rgba(255,250,249,0.45)', today: 'rgba(247,222,216,0.85)', hover: 'rgba(252,238,235,0.85)',
    chip: 'rgba(178,124,116,0.13)', chipDone: 'rgba(140,150,90,0.24)', todo: 'rgba(190,150,140,0.22)',
    accent: '#b0736a', accentInk: '#7d4740', done: '#8a9350', doneInk: '#5c6231' },
] as const

export const DEFAULT_PALETTE_ID = 'meadow'

/** Never returns undefined: an unknown or retired id falls back to the default. */
export function paletteById(id: string | null | undefined): PaperPalette {
  return PAPER_PALETTES.find(p => p.id === id)
    ?? PAPER_PALETTES.find(p => p.id === DEFAULT_PALETTE_ID)!
}

/**
 * The same masked-paper style as a card, in one palette's pigment.
 *
 * The mask is authored at 320×160 and stretched (see MASK_SVG). The hero at
 * full width is roughly 1216×550, near enough the mask's 2:1 that the band
 * comes out about 21px across and 19px down — even, and inside the card's 24px
 * padding. A much shorter hero would need its own mask rather than this one.
 */
export function paperSurfaceStyle(p: PaperPalette): React.CSSProperties {
  return {
    /*
      The painting first, its own wash behind it.

      Two layers rather than one so a missing or slow file degrades to the
      gradient this card had before the paintings existed, rather than to
      nothing. The grain inside paperWash is then invisible under an opaque
      image, which is correct — these are painted on real stock and carry
      their own tooth; a second synthetic grain over the top would be two
      papers at once.
    */
    backgroundImage: `url("${p.image}"), ${paperWash(p.from, p.mid, p.deep)}`,
    // cover on both layers: the paintings are about 1.75:1 and the card is
    // wider than that, so the crop comes off the top and bottom, which is
    // where these have the least in them.
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',

    // Unchanged below this line. The pooling and the mask are what make it a
    // card rather than a picture, and swapping the wash is not a reason to
    // touch either.
    boxShadow: `inset 0 0 26px 6px ${p.pool}`,
    maskImage: PAPER_MASK,
    WebkitMaskImage: PAPER_MASK,
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
  }
}
