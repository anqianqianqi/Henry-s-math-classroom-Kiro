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

/** Grain over a wash: lighter top-left, warmer bottom-right, as light falls. */
export const PAPER_BACKGROUND = [
  uri(GRAIN_SVG),
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
