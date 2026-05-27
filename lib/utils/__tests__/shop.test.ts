// lib/utils/__tests__/shop.test.ts
// Unit + property-based tests for the Points Shop utility functions.
//
// KEY INVARIANT tested throughout:
//   Student total_score (challenge_submissions.points) is NEVER reduced.
//   spendable_balance = SUM(earned) - SUM(spent)
//   When a teacher increases a grade, earned goes up → balance goes up.

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  computeSpendableBalance,
  canAfford,
  isInStock,
  isRedeemDisabled,
  validateShopItemForm,
  sortRedemptionsByRecent,
  buildShopItemInsert,
  buildRedemptionRecord,
} from '../shop'
import type { Redemption, ShopItemForm } from '@/lib/types/shop'

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('computeSpendableBalance', () => {
  it('returns 0 when student has no submissions and no redemptions', () => {
    expect(computeSpendableBalance([], [])).toBe(0)
  })

  it('returns total earned when nothing has been spent', () => {
    expect(computeSpendableBalance([10, 20, 30], [])).toBe(60)
  })

  it('subtracts spent from earned', () => {
    expect(computeSpendableBalance([100], [40])).toBe(60)
  })

  it('can return a negative balance (over-spent edge case)', () => {
    // This should not happen in practice due to atomic RPC checks,
    // but the pure function handles it correctly.
    expect(computeSpendableBalance([10], [20])).toBe(-10)
  })
})

describe('canAfford', () => {
  it('returns true when balance equals cost (boundary case)', () => {
    expect(canAfford(50, 50)).toBe(true)
  })

  it('returns true when balance exceeds cost', () => {
    expect(canAfford(100, 50)).toBe(true)
  })

  it('returns false when balance is less than cost', () => {
    expect(canAfford(49, 50)).toBe(false)
  })

  it('returns false when balance is 0 and cost is 1', () => {
    expect(canAfford(0, 1)).toBe(false)
  })
})

describe('isInStock', () => {
  it('returns true when quantity is null (unlimited)', () => {
    expect(isInStock(null, 9999)).toBe(true)
  })

  it('returns true when redemptionCount < quantity', () => {
    expect(isInStock(5, 4)).toBe(true)
  })

  it('returns false when redemptionCount equals quantity', () => {
    expect(isInStock(1, 1)).toBe(false)
  })

  it('returns false when redemptionCount exceeds quantity', () => {
    expect(isInStock(3, 5)).toBe(false)
  })
})

describe('isRedeemDisabled', () => {
  it('is disabled when cost > balance', () => {
    expect(isRedeemDisabled(49, { cost: 50, quantity: null, redemption_count: 0 })).toBe(true)
  })

  it('is enabled when balance equals cost', () => {
    expect(isRedeemDisabled(50, { cost: 50, quantity: null, redemption_count: 0 })).toBe(false)
  })

  it('is disabled when out of stock regardless of balance', () => {
    expect(isRedeemDisabled(1000, { cost: 10, quantity: 1, redemption_count: 1 })).toBe(true)
  })

  it('is enabled when affordable and in stock', () => {
    expect(isRedeemDisabled(100, { cost: 10, quantity: 5, redemption_count: 4 })).toBe(false)
  })
})

describe('validateShopItemForm', () => {
  const validForm: ShopItemForm = {
    title: 'Free Period',
    description: 'Skip one homework',
    cost: '50',
    image_url: '',
    quantity: '',
  }

  it('accepts a valid form', () => {
    expect(validateShopItemForm(validForm).valid).toBe(true)
  })

  it('rejects cost of 0', () => {
    const result = validateShopItemForm({ ...validForm, cost: '0' })
    expect(result.valid).toBe(false)
    expect(result.errors.cost).toBeDefined()
  })

  it('rejects negative cost', () => {
    const result = validateShopItemForm({ ...validForm, cost: '-5' })
    expect(result.valid).toBe(false)
    expect(result.errors.cost).toBeDefined()
  })

  it('accepts cost of 1 (minimum valid)', () => {
    expect(validateShopItemForm({ ...validForm, cost: '1' }).valid).toBe(true)
  })

  it('rejects empty title', () => {
    const result = validateShopItemForm({ ...validForm, title: '' })
    expect(result.valid).toBe(false)
    expect(result.errors.title).toBeDefined()
  })
})

describe('buildShopItemInsert', () => {
  it('sets is_active to true', () => {
    const form: ShopItemForm = { title: 'Prize', description: '', cost: '10', image_url: '', quantity: '' }
    expect(buildShopItemInsert(form, 'teacher-uuid').is_active).toBe(true)
  })

  it('sets created_by to the teacher id', () => {
    const form: ShopItemForm = { title: 'Prize', description: '', cost: '10', image_url: '', quantity: '' }
    expect(buildShopItemInsert(form, 'teacher-uuid').created_by).toBe('teacher-uuid')
  })

  it('sets quantity to null when form quantity is empty string', () => {
    const form: ShopItemForm = { title: 'Prize', description: '', cost: '10', image_url: '', quantity: '' }
    expect(buildShopItemInsert(form, 'teacher-uuid').quantity).toBeNull()
  })

  it('parses quantity when provided', () => {
    const form: ShopItemForm = { title: 'Prize', description: '', cost: '10', image_url: '', quantity: '5' }
    expect(buildShopItemInsert(form, 'teacher-uuid').quantity).toBe(5)
  })

  it('sets description to null when empty', () => {
    const form: ShopItemForm = { title: 'Prize', description: '', cost: '10', image_url: '', quantity: '' }
    expect(buildShopItemInsert(form, 'teacher-uuid').description).toBeNull()
  })
})

describe('sortRedemptionsByRecent', () => {
  it('sorts by redeemed_at descending', () => {
    const redemptions: Redemption[] = [
      { id: '1', user_id: 'u', item_id: 'i', points_spent: 10, redeemed_at: '2024-01-01T00:00:00Z' },
      { id: '2', user_id: 'u', item_id: 'i', points_spent: 10, redeemed_at: '2024-03-01T00:00:00Z' },
      { id: '3', user_id: 'u', item_id: 'i', points_spent: 10, redeemed_at: '2024-02-01T00:00:00Z' },
    ]
    const sorted = sortRedemptionsByRecent(redemptions)
    expect(sorted[0].id).toBe('2')
    expect(sorted[1].id).toBe('3')
    expect(sorted[2].id).toBe('1')
  })

  it('does not mutate the original array', () => {
    const redemptions: Redemption[] = [
      { id: '1', user_id: 'u', item_id: 'i', points_spent: 10, redeemed_at: '2024-01-01T00:00:00Z' },
      { id: '2', user_id: 'u', item_id: 'i', points_spent: 10, redeemed_at: '2024-03-01T00:00:00Z' },
    ]
    const original = [...redemptions]
    sortRedemptionsByRecent(redemptions)
    expect(redemptions[0].id).toBe(original[0].id)
  })
})

describe('buildRedemptionRecord', () => {
  it('preserves userId, itemId, and cost', () => {
    const record = buildRedemptionRecord('user-1', 'item-1', 25)
    expect(record.user_id).toBe('user-1')
    expect(record.item_id).toBe('item-1')
    expect(record.points_spent).toBe(25)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property-based tests (fast-check, 100 iterations each)
// ─────────────────────────────────────────────────────────────────────────────

describe('Property-based tests', () => {
  // Feature: shop, Property 1: computeSpendableBalance returns sum(earned) - sum(spent)
  it('Property 1: spendable balance = sum(earned) - sum(spent) for any inputs', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1000 })),
        fc.array(fc.integer({ min: 1, max: 500 })),
        (earned, spent) => {
          const result = computeSpendableBalance(earned, spent)
          const expected =
            earned.reduce((a, b) => a + b, 0) - spent.reduce((a, b) => a + b, 0)
          return result === expected
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: shop, Property 3: isRedeemDisabled iff cost > balance OR out of stock
  it('Property 3: isRedeemDisabled iff cost > balance OR out of stock', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
        fc.integer({ min: 0, max: 200 }),
        (balance, cost, quantity, redemptionCount) => {
          const disabled = isRedeemDisabled(balance, {
            cost,
            quantity,
            redemption_count: redemptionCount,
          })
          const shouldBeDisabled =
            cost > balance ||
            (quantity !== null && redemptionCount >= quantity)
          return disabled === shouldBeDisabled
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: shop, Property 4: sortRedemptionsByRecent returns descending order
  it('Property 4: sortRedemptionsByRecent returns descending redeemed_at order', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            user_id: fc.uuid(),
            item_id: fc.uuid(),
            points_spent: fc.integer({ min: 1 }),
            redeemed_at: fc.date().map((d) => d.toISOString()),
          }),
          { minLength: 1 }
        ),
        (redemptions) => {
          const sorted = sortRedemptionsByRecent(redemptions)
          for (let i = 0; i < sorted.length - 1; i++) {
            if (sorted[i].redeemed_at < sorted[i + 1].redeemed_at) return false
          }
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: shop, Property 5: canAfford(balance, cost) iff balance >= cost
  it('Property 5: canAfford iff balance >= cost', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        (balance, cost) => canAfford(balance, cost) === balance >= cost
      ),
      { numRuns: 100 }
    )
  })

  // Feature: shop, Property 6: isInStock iff quantity is null OR redemptionCount < quantity
  it('Property 6: isInStock iff quantity is null OR redemptionCount < quantity', () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
        fc.integer({ min: 0, max: 200 }),
        (quantity, redemptionCount) => {
          const result = isInStock(quantity, redemptionCount)
          const expected = quantity === null || redemptionCount < quantity
          return result === expected
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: shop, Property 7: buildRedemptionRecord preserves userId, itemId, cost
  it('Property 7: buildRedemptionRecord preserves userId, itemId, cost', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: 10000 }),
        (userId, itemId, cost) => {
          const record = buildRedemptionRecord(userId, itemId, cost)
          return (
            record.user_id === userId &&
            record.item_id === itemId &&
            record.points_spent === cost
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: shop, Property 8: buildShopItemInsert always sets is_active=true and correct created_by
  it('Property 8: buildShopItemInsert always sets is_active=true and correct created_by', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string(),
          image_url: fc.string(),
          quantity: fc.string(),
        }),
        fc.uuid(),
        (formPartial, teacherId) => {
          const form: ShopItemForm = { ...formPartial, cost: '10' }
          const insert = buildShopItemInsert(form, teacherId)
          return insert.is_active === true && insert.created_by === teacherId
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: shop, Property 9: validateShopItemForm rejects cost < 1
  it('Property 9: validateShopItemForm rejects any cost < 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ max: 0 }), // 0 and all negatives
        (invalidCost) => {
          const form: ShopItemForm = {
            title: 'Test Item',
            description: '',
            cost: String(invalidCost),
            image_url: '',
            quantity: '',
          }
          const result = validateShopItemForm(form)
          return result.valid === false && result.errors.cost !== undefined
        }
      ),
      { numRuns: 100 }
    )
  })
})
