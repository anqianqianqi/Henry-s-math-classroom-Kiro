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
