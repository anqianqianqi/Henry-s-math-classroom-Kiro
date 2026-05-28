// lib/utils/pet.ts
// Pure utility functions for the Virtual Pet feature.
// All functions are side-effect-free and do not mutate their inputs.

import type { EvolutionStage } from '@/lib/types/pet'

/**
 * XP required to reach each evolution stage.
 * 'egg' and 'baby' both start at 0 — the egg transitions to baby on species selection,
 * and baby begins at 0 XP after hatching.
 */
export const XP_THRESHOLDS: Record<EvolutionStage, number> = {
  egg:       0,
  baby:      0,
  teen:      100,
  adult:     300,
  legendary: 700,
}

/**
 * Given a non-negative XP value, returns the correct evolution stage.
 * Assumes species has already been selected (i.e., past the egg stage).
 * Never returns 'egg'.
 *
 * @param xp - Non-negative integer XP value
 * @returns The evolution stage corresponding to the given XP
 */
export function computeEvolutionStage(xp: number): EvolutionStage {
  if (xp >= 700) return 'legendary'
  if (xp >= 300) return 'adult'
  if (xp >= 100) return 'teen'
  return 'baby'
}

/**
 * Returns the XP threshold needed to reach the next stage, or null if there is no next stage.
 * Returns null for 'legendary' (already at max) and 'egg' (transitions via species selection, not XP).
 *
 * @param xp   - Current XP (unused in threshold lookup, kept for API symmetry)
 * @param stage - Current evolution stage
 * @returns The XP threshold for the next stage, or null
 */
export function xpToNextStage(xp: number, stage: EvolutionStage): number | null {
  const thresholds: Record<EvolutionStage, number | null> = {
    egg:       null,
    baby:      100,
    teen:      300,
    adult:     700,
    legendary: null,
  }
  return thresholds[stage]
}

/**
 * Returns a new array with the given accessory ID appended.
 * Does not mutate the input array.
 *
 * @param id          - Accessory ID to equip
 * @param equippedIds - Current array of equipped accessory IDs
 * @returns New array containing all previous IDs plus the new one
 */
export function equipAccessory(id: string, equippedIds: string[]): string[] {
  return [...equippedIds, id]
}

/**
 * Returns a new array with the given accessory ID removed.
 * Does not mutate the input array.
 *
 * @param id          - Accessory ID to unequip
 * @param equippedIds - Current array of equipped accessory IDs
 * @returns New array with the specified ID filtered out
 */
export function unequipAccessory(id: string, equippedIds: string[]): string[] {
  return equippedIds.filter(equippedId => equippedId !== id)
}
