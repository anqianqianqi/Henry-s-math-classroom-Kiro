import { describe, it, expect } from 'vitest'
import { boxToRect, isUsableBox, padBox, BOX_PAD } from '@/lib/solutions/crop'

describe('isUsableBox', () => {
  it('accepts a real box', () => {
    expect(isUsableBox({ x: 0.1, y: 0.2, w: 0.5, h: 0.3 })).toBe(true)
  })

  // A model that found nothing tends to say so with an empty rectangle rather
  // than by leaving the field out.
  it('rejects a box with no area', () => {
    expect(isUsableBox({ x: 0.1, y: 0.2, w: 0, h: 0.3 })).toBe(false)
    expect(isUsableBox({ x: 0.1, y: 0.2, w: 0.5, h: 0.001 })).toBe(false)
  })

  it('rejects rubbish', () => {
    for (const bad of [null, undefined, {}, 'box', 42, { x: 0, y: 0, w: NaN, h: 1 }]) {
      expect(isUsableBox(bad)).toBe(false)
    }
  })
})

describe('padBox', () => {
  it('grows the box on every side', () => {
    const p = padBox({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, 0.05)
    expect(p.x).toBeCloseTo(0.15, 6)
    expect(p.y).toBeCloseTo(0.15, 6)
    expect(p.w).toBeCloseTo(0.5, 6)
    expect(p.h).toBeCloseTo(0.5, 6)
  })

  // Padding must not walk off the page, and the far edge must not drift by
  // whatever the near edge lost to the clamp.
  it('clamps at the edges without losing the far side', () => {
    const p = padBox({ x: 0, y: 0, w: 0.5, h: 0.5 }, 0.1)
    expect(p.x).toBe(0)
    expect(p.y).toBe(0)
    expect(p.w).toBeCloseTo(0.6, 6)
    expect(p.h).toBeCloseTo(0.6, 6)
  })

  it('never exceeds the page', () => {
    const p = padBox({ x: 0.9, y: 0.9, w: 0.2, h: 0.2 }, 0.2)
    expect(p.x + p.w).toBeLessThanOrEqual(1)
    expect(p.y + p.h).toBeLessThanOrEqual(1)
  })

  it('handles a full-page box', () => {
    const p = padBox({ x: 0, y: 0, w: 1, h: 1 })
    expect(p).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })
})

describe('boxToRect', () => {
  it('scales onto the page it will actually be cut from', () => {
    const r = boxToRect({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 1000, 2000, 0)
    expect(r).toEqual({ left: 250, top: 1000, width: 500, height: 500 })
  })

  it('includes the padding', () => {
    const r = boxToRect({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 1000, 1000, 0.05)
    expect(r).toEqual({ left: 200, top: 200, width: 600, height: 600 })
  })

  // The whole point of the default: a tight box clips exponents.
  it('pads by default', () => {
    const tight = boxToRect({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, 1000, 1000, 0)
    const padded = boxToRect({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, 1000, 1000)
    expect(padded.width).toBeGreaterThan(tight.width)
    expect(padded.height).toBeGreaterThan(tight.height)
    expect(BOX_PAD).toBeGreaterThan(0)
  })

  it('stays inside the page for a box at the corner', () => {
    const r = boxToRect({ x: 0.95, y: 0.95, w: 0.1, h: 0.1 }, 800, 1200)
    expect(r.left + r.width).toBeLessThanOrEqual(800)
    expect(r.top + r.height).toBeLessThanOrEqual(1200)
  })

  it('never returns a zero-sized rectangle', () => {
    const r = boxToRect({ x: 0.5, y: 0.5, w: 0.0001, h: 0.0001 }, 100, 100, 0)
    expect(r.width).toBeGreaterThan(0)
    expect(r.height).toBeGreaterThan(0)
  })
})
