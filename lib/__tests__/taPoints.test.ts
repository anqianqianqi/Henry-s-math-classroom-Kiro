import { describe, expect, it } from 'vitest'
import {
  TA_POINTS_PER_THANKS,
  computeTaBalance,
  shouldAwardPoint,
  thankableResponders,
} from '../utils/taPoints'

/**
 * The two rules that decide whether a point is created, and who can create it.
 * Both are places where a mistake mints currency rather than merely looking
 * wrong, so they are worth pinning even though each is one line.
 */

describe('shouldAwardPoint', () => {
  it('pays a student', () => {
    expect(shouldAwardPoint(false)).toBe(true)
  })

  it('pays a teacher nothing', () => {
    // They still resolve the question — they just do not collect for it.
    expect(shouldAwardPoint(true)).toBe(false)
  })

  it('is one point per thanks', () => {
    expect(TA_POINTS_PER_THANKS).toBe(1)
  })
})

describe('thankableResponders', () => {
  const OWNER = 'owner-1'

  it('excludes the question owner', () => {
    // A student may answer their own question, so this is reachable, not
    // theoretical: without it the owner could mint a point from nothing.
    const list = thankableResponders(
      [{ userId: OWNER }, { userId: 'helper-1' }],
      OWNER,
    )
    expect(list.map(r => r.userId)).toEqual(['helper-1'])
  })

  it('lists someone once however many times they replied', () => {
    const list = thankableResponders(
      [{ userId: 'helper-1' }, { userId: 'helper-1' }, { userId: 'helper-2' }],
      OWNER,
    )
    expect(list.map(r => r.userId)).toEqual(['helper-1', 'helper-2'])
  })

  it('is empty when only the owner replied', () => {
    // The bar stays hidden in this case, so there is no dead button to press.
    expect(thankableResponders([{ userId: OWNER }], OWNER)).toEqual([])
  })

  it('keeps the rest of each responder intact', () => {
    const list = thankableResponders(
      [{ userId: 'helper-1', displayName: 'Chloe', isStaff: false }],
      OWNER,
    )
    expect(list[0]).toEqual({ userId: 'helper-1', displayName: 'Chloe', isStaff: false })
  })
})

describe('computeTaBalance', () => {
  it('is earned minus spent', () => {
    expect(computeTaBalance(5, 2)).toBe(3)
  })

  it('starts at zero', () => {
    expect(computeTaBalance(0, 0)).toBe(0)
  })

  it('does not reduce what was earned when spending', () => {
    // Mirrors the challenge-points invariant: the score is a record of what you
    // did, the balance is what is left to spend.
    const earned = 10
    expect(computeTaBalance(earned, 10)).toBe(0)
    expect(earned).toBe(10)
  })
})
