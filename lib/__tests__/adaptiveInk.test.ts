import { describe, expect, it } from 'vitest'
import {
  INK_CROSSOVER,
  INK_DARK,
  INK_LIGHT,
  inkContrast,
  inkForLuminance,
  luminance,
} from '../ui/adaptiveInk'

/**
 * Pinned by outcome rather than by threshold. What matters is that no room
 * ends up with a frame nobody can see — asserting the crossover constant back
 * at itself would pass even if the rule were inverted.
 */

describe('inkForLuminance', () => {
  it('draws dark on a pale room', () => {
    // The cream room measured at 226.
    expect(inkForLuminance(226)).toBe(INK_DARK)
  })

  it('draws light on a dark room', () => {
    // The dark room measured at 23. Graphite there is lighter than the wall
    // it sits on, which is what made the frame vanish.
    expect(inkForLuminance(23)).toBe(INK_LIGHT)
  })

  it('draws light on a mid-tone room', () => {
    // 110, the pet room. The old fixed graphite gave contrast 22 here.
    expect(inkForLuminance(110)).toBe(INK_LIGHT)
  })

  it('switches exactly once, and in the right direction', () => {
    expect(inkForLuminance(INK_CROSSOVER - 1)).toBe(INK_LIGHT)
    expect(inkForLuminance(INK_CROSSOVER + 1)).toBe(INK_DARK)
  })
})

describe('inkContrast', () => {
  it('never leaves a room below the worst case at the crossover', () => {
    // The crossover is the hardest surface to draw on: it is equally far from
    // both inks. Every other brightness must do at least as well.
    const worst = inkContrast(INK_CROSSOVER, 0.5)
    for (let L = 0; L <= 255; L += 5) {
      expect(inkContrast(L, 0.5)).toBeGreaterThanOrEqual(worst - 0.001)
    }
    expect(worst).toBeGreaterThan(40)
  })

  it('beats a fixed dark ink on the rooms that were failing', () => {
    // Fixed graphite on the dark room: |23 - (23*0.5 + 62.4*0.5)| ≈ 20.
    const fixedOnDark = Math.abs(23 - (23 * 0.5 + 62.4 * 0.5))
    expect(inkContrast(23, 0.5)).toBeGreaterThan(fixedOnDark * 4)
  })

  it('leaves the pale room roughly where it already was', () => {
    // This one was working; adapting must not disturb it.
    expect(inkContrast(226, 0.5)).toBeGreaterThan(75)
  })
})

describe('luminance', () => {
  it('is 0 for black and 255 for white', () => {
    expect(luminance(0, 0, 0)).toBe(0)
    expect(luminance(255, 255, 255)).toBe(255)
  })

  it('weights green most, as Rec. 601 does', () => {
    expect(luminance(0, 255, 0)).toBeGreaterThan(luminance(255, 0, 0))
    expect(luminance(255, 0, 0)).toBeGreaterThan(luminance(0, 0, 255))
  })
})
