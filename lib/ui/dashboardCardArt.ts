/**
 * The painted background each dashboard tile wears.
 *
 * ── WHY THE PICTURE HAS A LANGUAGE ──────────────────────────
 * The word is painted into the artwork — 解 where the English reads Solve —
 * so the picture has to follow the reader the same way the label does. There
 * is no way to translate it after the fact; it is pigment, not text. Hence a
 * folder per language holding the same thirteen names.
 *
 * ── WHY ONLY MEADOW ─────────────────────────────────────────
 * The art is one palette's worth of bamboo and warm paper. Laid under the sea
 * or dusk wash it would fight the colour rather than carry it, so the other
 * palettes keep the flat wash they have today until someone paints them a set.
 * Returning undefined rather than a fallback image is what makes that true:
 * the card falls back to PAPER_BACKGROUND and looks exactly as it does now.
 *
 * That is also the failure mode if a file goes missing — the tile renders as
 * today's plain card rather than as a hole.
 */

import type { Language } from '@/lib/i18n/catalog'

/**
 * One per tile on the dashboard.
 *
 * `shop` is worn by two tiles — a student's Shop Balance and a teacher's Shop
 * management tile — which is why these are named for the picture rather than
 * for the tile.
 */
export type DashboardCardArt =
  | 'challenges'
  | 'bubble-room'
  | 'decorations'
  | 'total-score'
  | 'shop'
  | 'grade'
  | 'students'
  | 'classes'
  | 'explore'
  | 'bank'
  | 'scheduler'
  | 'tags'
  | 'user-roles'

/** The palette whose cards are painted. */
const PAINTED_PALETTE = 'meadow'

/**
 * The background for a tile, or undefined when it should stay a plain card.
 *
 * The palette check lives here rather than at each call site: fourteen tiles
 * each remembering to ask "is this meadow?" is fourteen chances to forget, and
 * the one that forgets shows bamboo under a blue wash.
 */
export function dashboardCardArt(
  art: DashboardCardArt,
  paletteId: string,
  language: Language,
): string | undefined {
  if (paletteId !== PAINTED_PALETTE) return undefined
  return `/dashboard-cards/${language}/${art}.jpg`
}

/**
 * The same painting with no word on it, which the card shows while pointed at.
 *
 * ── WHY THERE ARE TWO ───────────────────────────────────────
 * The set was painted on two different bamboo frames, and which card got
 * which is not guessable from its name. It was measured: each empty frame was
 * compared against every card across the half of the picture that carries no
 * lettering, and the matches came back at a difference of exactly 0.00 — they
 * are the same paintings with the word taken out.
 *
 * That is the whole trick. A card fades to ITS OWN frame, so the bamboo does
 * not move and only the word lifts off. Pointing all of them at one frame
 * would make eight of the thirteen visibly jump.
 *
 * Language plays no part: an empty frame has no word to translate.
 */
const LEAVES_FRAME: ReadonlySet<string> = new Set(['challenges', 'shop', 'students', 'bank'])

export function dashboardCardFrame(art: DashboardCardArt, paletteId: string): string | undefined {
  if (paletteId !== PAINTED_PALETTE) return undefined
  return LEAVES_FRAME.has(art)
    ? '/dashboard-cards/blank-leaves.jpg'
    : '/dashboard-cards/blank-inkwash.jpg'
}
