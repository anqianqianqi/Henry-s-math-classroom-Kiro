/**
 * Finishes the challenge room with a crayon edge instead of a cut rectangle.
 *
 * The room should feel like something drawn into a page, not a photograph
 * cropped to a box. So the boundary is a torn, hand-drawn line with flecks
 * thrown clear of it — enough to break the rectangle, not so much that the
 * room dissolves.
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
 * Two earlier attempts stacked CSS radial gradients. Unioned, each extra
 * ellipse ADDS opaque area and fills back in exactly the edge the core was
 * fading. Intersected, the result is smoother but still convex — because the
 * intersection of convex shapes is always convex, giving a smooth oval, and an
 * oval inside a box still lets the eye rebuild the box. That is geometry, not
 * parameters: no tuning escapes it. Noise gives a non-convex contour, which is
 * the only thing that reads as torn rather than as a shape.
 *
 * ── WHY A RECT, NOT AN ELLIPSE ──────────────────────────────
 * A third attempt used an ellipse and faded far too much: an ellipse throws
 * away all four corners, and the corners are most of what a 3:2 picture can't
 * spare. A rounded rect inset a few percent keeps nearly the whole room and
 * chews only the boundary, which is what was actually wanted.
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
 * The mask is authored in a 600×400 space and stretched to whatever the room
 * block actually is (preserveAspectRatio="none"), so these are proportions.
 */
const W = 600
const H = 400

/**
 * How far the drawn edge sits inside the box.
 *
 * The bottom is held much tighter than the rest: the book stands there, and the
 * dissolve must not reach its foot — that is the thing students click. The top
 * and sides are ceiling and shelves, which can afford to lose a little.
 *
 * These cannot go much below the throw of the filter (scale/2 + a couple of
 * blurs, ≈25 here) without the box clipping the result, and anything the box
 * clips comes back as a straight line — the rectangle returning by the back
 * door.
 */
const INSET = 30
const INSET_BOTTOM = 14
const RADIUS = 26

/**
 * The crayon recipe: blur → displace → threshold.
 *
 * The blur makes a soft band along the edge. The fine noise breaks that band
 * into a ragged contour. The steep alpha curve then cuts it back to nearly
 * hard, which is what turns fog into crayon — and the scraps of halo thrown
 * clear of the body survive the cut as detached flecks, the splashes.
 *
 * Raising `scale` throws the line further and makes more flecks; lowering the
 * middle values of `cut` softens it back toward mist. Those two are the knobs
 * worth turning.
 */
const BLUR = 5
const FREQ = 0.045
const OCTAVES = 4
const SCALE = 30
const SEED = 9
const CUT = '0 0 0.05 0.6 0.95 1 1'

const MASK_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" ` +
  `viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">` +
  `<filter id="c" x="-25%" y="-25%" width="150%" height="150%" ` +
  `color-interpolation-filters="sRGB">` +
  `<feGaussianBlur stdDeviation="${BLUR}" result="soft"/>` +
  `<feTurbulence type="fractalNoise" baseFrequency="${FREQ}" ` +
  `numOctaves="${OCTAVES}" seed="${SEED}" result="n"/>` +
  `<feDisplacementMap in="soft" in2="n" scale="${SCALE}" ` +
  `xChannelSelector="R" yChannelSelector="G"/>` +
  `<feComponentTransfer><feFuncA type="table" tableValues="${CUT}"/></feComponentTransfer>` +
  `</filter>` +
  `<rect x="${INSET}" y="${INSET}" width="${W - INSET * 2}" ` +
  `height="${H - INSET - INSET_BOTTOM}" rx="${RADIUS}" fill="#fff" filter="url(#c)"/>` +
  `</svg>`

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
