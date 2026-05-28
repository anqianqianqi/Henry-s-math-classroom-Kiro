// lib/types/shop.ts
// TypeScript interfaces for the Points Shop feature.
// Student total_score (challenge_submissions.points) is NEVER stored here —
// spendable_balance is always computed on demand.

import type { Species } from './pet'

export type ShopItemCategory = 'food' | 'accessory' | 'pet' | 'other'
export type CommodityType = 'standard' | 'blindbox' | 'physical' | 'physical_blindbox'

export interface ShopItem {
  id: string
  title: string
  description: string | null
  details: string | null        // collapsible details section
  cost: number                  // integer >= 1
  image_url: string | null
  quantity: number | null       // null = unlimited
  is_active: boolean
  created_by: string
  created_at: string
  category: ShopItemCategory
  commodity_type: CommodityType
  food_xp: number | null        // only set when category = 'food'
  target_species: Species | null  // only set when category = 'pet'
  // Computed client-side for display:
  redemption_count?: number     // how many times this item has been redeemed
  blindbox_total?: number       // total images in pool (blindbox only)
  blindbox_remaining?: number   // unclaimed images remaining (blindbox only)
}

export interface Redemption {
  id: string
  user_id: string
  item_id: string
  points_spent: number
  redeemed_at: string
}

export interface RedemptionWithDetails extends Redemption {
  student_name: string
  item_title: string
  item_commodity_type?: string
  blindbox_image_url?: string | null
}

export interface StudentBalance {
  user_id: string
  student_name: string
  total_earned: number        // SUM(locked submissions) — never decreases
  total_spent: number         // SUM(redemptions.points_spent)
  spendable_balance: number   // total_earned - total_spent
}

export interface ShopItemForm {
  title: string
  description: string
  details: string             // collapsible details
  cost: string                // string for form input, parsed to int on submit
  image_url: string
  quantity: string            // empty string = unlimited
  category: string            // 'food' | 'accessory' | 'pet' | 'other'
  commodity_type: string      // 'standard' | 'blindbox' | 'physical'
  food_xp: string             // empty string = not applicable; parsed to int for food items
  target_species: string      // '' | 'dragon' | 'fox' | 'cat'
}

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

export interface ShopItemInsert {
  title: string
  description: string | null
  details: string | null
  cost: number
  image_url: string | null
  quantity: number | null
  is_active: true             // always true on creation
  created_by: string
  category: ShopItemCategory
  commodity_type: CommodityType
  food_xp: number | null      // only set when category = 'food'
  target_species: Species | null  // only set when category = 'pet'
}

export interface BlindboxImage {
  id: string
  item_id: string
  image_url: string
  is_claimed: boolean
  claimed_by: string | null
  claimed_at: string | null
  sort_order: number
}

export interface PhysicalRedemptionRequest {
  id: string
  redemption_id: string
  item_id: string
  student_id: string
  teacher_id: string
  status: 'pending' | 'shipped' | 'delivered'
  notes: string | null
  created_at: string
  // Joined fields for display:
  student_name?: string
  item_title?: string
}
