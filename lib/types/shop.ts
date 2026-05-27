// lib/types/shop.ts
// TypeScript interfaces for the Points Shop feature.
// Student total_score (challenge_submissions.points) is NEVER stored here —
// spendable_balance is always computed on demand.

export interface ShopItem {
  id: string
  title: string
  description: string | null
  cost: number                // integer >= 1
  image_url: string | null
  quantity: number | null     // null = unlimited
  is_active: boolean
  created_by: string
  created_at: string
  // Computed client-side for display:
  redemption_count?: number   // how many times this item has been redeemed
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
  cost: string                // string for form input, parsed to int on submit
  image_url: string
  quantity: string            // empty string = unlimited
}

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

export interface ShopItemInsert {
  title: string
  description: string | null
  cost: number
  image_url: string | null
  quantity: number | null
  is_active: true             // always true on creation
  created_by: string
}
