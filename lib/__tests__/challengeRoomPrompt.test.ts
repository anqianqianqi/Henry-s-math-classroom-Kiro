import { describe, expect, it } from 'vitest'
import { compileRoomPrompt, validateRoomSpec } from '../challengeRoom/prompt'
import { LEGACY_ROOM_RENDER, resolveArtStyle } from '../art-styles'
import type { RoomSpec } from '../types/challengeRoom'

/**
 * A WebGL book is composited into the middle of this image. The camera pitch,
 * the empty central zone and the tabletop proportions are a contract with
 * components/challenge-room/RoomPlacementStage — get them wrong and every room
 * ever generated stops being usable, silently, because the prompt still returns
 * a perfectly nice picture.
 *
 * So the whole block is pinned. A future edit inside it fails here with a diff
 * rather than surfacing months later as "the book looks wrong in that room".
 */
const COMPOSITING_CONTRACT = [
  '- Camera is horizontally centered with zero Dutch roll, but raised above the desk and pitched downward about 40–45 degrees toward the tabletop. Use a high three-quarter tabletop view, not an eye-level view.',
  '- Preserve a calm, symmetrical architectural composition: the central aperture stays centered and visually frontal, and all vertical walls and window mullions remain vertical.',
].join('\n')

const TABLETOP_CONTRACT = [
  '- A broad uncluttered tabletop fills roughly the lower 45% of the canvas. Show a generous amount of its top surface; keep the front apron or vertical front edge to no more than 6% of the image height.',
  '- Preserve a completely empty central placement zone occupying roughly 52% of the table width and 45% of the lower image height.',
  '- The center must be suitable for compositing a flat book seen clearly from above. An imaginary portrait book placed there should read as a tall, easily visible quadrilateral with most of its cover or pages visible, never as a shallow horizontal sliver.',
  '- The empty placement zone is plain tabletop only: no book, paper, cloth, shadowed object, decoration, spill, plant, writing tool, or ornament.',
].join('\n')

/** A recipe as saved before artStyle and aperture existed. */
const LEGACY: RoomSpec = {
  name: 'Moonlit Tide Observatory',
  mood: 'hushed, enchanted, contemplative',
  palette: 'deep teal, midnight blue, antique brass, warm amber',
  architecture: 'an intimate dark-wood observatory-library with carved arches and restrained climbing ivy',
  materials: 'walnut, aged brass, smoky glass, woven linen',
  lighting: 'warm pools of lamplight balanced against cool underwater moonlight',
  outsideView: 'a luminous kelp forest beneath a moonlit ocean surface',
  leftObjects: ['a compact brass armillary sphere', 'an amber stained-glass desk lamp'],
  rightObjects: ['a precision celestial dial', 'a small inkwell with a gold quill'],
  accent: 'tiny constellations etched into the brass details',
  notes: '',
}

describe('the compositing contract', () => {
  it('survives verbatim', () => {
    const prompt = compileRoomPrompt(LEGACY)
    expect(prompt).toContain(COMPOSITING_CONTRACT)
    expect(prompt).toContain(TABLETOP_CONTRACT)
  })

  it('keeps each invariant individually, so a failure names itself', () => {
    const prompt = compileRoomPrompt(LEGACY)
    expect(prompt).toContain('pitched downward about 40–45 degrees')
    expect(prompt).toContain('roughly 52% of the table width and 45% of the lower image height')
    expect(prompt).toContain('fills roughly the lower 45% of the canvas')
    expect(prompt).toContain('no book on the table')
    expect(prompt).toContain('Exactly two main freestanding objects on the left')
    expect(prompt).toContain('Exactly two main freestanding objects on the right')
    expect(prompt).toContain('Keep all four objects outside the empty central placement zone')
    expect(prompt).toContain('3:2 landscape')
  })
})

describe('a recipe saved before art style existed', () => {
  it('still validates', () => {
    // challenge_rooms.recipe holds these. If validation ever demanded the new
    // fields, every existing room would 400 on regenerate — in the admin page
    // and again in the API route.
    expect(validateRoomSpec(LEGACY)).toBeNull()
  })

  it('still compiles to the arched-window sentence, unchanged', () => {
    expect(compileRoomPrompt(LEGACY)).toContain(
      '- A single large arched window occupies the central upper half. Its timber or stone reveal is visibly deep, with a broad sill and believable frame thickness.')
  })

  it('still gets the old style line', () => {
    expect(compileRoomPrompt(LEGACY)).toContain(LEGACY_ROOM_RENDER)
  })
})

describe('art style', () => {
  it('replaces the style line when set', () => {
    const prompt = compileRoomPrompt({ ...LEGACY, artStyle: 'futuristic' })
    expect(prompt).toContain(resolveArtStyle('futuristic')!.roomRender)
    expect(prompt).not.toContain(LEGACY_ROOM_RENDER)
  })

  it('degrades rather than throwing on junk', () => {
    for (const bad of ['', 'holographic-macrame', undefined]) {
      const prompt = compileRoomPrompt({ ...LEGACY, artStyle: bad })
      expect(prompt).toContain(LEGACY_ROOM_RENDER)
    }
  })
})

describe('aperture', () => {
  it('replaces the arch without loosening the geometry around it', () => {
    const prompt = compileRoomPrompt({ ...LEGACY, aperture: 'brass-ringed observation port' })
    expect(prompt).toContain('A single large brass-ringed observation port occupies the central upper half')
    // The template around the noun phrase is what the composition relies on.
    expect(prompt).toContain('occupies the central upper half')
    expect(prompt).toContain('reveal is visibly deep, with a broad sill and believable frame thickness')
    expect(prompt).toContain('stays centered and visually frontal')
  })

  it('actually removes the arch — the override is gone', () => {
    // The whole point: a theme that is not arch-shaped must not still be told
    // to draw an arched window.
    const prompt = compileRoomPrompt({
      ...LEGACY,
      architecture: 'a spare listening station of poured concrete and pale ply',
      aperture: 'square glazing panel set flush in the wall',
    })
    expect(prompt).not.toContain('arched window')
  })
})
