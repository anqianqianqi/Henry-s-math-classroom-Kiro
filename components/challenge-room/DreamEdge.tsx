/**
 * Dissolves the challenge room into the page instead of ending at a rectangle.
 *
 * The room is meant to feel like somewhere you drifted into, not a picture hung
 * on a wall. A hard edge says "this is a component on a web page"; a torn,
 * uneven one says the room simply stops being in focus.
 *
 * ── WHY A MASK RATHER THAN AN OVERLAY ───────────────────────
 * An overlay painted on top can only fade the room toward a colour it paints,
 * and the page behind is a gradient (primary-50 → white → accent-blue/10), not
 * a flat colour. Flat white over a gradient leaves a pale rectangular ghost at
 * the corners — the rigid boundary again, in a softer disguise. A mask fades to
 * real transparency, so whatever is behind shows through and this keeps working
 * if the page background is ever restyled.
 *
 * ── WHY NOISE RATHER THAN GRADIENTS ─────────────────────────
 * The first two attempts stacked CSS radial gradients. Unioned, each extra
 * ellipse ADDS opaque area and fills back in exactly the edge the core was
 * fading — a solid rectangle with faintly rounded corners. Intersected, the
 * result is better but still convex, because the intersection of convex shapes
 * is always convex: a smooth oval, and an oval inside a box still lets the eye
 * rebuild the box. No tuning escapes that; it is geometry, not parameters.
 *
 * Fractal noise displacing the edge of an ellipse gives a NON-convex contour —
 * inlets, bites and wisps at genuinely random depths, which is what reads as
 * real rather than as a shape.
 *
 * ── WHY AN ELLIPSE, NOT A RADIAL GRADIENT ───────────────────
 * rx and ry are independent, so the blob dies out before the short axis reaches
 * the box edge. A circular gradient in a 3:2 box always overshoots top and
 * bottom, and whatever the box clips comes back as a straight line — the
 * rectangle returning by the back door.
 *
 * ── A BOLT-ON ───────────────────────────────────────────────
 * It wraps the room block and changes nothing inside it. Deleting the two
 * wrapper lines restores the previous look exactly.
 *
 * ── THE position:fixed TRAP ─────────────────────────────────
 * Book3DReveal keeps its zoomed reading surface as a SIBLING of the stage on
 * purpose: an ancestor carrying filter or transform becomes the containing
 * block for position:fixed, which once trapped the page spread in a small box.
 * A mask can do the same. So this must wrap only the room block — never
 * anything containing the zoomed reader, or the pages get cramped again.
 */

/**
 * The mask is authored in a 600×400 space and stretched to whatever the room
 * block actually is (preserveAspectRatio="none"), so these numbers are
 * proportions, not pixels.
 */
const W = 600
const H = 400

/**
 * The lit area, before the noise chews on it.
 *
 * ry is deliberately far short of H/2: everything the displacement and blur add
 * has to still land inside the box, or the box clips it and the straight edge
 * comes back. Raising ry past ~140 is where that starts to show.
 */
const SHAPE = { rx: 258, ry: 128 }

/**
 * A second lobe over the lower centre, where the book stands.
 *
 * Without it the dissolve eats the foot of the book — the thing students are
 * meant to click. Painted into the same filtered group as the main ellipse so
 * the same noise warps both; filtering them separately leaves a visible seam
 * where the two contours cross.
 */
const BOOK_LOBE = { cy: 250, rx: 148, ry: 118 }

/**
 * scale is how violently the edge is warped and is the one number worth
 * turning: higher is wispier and eats more of the room. Past ~110 the noise
 * starts pulling transparent streaks into the middle of the picture, which
 * reads as smoke over the window rather than as a soft edge.
 */
const NOISE = { freq: 0.011, octaves: 4, scale: 84, blur: 19, seed: 3 }

const MASK_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" ` +
  `viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">` +
  `<filter id="w" x="-50%" y="-50%" width="200%" height="200%" ` +
  `color-interpolation-filters="sRGB">` +
  `<feTurbulence type="fractalNoise" baseFrequency="${NOISE.freq}" ` +
  `numOctaves="${NOISE.octaves}" seed="${NOISE.seed}" result="n"/>` +
  // Displace first, then blur: warp the hard ellipse into an irregular contour,
  // then soften it so it dissolves rather than tears.
  `<feDisplacementMap in="SourceGraphic" in2="n" scale="${NOISE.scale}" ` +
  `xChannelSelector="R" yChannelSelector="G"/>` +
  `<feGaussianBlur stdDeviation="${NOISE.blur}"/>` +
  `</filter>` +
  `<g filter="url(#w)">` +
  `<ellipse cx="${W / 2}" cy="${H / 2}" rx="${SHAPE.rx}" ry="${SHAPE.ry}" fill="#fff"/>` +
  `<ellipse cx="${W / 2}" cy="${BOOK_LOBE.cy}" rx="${BOOK_LOBE.rx}" ry="${BOOK_LOBE.ry}" fill="#fff"/>` +
  `</g></svg>`

/**
 * Encoded once at module load. A data URI rather than an inline <svg mask>
 * element: as an image this is just a texture the compositor samples, which
 * every engine handles, whereas SVG masks referencing HTML content are still
 * uneven across browsers.
 */
const MASK = `url("data:image/svg+xml;utf8,${encodeURIComponent(MASK_SVG)}")`

export function DreamEdge({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maskImage: MASK,
        WebkitMaskImage: MASK,
        // Stretch the single layer over the whole block. Without an explicit
        // size the SVG's intrinsic 600×400 would be used and the mask would
        // tile or sit in a corner.
        maskSize: '100% 100%',
        WebkitMaskSize: '100% 100%',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
      }}
    >
      {children}
    </div>
  )
}
