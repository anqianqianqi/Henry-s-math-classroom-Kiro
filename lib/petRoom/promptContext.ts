/**
 * What a generated pet room has to fit, told to the model.
 *
 * ── WHY THIS IS ONE FILE ────────────────────────────────────
 * It used to be three copies — generate, preview and refine each carried their
 * own paragraph describing the pet area. When the dashboard moved the room out
 * of the hero row and into the tile grid, all three went on describing "a
 * flex-1 div, roughly half the page width, min-height 400px", which had not
 * been true for some time. Nothing catches that: a stale sentence in a prompt
 * produces a plausible picture that is subtly wrong for the space.
 *
 * One export, imported by all three, so the next layout change has one place
 * to land.
 *
 * ── THE SHAPE IS A CONTRACT NOW, NOT A HINT ─────────────────
 * The pet area takes its aspect ratio from whatever image it is showing, so a
 * room is never cropped — see the note on #pet-area in app/dashboard/page.tsx.
 * That cuts both ways. Nothing composed near an edge will be trimmed away, and
 * nothing near an edge can be hidden either: every corner of what the model
 * draws ends up on screen.
 */

/**
 * The size to ask GPT Image 2 for.
 *
 * Its landscape option, and 3:2 — which is also what the existing rooms are, so
 * new ones sit at the same height in the grid as the ones already there. A
 * squarer room would make the whole block taller and push the tiles beside it
 * down with it.
 */
export const PET_ROOM_IMAGE_SIZE = '1536x1024'

/** Roughly what one CSS pixel of the rendered room is worth, for the copy below. */
const RENDERED_WIDTH = 803
const RENDERED_HEIGHT = 535

/**
 * Where the picture will be seen, in terms a model can compose against.
 *
 * Deliberately concrete about the size. "Landscape, roughly 3:2" left it free
 * to drift; a stated pixel size and a statement that nothing is cropped give it
 * a frame to fill rather than a direction to lean in.
 */
export const PET_AREA_CONTEXT = `
This image is the background of the pet area on a student's dashboard.

Where it appears:
- A block two columns wide in the dashboard's tile grid, about ${RENDERED_WIDTH}x${RENDERED_HEIGHT} CSS pixels on a desktop screen.
- Generated at ${PET_ROOM_IMAGE_SIZE} — landscape, 3:2 — and shown at exactly that ratio.
- NOTHING IS CROPPED. The whole frame is visible, edge to edge and corner to corner. Compose for the full rectangle; do not assume the edges will be trimmed.

Composition rules:
- Leave the lower-centre clear. A small cat sits there, standing on the floor.
- A ground-level interior: visible floor across the bottom, walls behind.
- Wall art and picture frames should be clearly defined rectangles on the upper walls, so a student's own photo can be placed inside one later.
- Parts of the room may be animated afterwards — curtains, lamps, foliage, water. Keep such things as distinct, unobstructed shapes rather than blending them into busy detail.
- Style: anime / Studio Ghibli cosy interior.
`.trim()

/**
 * The shorter form, for editing a room that already exists.
 *
 * An edit prompt competes with the picture in front of it, so this repeats only
 * what an edit could accidentally break — the clear floor, the frame rectangles,
 * the shape — and leaves out the scene-setting the model can already see.
 */
export const PET_AREA_REFINE_CONTEXT = `
This image is the background of the pet area on a student's dashboard.
Landscape, 3:2, shown uncropped at about ${RENDERED_WIDTH}x${RENDERED_HEIGHT} CSS pixels — every edge and corner is visible.
Keep the lower-centre clear; a small cat sits there.
Keep wall art and picture frames as clearly defined rectangles.
Keep animatable elements — curtains, lamps, foliage, water — as distinct unobstructed shapes.
Anime / Studio Ghibli cosy interior style.
`.trim()
