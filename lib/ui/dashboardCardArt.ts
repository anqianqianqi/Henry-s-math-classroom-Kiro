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
 * Painted palettes, and which empty frame each of their cards was drawn on.
 *
 * ── WHY THIS IS MEASURED, NOT GUESSED ───────────────────────
 * A card fades to ITS OWN frame when pointed at, so the artwork does not move
 * and only the word lifts off. Send a card to the wrong frame and its border
 * visibly jumps.
 *
 * Every frame was compared against every card across the half of the picture
 * that carries no lettering. A match at a difference of 0.00 means they are the
 * same painting with the word taken out; anything above that is a different
 * frame. That is how these lists were built, and it is worth redoing rather
 * than copying for any palette added later — because the split is NOT a house
 * style. Meadow and sky both put the same four cards on their corner frame and
 * everything else on the wash. Rose uses three frames and shares only one card
 * with that arrangement. Assuming otherwise would have sent four rose cards to
 * a frame they were never painted on.
 */
interface PaintedPalette {
  /** Frame for a card not named in `frames`. */
  fallback: string
  /** Card → frame, for cards that sit on something other than the fallback. */
  frames: Record<string, string>
}

const CORNER_FOUR = ['challenges', 'shop', 'students', 'bank']
const named = (frame: string, cards: string[]) =>
  Object.fromEntries(cards.map(card => [card, frame]))

const PAINTED: Record<string, PaintedPalette> = {
  meadow: { fallback: 'blank-inkwash', frames: named('blank-leaves', CORNER_FOUR) },
  sky: { fallback: 'blank-inkwash', frames: named('blank-clouds', CORNER_FOUR) },
  rose: {
    fallback: 'blank-inkwash',
    frames: {
      ...named('blank-flowers', ['bank', 'classes', 'grade', 'shop', 'user-roles']),
      ...named('blank-petals', ['challenges', 'explore', 'scheduler', 'tags']),
    },
  },
}

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
  const palette = PAINTED[paletteId]
  if (!palette) return undefined
  return `/dashboard-cards/${paletteId}/${palette.frames[art] ?? palette.fallback}.jpg`
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
