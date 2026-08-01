/**
 * Dissolves the challenge room into the page instead of ending at a rectangle.
 *
 * The room is meant to feel like somewhere you drifted into, not a picture
 * hung on a wall. A hard edge says "this is a component on a web page"; an
 * uneven one that fades out says the room simply stops being in focus.
 *
 * ── WHY A MASK RATHER THAN AN OVERLAY ───────────────────────
 * An overlay painted on top can only fade the room toward a colour it paints,
 * and the page behind is a gradient (primary-50 → white → accent-blue/10), not
 * a flat colour. Painting flat white over a gradient leaves a pale rectangular
 * ghost at the corners — the rigid boundary again, in a softer disguise. A
 * mask fades to real transparency, so whatever is behind shows through and
 * this keeps working if the page background is ever restyled.
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
 * How far the dissolve reaches in from the edge, as a fraction of the box.
 *
 * The one number worth turning. Higher is dreamier and eats more of the room's
 * outer detail — at much past 0.2 the bookshelves down the far left and right
 * stop being legible.
 */
export const DREAM_EDGE_REACH = 0.14

/** Where the core is still fully opaque, derived from the reach above. */
const S = Math.round(100 - DREAM_EDGE_REACH * 200)

/**
 * Four overlapping ellipses, INTERSECTED.
 *
 * Intersect rather than union, and the difference is the whole effect. Unioned,
 * each extra ellipse ADDS opaque area — so the lobes restore exactly the edge
 * the core was trying to fade, and the result is a solid rectangle with faintly
 * rounded corners. Intersected, the boundary is the innermost of the four
 * fades, so each ellipse bites in at its own depth on its own side.
 *
 * A single ellipse would fade on a perfect oval, which is just a rounder
 * rectangle — still obviously geometry. Four of them, offset off-centre by
 * different amounts, leave a contour with no name. The offsets are placed by
 * hand for character rather than computed; there is no formula for "dreamlike".
 */
const MASK_LAYERS = [
  `radial-gradient(96% 94% at 50% 50%, #000 ${S - 20}%, transparent 100%)`,
  `radial-gradient(86% 124% at 36% 46%, #000 ${S - 8}%, transparent 100%)`,
  `radial-gradient(126% 86% at 54% 64%, #000 ${S - 14}%, transparent 100%)`,
  `radial-gradient(108% 108% at 66% 34%, #000 ${S - 4}%, transparent 100%)`,
].join(', ')

export function DreamEdge({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maskImage: MASK_LAYERS,
        WebkitMaskImage: MASK_LAYERS,
        // Both spellings: Safari only understands the -webkit- keywords, and
        // the default there is source-over, which would union and flatten the
        // effect back to a rectangle.
        maskComposite: 'intersect',
        WebkitMaskComposite: 'source-in',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
      }}
    >
      {children}
    </div>
  )
}
