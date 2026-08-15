/**
 * The painted background each dashboard tile wears, and the icon on it.
 *
 * ── WHY THE PICTURE HAS A LANGUAGE ──────────────────────────
 * The word is painted into the artwork — 解 where the English reads Solve —
 * so the picture has to follow the reader the same way the label does. There
 * is no way to translate it after the fact; it is pigment, not text. Hence a
 * folder per language holding the same thirteen names.
 *
 * ── WHY THE PICTURE HAS A PALETTE ───────────────────────────
 * Each painted palette is a whole set: thirteen cards in two languages, two
 * empty frames, and fourteen icons, all drawn together. A meadow icon on a sky
 * card is not a tint mismatch, it is a different illustration. So the palette
 * is a folder too, and a palette with no folder simply has no art — the card
 * falls back to the flat wash it has always had, which is what dusk, sea and
 * rose still do.
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

/**
 * Palettes that have been painted, and what their two empty frames are called.
 *
 * `corner` is the frame with artwork in the corners; `wash` is the quieter one.
 * The names differ per palette because the paintings do — bamboo leaves in
 * meadow, clouds in sky.
 */
const PAINTED: Record<string, { corner: string; wash: string }> = {
  meadow: { corner: 'blank-leaves', wash: 'blank-inkwash' },
  sky: { corner: 'blank-clouds', wash: 'blank-inkwash' },
}

/**
 * Which cards were painted on the corner frame rather than the wash.
 *
 * Measured, not guessed: each empty frame was compared against every card
 * across the half of the picture that carries no lettering, and the matches
 * came back at a difference of exactly 0.00 — the same paintings with the word
 * taken out. Both palettes split the same four cards the same way, which is
 * why this is one list rather than one per palette.
 *
 * It matters because a card fades to ITS OWN frame when pointed at, so the
 * bamboo — or the cloud — does not move and only the word lifts off. Sending
 * every card to one frame would make eight of the thirteen visibly jump.
 */
const CORNER_FRAME: ReadonlySet<string> = new Set(['challenges', 'shop', 'students', 'bank'])

/** The painted background for a tile, or undefined for an unpainted palette. */
export function dashboardCardArt(
  art: DashboardCardArt,
  paletteId: string,
  language: Language,
): string | undefined {
  if (!PAINTED[paletteId]) return undefined
  return `/dashboard-cards/${paletteId}/${language}/${art}.jpg`
}

/**
 * The same painting with no word on it, shown while the card is pointed at.
 *
 * Language plays no part: an empty frame has no word to translate.
 */
export function dashboardCardFrame(art: DashboardCardArt, paletteId: string): string | undefined {
  const frames = PAINTED[paletteId]
  if (!frames) return undefined
  return `/dashboard-cards/${paletteId}/${CORNER_FRAME.has(art) ? frames.corner : frames.wash}.jpg`
}

/**
 * The drawn icon a tile carries.
 *
 * Falls back to meadow's when a palette has no set of its own, so an unpainted
 * palette still gets drawn icons rather than a row of gaps — the icons read as
 * illustration on any card, while a whole missing background would not.
 */
export function dashboardEmoji(icon: string, paletteId: string): string {
  const palette = PAINTED[paletteId] ? paletteId : 'meadow'
  return `/dashboard-emoji/${palette}/${icon}.png`
}
