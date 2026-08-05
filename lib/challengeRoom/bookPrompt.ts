/**
 * Compiles a BookSpec into the cover and inner-page prompts.
 *
 * Both are asked for as flat orthographic UV textures, NOT book mockups. That
 * is the whole point: they get mapped onto the GLB's page materials, so any
 * perspective, spine or drop shadow baked into the image would fight the 3D
 * geometry. It is also what makes these incompatible with book_skins covers,
 * which are book-shaped transparent PNGs composited in the DOM.
 *
 * The two are generated from one spec so the pair matches — same paper, same
 * frame, same palette — with the clusters appearing only on the cover.
 *
 * ── THE HALVES MATCH ON COLOUR, NOT ON MATERIAL ─────────────
 * A bound book is not made of one substance: the boards are cloth or hide and
 * the pages are paper. So the two halves name their own material —
 *
 *   coverSurface  cloth over board, leather, lacquer, veneer, anodised metal
 *   paper         the inner page, always a paper
 *
 * — and are held together by everything else: one ground colour, one palette,
 * one frame. Before the split there was a single `paper` field doing both jobs,
 * which is why every cover rendered as a sheet of paper however the theme was
 * written.
 *
 * ── MATERIAL IS FEEL; GROUND IS COLOUR ──────────────────────
 * Neither material field names a colour. `ground` names ONE, and both halves
 * carry it:
 *
 *   cover  → that colour at full strength
 *   inner  → a pale tint of the same hue
 *
 * One hue at two values, so the pair reads as a set. The inner page is lighter
 * for a reason that is not aesthetic: it is a DOM background with the challenge
 * problem printed over it in #2d1a00 (Book3DReveal), and nothing samples the
 * artwork to adapt that ink, so a mid-tone page is unreadable. The cover has
 * nothing composited over it at all, so it takes the colour undiluted.
 *
 * ── WHY IT IS ONE FIELD AND NOT TWO ENDS OF THE PALETTE ─────
 * The first version of this read the palette's deepest tone for the cover and
 * its lightest for the inner page. That produced legible pairs, but the two
 * halves were then unrelated colours — and it made two of a palette's five
 * terms silently decide most of both canvases. Worse, "deepest" is a judgement:
 * on an all-mid-tone palette the model could resolve it differently between
 * runs, so a saved recipe did not reliably regenerate the same book.
 *
 * Naming the colour once fixes all three: the halves match by construction, the
 * palette goes back to colouring the clusters, and the same recipe reproduces.
 *
 * Before any of this, `paper` carried the colour and both halves inherited the
 * inner page's brightness floor through it — which is the whole reason every
 * cover used to come out pale. Not a choice anyone made, but a legibility
 * constraint leaking through a shared field.
 */

import type { BookSpec } from '@/lib/types/challengeRoom'
import { textureRenderFor } from '@/lib/art-styles'

const clean = (value: string) => value.trim().replace(/\s+/g, ' ')

/**
 * The inner-page motif used before a theme could name its own.
 *
 * These prompts used to state the theme's paper and frame and then override
 * both three lines later — "warm-ivory bleed", "antique-gold botanical frame",
 * "delicate hand-painted watercolor" — so half of every theme was declared and
 * ignored. The overrides are gone; this is the only default left, and it only
 * applies when a spec does not say.
 */
const LEGACY_INNER_ACCENT =
  'a few leaves, meadow stems, pinhead blossoms, or subtle theme motifs'

/**
 * What colour the sheet is.
 *
 * One phrase, used by both halves, so the cover and the inner page are the same
 * hue at two values rather than two separate decisions that happen to sit in
 * the same recipe.
 *
 * The fallback is what a recipe saved before `ground` existed gets. It is
 * deliberately the DEEPEST palette tone rather than a fixed colour: those
 * recipes were written when paper carried the colour, so anything fixed here
 * would fight whatever their paper already says.
 */
function groundPhrase(spec: BookSpec): string {
  const named = spec.ground?.trim()
  return named ? clean(named) : 'the deepest colour named in the palette'
}

/**
 * What the cover is made of.
 *
 * Falls back to `paper` for recipes written before covers could be anything
 * else — which reproduces their old look exactly, since those used the one
 * field for both halves.
 */
function coverSurfaceOf(spec: BookSpec): string {
  const named = spec.coverSurface?.trim()
  return clean(named || spec.paper)
}

export function compileCoverPrompt(spec: BookSpec): string {
  const [topLeft, topRight, bottomLeft, bottomRight] = spec.cornerClusters
  return [
    'Create one finished 3:4 portrait book-cover texture as flat printable artwork.',
    '',
    `COLLECTION THEME: ${clean(spec.name)}.`,
    `Mood: ${clean(spec.mood)}.`,
    `Palette: ${clean(spec.palette)}.`,
    `Surface: ${coverSurfaceOf(spec)}.`,
    `Frame: ${clean(spec.frame)}.`,
    '',
    'LOCKED LAYOUT — follow exactly:',
    '- Exact 3:4 portrait canvas, shown perfectly flat and orthographic, like a UV texture or print file.',
    '- No book mockup, no perspective, no spine, no page block, no drop shadow, no background surface outside the artwork.',
    '- The surface above is a binding material. Render it as a FLAT SWATCH filling the whole canvas — the material seen straight on, filling the frame edge to edge, never as a bound object with corners, boards or a spine.',
    '- A very narrow bleed of that same surface touches every canvas edge.',
    '- Place a single thin continuous frame exactly as described above, approximately 2% inward from every edge.',
    '- Keep the frame close to the canvas edges. Do not leave a wide exterior margin.',
    `- The surface above describes MATERIAL and FEEL, not colour. Tint the whole thing — bleed and framed interior alike — evenly to ${groundPhrase(spec)}, keeping that material’s weave, grain or finish visible through it.`,
    '- Four small vignette clusters sit inside the frame, one in each corner:',
    `  top left: ${clean(topLeft)};`,
    `  top right: ${clean(topRight)};`,
    `  bottom left: ${clean(bottomLeft)};`,
    `  bottom right: ${clean(bottomRight)}.`,
    '- Corner clusters are compact, fully inside the frame, and do not touch the edge.',
    '- Preserve a large, quiet, uncluttered central field. No title or center object.',
    '',
    'STYLE AND OUTPUT:',
    `- ${textureRenderFor(spec.artStyle)}`,
    '- Balanced decorative density with no oversized corner cluster.',
    '- No words, letters, numbers, symbols, logo, watermark, mockup, hands, ribbons across the center, or extra border.',
    spec.notes ? `Additional art direction: ${clean(spec.notes)}.` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function compileInnerPrompt(spec: BookSpec): string {
  return [
    'Create one finished 3:4 portrait inner-page texture as flat printable artwork.',
    '',
    `MATCHING COLLECTION: ${clean(spec.name)}.`,
    `Mood: ${clean(spec.mood)}.`,
    `Palette: ${clean(spec.palette)}.`,
    `Paper: ${clean(spec.paper)}.`,
    `Frame: ${clean(spec.frame)}.`,
    '',
    'LOCKED LAYOUT — follow exactly:',
    '- Exact 3:4 portrait canvas, shown perfectly flat and orthographic, like a UV texture or print file.',
    '- No book mockup, no perspective, no spine, no page block, no drop shadow, no background surface outside the artwork.',
    '- A very narrow bleed of that same paper touches every canvas edge.',
    '- Reuse the same single thin continuous frame approximately 2% inward from every edge.',
    '- Keep the frame close to the canvas edges. Do not leave a wide exterior margin.',
    `- The paper above describes FEEL, not colour. Tint the whole page — inside and outside the frame — evenly to a PALE, WASHED-OUT TINT of ${groundPhrase(spec)}: unmistakably the same hue as the cover, but lightened far towards white. Keep that stock’s grain visible through it.`,
    '- The page must stay bright. Dark ink is printed onto it later, so a mid-tone or saturated page is a failure however well it suits the theme. When in doubt, lighten it further.',
    '- This page is paper even where the cover is a bound material such as cloth or leather. That difference is deliberate and correct: the two halves match on colour, palette and frame, never on texture.',
    `- Use only a very small, sparse accent around the frame: ${clean(spec.innerAccent?.trim() || LEGACY_INNER_ACCENT)}.`,
    "- Do not include any of the cover's four object clusters. No animals, food, cups, books, gadgets, or large ornaments.",
    '- At least 75% of the framed interior must remain completely blank, evenly colored, and usable for later story text or illustration.',
    '- Keep the entire center empty and quiet.',
    '',
    'STYLE AND OUTPUT:',
    `- ${textureRenderFor(spec.artStyle)}`,
    '- No words, letters, numbers, symbols, ruled lines, logo, watermark, page number, mockup, or extra border.',
    spec.notes ? `Additional art direction: ${clean(spec.notes)}.` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * The inner page must stay blank enough to print a problem onto — the challenge
 * room composites text into it. Keeping the ≥75% blank rule above is what makes
 * that legible, so treat it as load-bearing rather than art direction.
 */
export function validateBookSpec(spec: BookSpec): string | null {
  const required: [string, string][] = [
    ['Collection name', spec.name],
    ['Mood', spec.mood],
    ['Palette', spec.palette],
    ['Paper', spec.paper],
    ['Frame', spec.frame],
  ]
  for (const [label, value] of required) {
    if (!value?.trim()) return `${label} is required.`
  }
  if (spec.cornerClusters.some(c => !c?.trim())) {
    return 'All four corner clusters are required.'
  }
  return null
}
