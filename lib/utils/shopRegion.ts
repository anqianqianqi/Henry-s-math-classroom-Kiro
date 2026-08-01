/**
 * Which shop items a person can actually receive.
 *
 * ── ONLY SHIPPED GOODS HAVE A REGION ────────────────────────
 * commodity_type already records what ships; region records where to. A
 * digital item has no region at all, and that absence IS "available
 * everywhere" — not a missing value to be filled in later. Keeping the two
 * facts in one place each is why they cannot contradict.
 *
 * ── THIS IS THE COURTESY, NOT THE RULE ──────────────────────
 * Hiding an item a student cannot receive stops the mistake. It does not
 * PREVENT it: anything the browser filters, a crafted request can still ask
 * for. The rule that holds is the trigger on redemptions in
 * supabase/add-timezones-and-regions.sql, which refuses whichever redeem
 * function is called.
 */

import type { Region } from './timezone'

export interface RegionalItem {
  region?: string | null
}

/**
 * Whether this person can receive this item.
 *
 * Unknown buyer region allows everything, matching the trigger. Region is
 * filled in from Settings rather than detected, so a student who has not set
 * one yet would otherwise be locked out of the whole physical shop by a field
 * they have never been shown — a worse failure than the one being prevented.
 */
export function canReceive(item: RegionalItem, buyerRegion: Region | null): boolean {
  if (!item.region) return true
  if (!buyerRegion) return true
  return item.region === buyerRegion
}

/** The items to show, in the order given. */
export function visibleInRegion<T extends RegionalItem>(
  items: T[],
  buyerRegion: Region | null,
): T[] {
  return items.filter(item => canReceive(item, buyerRegion))
}

/**
 * How many were hidden, so the shop can say so.
 *
 * A student who has heard about an item from a classmate and cannot find it
 * should learn why, rather than concluding the shop is broken.
 */
export function hiddenCount<T extends RegionalItem>(
  items: T[],
  buyerRegion: Region | null,
): number {
  return items.length - visibleInRegion(items, buyerRegion).length
}
