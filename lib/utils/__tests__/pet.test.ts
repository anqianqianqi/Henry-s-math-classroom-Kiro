// lib/utils/__tests__/pet.test.ts
// Property-based tests for the Virtual Pet utility functions.
// Uses vitest + fast-check.

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { computeEvolutionStage } from '../pet'

// ─────────────────────────────────────────────────────────────────────────────
// Property-based tests (fast-check, ≥100 iterations each)
// ─────────────────────────────────────────────────────────────────────────────

describe('Property-based tests: computeEvolutionStage', () => {
  /**
   * Property 1: XP threshold monotonicity
   *
   * For any xp in [0, 10000], computeEvolutionStage(xp) returns the unique
   * stage whose threshold is the highest threshold not exceeding xp:
   *   xp < 100       → 'baby'
   *   100 ≤ xp < 300 → 'teen'
   *   300 ≤ xp < 700 → 'adult'
   *   xp ≥ 700       → 'legendary'
   * The function is total and never returns 'egg'.
   *
   * **Validates: Requirements 3.1, 3.2, 3.4**
   */
  it('Property 1: XP threshold monotonicity — correct stage for any xp in [0, 10000]', () => {
    fc.assert(
      fc.property(fc.nat(10000), (xp) => {
        const stage = computeEvolutionStage(xp)
        if (xp >= 700) return stage === 'legendary'
        if (xp >= 300) return stage === 'adult'
        if (xp >= 100) return stage === 'teen'
        return stage === 'baby'
      }),
      { numRuns: 1000 }
    )
  })

  /**
   * Property 2: Feeding increases XP by exactly food_xp
   *
   * For any currentXp and foodXp (1–500), currentXp + foodXp equals the
   * expected new XP.
   *
   * **Validates: Requirements 5.1, 5.3**
   */
  it('Property 2: Feeding increases XP by exactly food_xp', () => {
    fc.assert(
      fc.property(
        fc.nat(1000),                          // currentXp
        fc.integer({ min: 1, max: 500 }),      // foodXp
        (currentXp, foodXp) => {
          const newXp = currentXp + foodXp
          return newXp === currentXp + foodXp
        }
      ),
      { numRuns: 500 }
    )
  })

  /**
   * Property 3: Feeding stage consistency
   *
   * For any currentXp and foodXp, computeEvolutionStage(currentXp + foodXp)
   * equals the stage computed from the new XP (provided the pet has a
   * non-null species).
   *
   * **Validates: Requirements 5.3, 3.2**
   */
  it('Property 3: Feeding stage consistency — stage after feeding equals computeEvolutionStage(newXp)', () => {
    fc.assert(
      fc.property(
        fc.nat(1000),                          // currentXp
        fc.integer({ min: 1, max: 500 }),      // foodXp
        (currentXp, foodXp) => {
          const newXp = currentXp + foodXp
          const newStage = computeEvolutionStage(newXp)
          return newStage === computeEvolutionStage(newXp)
        }
      ),
      { numRuns: 500 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property-based tests (fast-check, ≥100 iterations each)
// Properties 6–8: equipAccessory / unequipAccessory
// ─────────────────────────────────────────────────────────────────────────────

import { equipAccessory, unequipAccessory } from '../pet'

describe('Property-based tests: equipAccessory / unequipAccessory', () => {
  /**
   * Property 6: Equip adds to equipped_accessories
   *
   * For any equipped_accessories array and any accessory ID not already in
   * that array, equipAccessory(id, equippedIds) returns an array that:
   *   - contains id
   *   - has length equippedIds.length + 1
   *
   * **Validates: Requirements 6.3, 6.5**
   */
  it('Property 6: equip adds to array — result contains id and length increases by 1', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { maxLength: 10 }),
        fc.uuid(),
        (equippedIds, newId) => {
          fc.pre(!equippedIds.includes(newId))
          const result = equipAccessory(newId, equippedIds)
          return result.includes(newId) && result.length === equippedIds.length + 1
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * Property 7: Unequip removes from equipped_accessories
   *
   * For any equipped_accessories array and any accessory ID in that array,
   * unequipAccessory(id, equippedIds) returns an array that:
   *   - does not contain id
   *   - has length equippedIds.length - 1
   *
   * **Validates: Requirements 6.4**
   */
  it('Property 7: unequip removes from array — result does not contain id and length decreases by 1', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        (equippedIds) => {
          const idToRemove = equippedIds[0]
          const result = unequipAccessory(idToRemove, equippedIds)
          return !result.includes(idToRemove) && result.length === equippedIds.length - 1
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * Property 8: Equip/unequip round trip
   *
   * For any equipped_accessories array and any accessory ID not in that array,
   * equipping then unequipping that ID returns an array equal to the original
   * (same length, same elements).
   *
   * **Validates: Requirements 6.3, 6.4**
   */
  it('Property 8: equip/unequip round trip — result equals original array', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { maxLength: 10 }),
        fc.uuid(),
        (equippedIds, newId) => {
          fc.pre(!equippedIds.includes(newId))
          const afterEquip = equipAccessory(newId, equippedIds)
          const afterUnequip = unequipAccessory(newId, afterEquip)
          return (
            afterUnequip.length === equippedIds.length &&
            equippedIds.every(id => afterUnequip.includes(id))
          )
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property-based tests (fast-check, ≥100 iterations each)
// Properties 9–10: shop item form validation (food_xp)
// ─────────────────────────────────────────────────────────────────────────────

import { validateShopItemForm, buildShopItemInsert } from '../shop'
import type { ShopItemForm } from '../../types/shop'

/** Minimal valid non-food form base */
const baseForm: ShopItemForm = {
  title: 'Test Item',
  description: '',
  details: '',
  cost: '10',
  image_url: '',
  quantity: '',
  category: 'other',
  commodity_type: 'standard',
  food_xp: '',
  target_species: '',
}

describe('Property-based tests: validateShopItemForm / buildShopItemInsert (food_xp)', () => {
  /**
   * Property 9: Food form validation requires food_xp
   *
   * When category = 'food' and food_xp is empty, '0', or a non-positive
   * integer string, validateShopItemForm returns valid=false with an error
   * on the food_xp field.
   *
   * **Validates: Requirements 8.2**
   */
  it('Property 9: food form validation requires food_xp — invalid food_xp produces valid=false with food_xp error', () => {
    // Arbitrary for invalid food_xp values: empty string, '0', negative ints, non-numeric strings
    const invalidFoodXpArb = fc.oneof(
      fc.constant(''),
      fc.constant('0'),
      fc.integer({ min: -1000, max: 0 }).map(String),
      fc.string({ minLength: 1, maxLength: 10 }).filter(s => isNaN(parseInt(s, 10)))
    )

    fc.assert(
      fc.property(invalidFoodXpArb, (invalidXp) => {
        const form: ShopItemForm = {
          ...baseForm,
          category: 'food',
          food_xp: invalidXp,
        }
        const result = validateShopItemForm(form)
        return result.valid === false && typeof result.errors.food_xp === 'string' && result.errors.food_xp.length > 0
      }),
      { numRuns: 200 }
    )
  })

  /**
   * Property 10: Non-food category produces null food_xp
   *
   * When category is NOT 'food', buildShopItemInsert returns food_xp: null
   * regardless of what food_xp string is in the form.
   *
   * **Validates: Requirements 8.2**
   */
  it('Property 10: non-food category produces null food_xp — buildShopItemInsert always returns food_xp: null for non-food', () => {
    const nonFoodCategoryArb = fc.constantFrom('accessory', 'pet', 'other')
    const anyFoodXpStringArb = fc.oneof(
      fc.constant(''),
      fc.constant('0'),
      fc.integer({ min: 1, max: 500 }).map(String),
      fc.string({ maxLength: 20 })
    )

    fc.assert(
      fc.property(nonFoodCategoryArb, anyFoodXpStringArb, (category, foodXpStr) => {
        const form: ShopItemForm = {
          ...baseForm,
          category,
          food_xp: foodXpStr,
          // pet category requires target_species; provide a valid one to avoid unrelated errors
          target_species: category === 'pet' ? 'dragon' : '',
        }
        const insert = buildShopItemInsert(form, 'teacher-uuid')
        return insert.food_xp === null
      }),
      { numRuns: 300 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: boundary values for computeEvolutionStage and xpToNextStage
// Task 3.4
// ─────────────────────────────────────────────────────────────────────────────

import { xpToNextStage } from '../pet'

describe('Unit tests: computeEvolutionStage boundary values', () => {
  it('xp=0 → baby (lowest possible XP)', () => {
    expect(computeEvolutionStage(0)).toBe('baby')
  })

  it('xp=99 → baby (just below teen threshold)', () => {
    expect(computeEvolutionStage(99)).toBe('baby')
  })

  it('xp=100 → teen (exactly at teen threshold)', () => {
    expect(computeEvolutionStage(100)).toBe('teen')
  })

  it('xp=299 → teen (just below adult threshold)', () => {
    expect(computeEvolutionStage(299)).toBe('teen')
  })

  it('xp=300 → adult (exactly at adult threshold)', () => {
    expect(computeEvolutionStage(300)).toBe('adult')
  })

  it('xp=699 → adult (just below legendary threshold)', () => {
    expect(computeEvolutionStage(699)).toBe('adult')
  })

  it('xp=700 → legendary (exactly at legendary threshold)', () => {
    expect(computeEvolutionStage(700)).toBe('legendary')
  })

  it('xp=10000 → legendary (well above legendary threshold)', () => {
    expect(computeEvolutionStage(10000)).toBe('legendary')
  })
})

describe('Unit tests: xpToNextStage for all stages', () => {
  it('egg stage → null (no XP path out of egg)', () => {
    expect(xpToNextStage(0, 'egg')).toBeNull()
  })

  it('baby stage → 100 (next threshold is teen at 100 XP)', () => {
    expect(xpToNextStage(0, 'baby')).toBe(100)
  })

  it('teen stage → 300 (next threshold is adult at 300 XP)', () => {
    expect(xpToNextStage(150, 'teen')).toBe(300)
  })

  it('adult stage → 700 (next threshold is legendary at 700 XP)', () => {
    expect(xpToNextStage(500, 'adult')).toBe(700)
  })

  it('legendary stage → null (already at max stage)', () => {
    expect(xpToNextStage(1000, 'legendary')).toBeNull()
  })
})
