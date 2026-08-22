// Tests for what a generated pet room is told to fit.
//
// These exist because the previous version of this copy was wrong for months
// and nothing noticed: three routes each described the pet area in prose, the
// dashboard moved the room into the tile grid, and all three went on saying
// "a flex-1 div, roughly half the page width". A stale sentence in a prompt
// does not throw — it produces a plausible picture that is subtly wrong for
// the space.
//
// So the ratio the copy claims is checked against the size actually requested.
import { describe, it, expect } from 'vitest'
import {
  PET_AREA_CONTEXT,
  PET_AREA_REFINE_CONTEXT,
  PET_ROOM_IMAGE_SIZE,
} from '../promptContext'

describe('PET_ROOM_IMAGE_SIZE', () => {
  it('is a size GPT Image 2 actually offers', () => {
    expect(['1024x1024', '1536x1024', '1024x1536']).toContain(PET_ROOM_IMAGE_SIZE)
  })

  it('is landscape, because the pet area is wider than it is tall', () => {
    const [w, h] = PET_ROOM_IMAGE_SIZE.split('x').map(Number)
    expect(w).toBeGreaterThan(h)
  })
})

describe('the prose agrees with the request', () => {
  // The failure this is here to catch: someone changes the requested size and
  // leaves the copy saying 3:2, so the model composes for one shape and the
  // dashboard renders another.
  it('states the same ratio it asks the model for', () => {
    const [w, h] = PET_ROOM_IMAGE_SIZE.split('x').map(Number)
    const ratio = w / h
    for (const text of [PET_AREA_CONTEXT, PET_AREA_REFINE_CONTEXT]) {
      const claim = /(\d+):(\d+)/.exec(text)
      expect(claim, 'the copy should state an aspect ratio').not.toBeNull()
      const claimed = Number(claim![1]) / Number(claim![2])
      expect(claimed).toBeCloseTo(ratio, 2)
    }
  })

  it('quotes the size it actually requests', () => {
    expect(PET_AREA_CONTEXT).toContain(PET_ROOM_IMAGE_SIZE)
  })
})

describe('what both contexts must keep saying', () => {
  const both = [
    ['generate', PET_AREA_CONTEXT],
    ['refine', PET_AREA_REFINE_CONTEXT],
  ] as const

  it.each(both)('%s tells the model nothing is cropped', (_name, text) => {
    // The whole point of the aspect-ratio fix on #pet-area: every corner of
    // what the model draws ends up on screen, so it must compose for the full
    // rectangle rather than assume the edges are safe to waste.
    expect(text.toLowerCase()).toMatch(/crop/)
  })

  it.each(both)('%s protects the space the cat stands in', (_name, text) => {
    expect(text.toLowerCase()).toContain('lower-centre')
  })

  it.each(both)('%s protects the frame rectangles', (_name, text) => {
    expect(text.toLowerCase()).toMatch(/frame/)
  })

  it.each(both)('%s asks for animatable things to stay distinct', (_name, text) => {
    // AnimatedRoomLayer clips polygons around curtains, lamps and foliage. A
    // room where those blend into busy detail cannot be animated afterwards.
    expect(text.toLowerCase()).toMatch(/curtain|animat/)
  })
})
