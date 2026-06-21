// lib/utils/shop.ts
// Pure utility functions for the Points Shop feature.
//
// KEY INVARIANT: Student total_score (challenge_submissions.points) is NEVER
// reduced. The spendable_balance is computed as:
//   SUM(locked submission points) - SUM(redemptions.points_spent)
// When a teacher increases a grade, the earned side goes up automatically,
// which increases the wallet balance. No score is ever taken away.

import type { Redemption, ShopItem, ShopItemCategory, ShopItemForm, ShopItemInsert, ValidationResult, CommodityType } from '@/lib/types/shop'
import type { Species } from '@/lib/types/pet'

/**
 * Compute the student's spendable balance from raw data.
 *
 * spendable_balance = SUM(lockedPoints) - SUM(pointsSpent)
 *
 * NOTE: lockedPoints comes from challenge_submissions.points (read-only).
 * This value only ever increases when a teacher grades or re-grades upward.
 * pointsSpent comes from redemptions — spending reduces the wallet, not the score.
 */
export function computeSpendableBalance(
  lockedPoints: number[],
  pointsSpent: number[]
): number {
  const earned = lockedPoints.reduce((sum, p) => sum + p, 0)
  const spent = pointsSpent.reduce((sum, p) => sum + p, 0)
  return earned - spent
}

/**
 * Check if a student can afford an item.
 * Returns true when balance >= cost (equal is affordable).
 */
export function canAfford(balance: number, cost: number): boolean {
  return balance >= cost
}

/**
 * Check if an item is in stock.
 * quantity === null means unlimited stock.
 */
export function isInStock(quantity: number | null, redemptionCount: number): boolean {
  if (quantity === null) return true
  return redemptionCount < quantity
}

/**
 * Determine if the "Redeem" button should be disabled.
 * Disabled when: cost > balance OR item is out of stock.
 */
export function isRedeemDisabled(
  balance: number,
  item: Pick<ShopItem, 'cost' | 'quantity' | 'redemption_count'>
): boolean {
  if (!canAfford(balance, item.cost)) return true
  if (!isInStock(item.quantity ?? null, item.redemption_count ?? 0)) return true
  return false
}

/**
 * Validate shop item form data.
 * Returns { valid: true } or { valid: false, errors: { field: message } }.
 */
export function validateShopItemForm(form: ShopItemForm): ValidationResult {
  const errors: Record<string, string> = {}

  if (!form.title || form.title.trim().length === 0) {
    errors.title = 'Title is required'
  } else if (form.title.trim().length > 100) {
    errors.title = 'Title must be 100 characters or fewer'
  }

  if (form.description && form.description.length > 500) {
    errors.description = 'Description must be 500 characters or fewer'
  }

  const costNum = parseInt(form.cost, 10)
  if (form.cost === '' || isNaN(costNum)) {
    errors.cost = 'Cost is required'
  } else if (costNum < 1) {
    errors.cost = 'Cost must be at least 1 point'
  } else if (costNum > 10000) {
    errors.cost = 'Cost must be 10,000 points or fewer'
  }

  if (form.quantity !== '') {
    const qtyNum = parseInt(form.quantity, 10)
    if (isNaN(qtyNum) || qtyNum < 1) {
      errors.quantity = 'Quantity must be at least 1 (or leave blank for unlimited)'
    } else if (qtyNum > 9999) {
      errors.quantity = 'Quantity must be 9,999 or fewer'
    }
  }

  if (form.image_url && form.image_url.length > 2048) {
    errors.image_url = 'Image URL must be 2,048 characters or fewer'
  }

  if (form.category === 'food') {
    const foodXpNum = parseInt(form.food_xp, 10)
    if (form.food_xp === '' || form.food_xp === '0' || isNaN(foodXpNum) || foodXpNum < 1 || !Number.isInteger(foodXpNum)) {
      errors.food_xp = 'Food XP is required and must be a whole number between 1 and 500'
    } else if (foodXpNum > 500) {
      errors.food_xp = 'Food XP must be 500 or fewer'
    }
  }

  if (form.category === 'pet') {
    const validSpecies = ['dragon', 'fox', 'cat']
    if (!form.target_species || !validSpecies.includes(form.target_species)) {
      errors.target_species = 'Target species is required and must be dragon, fox, or cat'
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

/**
 * Sort redemptions by most recent first (descending redeemed_at).
 * Generic so it preserves extended types like RedemptionWithTitle.
 */
export function sortRedemptionsByRecent<T extends Redemption>(redemptions: T[]): T[] {
  return [...redemptions].sort((a, b) =>
    b.redeemed_at.localeCompare(a.redeemed_at)
  )
}

/**
 * Build the insert payload for a new shop item.
 * Always sets is_active: true and created_by: teacherId.
 */
export function buildShopItemInsert(
  form: ShopItemForm,
  teacherId: string
): ShopItemInsert {
  const drawsRaw = parseInt(form.draws_per_redemption ?? '1', 10)
  const draws = isNaN(drawsRaw) || drawsRaw < 1 ? 1 : Math.min(drawsRaw, 20)
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    details: form.details?.trim() || null,
    cost: parseInt(form.cost, 10),
    image_url: form.image_url.trim() || null,
    quantity: form.quantity.trim() !== '' ? parseInt(form.quantity, 10) : null,
    is_active: true,
    created_by: teacherId,
    category: (form.category || 'other') as ShopItemCategory,
    commodity_type: (form.commodity_type || 'standard') as CommodityType,
    food_xp: form.category === 'food' ? parseInt(form.food_xp, 10) : null,
    target_species: form.category === 'pet' ? form.target_species as Species : null,
    draws_per_redemption: draws,
    music_file: form.commodity_type === 'music_track' ? (form.music_file?.trim() || null) : null,
  }
}

/**
 * Build a redemption record shape (used for testing / type safety).
 */
export function buildRedemptionRecord(
  userId: string,
  itemId: string,
  cost: number
): { user_id: string; item_id: string; points_spent: number } {
  return { user_id: userId, item_id: itemId, points_spent: cost }
}
