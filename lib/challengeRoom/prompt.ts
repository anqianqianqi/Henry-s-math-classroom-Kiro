/**
 * Compiles a RoomSpec into the image-generation prompt.
 *
 * Almost every rule in here exists to make the 3D book composite convincingly
 * onto the flat plate: the camera pitch has to match the book's tilt, and the
 * centre of the table has to be genuinely empty so there is somewhere to put it.
 * Loosening the LOCKED COMPOSITION section will produce rooms the book cannot
 * sit in believably.
 */

import type { RoomSpec } from '@/lib/types/challengeRoom'
import { roomRenderFor } from '@/lib/art-styles'

const clean = (value: string) => value.trim().replace(/\s+/g, ' ')

/**
 * The aperture sentence, as written before a theme could choose its shape.
 * Reproduced byte-identically when `aperture` is absent, so a recipe saved
 * before this existed still compiles to exactly the prompt it always did.
 */
const LEGACY_APERTURE_BULLET =
  '- A single large arched window occupies the central upper half. Its timber or stone reveal is visibly deep, with a broad sill and believable frame thickness.'

export function compileRoomPrompt(spec: RoomSpec): string {
  /*
   * Only the noun phrase comes from the spec. "A single large", "occupies the
   * central upper half", the deep reveal and the broad sill are fixed template
   * text — a theme can pick a porthole over an arch, but it cannot ask for two
   * windows, an off-centre one, or a shallow frame, all of which the
   * compositing depends on.
   */
  const apertureBullet = spec.aperture?.trim()
    ? `- A single large ${clean(spec.aperture)} occupies the central upper half. Its reveal is visibly deep, with a broad sill and believable frame thickness.`
    : LEGACY_APERTURE_BULLET

  return [
    'Create one finished 3:2 landscape room-background illustration for a compositing workflow.',
    '',
    `THEME: ${clean(spec.name)}.`,
    `Mood: ${clean(spec.mood)}.`,
    `Palette: ${clean(spec.palette)}.`,
    `Architecture: ${clean(spec.architecture)}.`,
    `Materials: ${clean(spec.materials)}.`,
    `Lighting: ${clean(spec.lighting)}.`,
    `Outside the window: ${clean(spec.outsideView)}.`,
    `Decorative accent: ${clean(spec.accent)}.`,
    '',
    'LOCKED COMPOSITION — follow exactly:',
    '- Camera is horizontally centered with zero Dutch roll, but raised above the desk and pitched downward about 40–45 degrees toward the tabletop. Use a high three-quarter tabletop view, not an eye-level view.',
    '- Preserve a calm, symmetrical architectural composition: the central aperture stays centered and visually frontal, and all vertical walls and window mullions remain vertical.',
    apertureBullet,
    '- A broad uncluttered tabletop fills roughly the lower 45% of the canvas. Show a generous amount of its top surface; keep the front apron or vertical front edge to no more than 6% of the image height.',
    '- Preserve a completely empty central placement zone occupying roughly 52% of the table width and 45% of the lower image height.',
    '- The center must be suitable for compositing a flat book seen clearly from above. An imaginary portrait book placed there should read as a tall, easily visible quadrilateral with most of its cover or pages visible, never as a shallow horizontal sliver.',
    '- The empty placement zone is plain tabletop only: no book, paper, cloth, shadowed object, decoration, spill, plant, writing tool, or ornament.',
    `- Exactly two main freestanding objects on the left side of the table: (1) ${clean(spec.leftObjects[0])}; (2) ${clean(spec.leftObjects[1])}.`,
    `- Exactly two main freestanding objects on the right side of the table: (1) ${clean(spec.rightObjects[0])}; (2) ${clean(spec.rightObjects[1])}.`,
    '- Keep all four objects outside the empty central placement zone. Objects may not overlap one another.',
    '- Built-in shelving, subtle wall foliage, and small shelf dressing are background architecture, not additional table objects.',
    '- Leave the tabletop center evenly lit and visually calm so a separate open or closed book can be composited there.',
    '',
    'STYLE AND OUTPUT:',
    `- ${roomRenderFor(spec.artStyle)}`,
    '- No people, no animals in the room, no book on the table, no text, no lettering, no watermark, no logo.',
    "- No low camera, no eye-level tabletop, no edge-on desk surface, no extreme bird's-eye view, and no tilted horizon.",
    '- Do not create a collage, split screen, contact sheet, frame sequence, or alternate view.',
    spec.notes ? `Additional art direction: ${clean(spec.notes)}.` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Field-level validation mirroring the API route's checks. */
export function validateRoomSpec(spec: RoomSpec): string | null {
  const required: [string, string][] = [
    ['Theme name', spec.name],
    ['Mood', spec.mood],
    ['Palette', spec.palette],
    ['Architecture', spec.architecture],
    ['Materials', spec.materials],
    ['Lighting', spec.lighting],
    ['Outside view', spec.outsideView],
    ['Accent', spec.accent],
  ]
  for (const [label, value] of required) {
    if (!value?.trim()) return `${label} is required.`
  }
  if (spec.leftObjects.some(o => !o?.trim())) return 'Both left-side objects are required.'
  if (spec.rightObjects.some(o => !o?.trim())) return 'Both right-side objects are required.'
  return null
}
