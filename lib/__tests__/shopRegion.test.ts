import { describe, expect, it } from 'vitest'
import { canReceive, hiddenCount, visibleInRegion } from '../utils/shopRegion'

/**
 * The two failures worth pinning are opposites: selling a parcel to the wrong
 * continent, and locking a student out of the shop because a field nobody
 * showed them is blank.
 */

const digital = { id: 'd', region: null }
const usOnly = { id: 'u', region: 'us' }
const cnOnly = { id: 'c', region: 'cn' }

describe('canReceive', () => {
  it('lets anyone have something that does not ship', () => {
    expect(canReceive(digital, 'us')).toBe(true)
    expect(canReceive(digital, 'cn')).toBe(true)
    expect(canReceive(digital, null)).toBe(true)
  })

  it('keeps a shipped item to its own region', () => {
    expect(canReceive(usOnly, 'us')).toBe(true)
    expect(canReceive(usOnly, 'cn')).toBe(false)
    expect(canReceive(cnOnly, 'cn')).toBe(true)
    expect(canReceive(cnOnly, 'us')).toBe(false)
  })

  it('does not strand a student who has no region set', () => {
    // Matches the database trigger. Blocking here would empty the physical
    // shop for anyone who has not visited Settings — a worse outcome than the
    // wrong-continent purchase this exists to prevent, and far more common.
    expect(canReceive(usOnly, null)).toBe(true)
    expect(canReceive(cnOnly, null)).toBe(true)
  })

  it('treats an empty region as no region', () => {
    // A hand-edited row can hold '' rather than NULL.
    expect(canReceive({ region: '' }, 'cn')).toBe(true)
  })
})

describe('visibleInRegion', () => {
  const all = [digital, usOnly, cnOnly]

  it('shows a US student digital and US goods', () => {
    expect(visibleInRegion(all, 'us').map(i => i.id)).toEqual(['d', 'u'])
  })

  it('shows a China student digital and China goods', () => {
    expect(visibleInRegion(all, 'cn').map(i => i.id)).toEqual(['d', 'c'])
  })

  it('shows everything when the region is unknown', () => {
    expect(visibleInRegion(all, null)).toHaveLength(3)
  })

  it('keeps the order it was given', () => {
    const ordered = [cnOnly, digital, usOnly]
    expect(visibleInRegion(ordered, 'us').map(i => i.id)).toEqual(['d', 'u'])
  })
})

describe('hiddenCount', () => {
  it('counts what a student cannot see, so the shop can say why', () => {
    expect(hiddenCount([digital, usOnly, cnOnly], 'us')).toBe(1)
    expect(hiddenCount([digital, usOnly, cnOnly], null)).toBe(0)
    expect(hiddenCount([digital], 'cn')).toBe(0)
  })
})
