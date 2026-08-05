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
 * ── PAPER IS FEEL; THE PALETTE IS COLOUR ────────────────────
 * `paper` names tooth, fibre, deckle and finish, never a colour. The two halves
 * then tint that one stock differently, and this is the only place they are
 * allowed to diverge:
 *
 *   cover  → the palette's DEEPEST colour
 *   inner  → the palette's LIGHTEST colour
 *
 * Not symmetry for its own sake. The inner page is a DOM background with the
 * challenge problem printed over it in #2d1a00 (Book3DReveal), and nothing
 * samples the artwork to adapt that ink — so a dark inner page is unreadable,
 * full stop. The cover has nothing composited over it at all, so it is free.
 *
 * Before this split, `paper` carried the colour and both halves inherited the
 * inner page's brightness requirement. That is why every cover came out pale:
 * not a choice anyone made, but a legibility constraint leaking through a
 * shared field. The palette named four or five colours and could reach none of
 * them, because paper had already claimed the ground and frame had claimed the
 * line.
 *
 * To put covers back to the old pale look, change DEEPEST to LIGHTEST in
 * compileCoverPrompt. That one word is the whole difference.
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

export function compileCoverPrompt(spec: BookSpec): string {
  const [topLeft, topRight, bottomLeft, bottomRight] = spec.cornerClusters
  return [
    'Create one finished 3:4 portrait book-cover texture as flat printable artwork.',
    '',
    `COLLECTION THEME: ${clean(spec.name)}.`,
    `Mood: ${clean(spec.mood)}.`,
    `Palette: ${clean(spec.palette)}.`,
    `Paper: ${clean(spec.paper)}.`,
    `Frame: ${clean(spec.frame)}.`,
    '',
    'LOCKED LAYOUT — follow exactly:',
    '- Exact 3:4 portrait canvas, shown perfectly flat and orthographic, like a UV texture or print file.',
    '- No book mockup, no perspective, no spine, no page block, no drop shadow, no background surface outside the artwork.',
    '- A very narrow bleed of that same paper touches every canvas edge.',
    '- Place a single thin continuous frame exactly as described above, approximately 2% inward from every edge.',
    '- Keep the frame close to the canvas edges. Do not leave a wide exterior margin.',
    '- The paper above describes FEEL, not colour. Tint the whole sheet — bleed and framed interior alike — to the DEEPEST colour named in the palette, evenly, keeping that stock’s grain visible through it.',
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
    '- The paper above describes FEEL, not colour. Tint the whole page — inside and outside the frame — to the LIGHTEST colour named in the palette, evenly, keeping that stock’s grain visible through it.',
    '- The page must stay bright. Dark ink is printed onto it later, so a dark or heavily saturated ground is a failure however well it suits the theme.',
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
