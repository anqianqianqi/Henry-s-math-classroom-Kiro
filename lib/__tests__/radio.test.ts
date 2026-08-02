import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_RADIO_PALETTE,
  DEFAULT_RADIO_PLACEMENT,
  RADIO_MODEL_URL,
  RADIO_PALETTES,
  radioActionFor,
  radioPaletteUrl,
} from '../challengeRoom/radio'
import { challengeAssetTasks } from '../challengeRoom/preload'

describe('clicking the radio', () => {
  it('maps the two parts a hand would reach for', () => {
    expect(radioActionFor('region_knobs')).toBe('next')
    expect(radioActionFor('region_dial_face')).toBe('playlist')
  })

  it('treats every other region as "the radio"', () => {
    // Region names come from the GLB's materials, so this list is the contract
    // with the asset. Anything unmapped must open the panel rather than doing
    // nothing, or parts of the model would feel dead.
    for (const region of [
      'region_cabinet', 'region_front_panel', 'region_speaker_grille',
      'region_metal_trim', 'region_back_and_feet',
    ]) {
      expect(radioActionFor(region), region).toBe('panel')
    }
  })

  it('falls back to the panel for a miss or an unknown name', () => {
    expect(radioActionFor(null)).toBe('panel')
    expect(radioActionFor(undefined)).toBe('panel')
    expect(radioActionFor('region_invented')).toBe('panel')
  })
})

describe('palettes', () => {
  it('has five, with unique ids and distinct files', () => {
    expect(RADIO_PALETTES).toHaveLength(5)
    expect(new Set(RADIO_PALETTES.map(p => p.id)).size).toBe(5)
    expect(new Set(RADIO_PALETTES.map(p => p.url)).size).toBe(5)
  })

  it('points at files that exist', () => {
    // The ids are also DB values, so a typo here is a room that renders an
    // untextured white radio for whoever picked it.
    for (const palette of [...RADIO_PALETTES, { url: RADIO_MODEL_URL, id: 'model' }]) {
      const path = resolve(process.cwd(), 'public', palette.url.replace(/^\//, ''))
      expect(existsSync(path), `${palette.id} → ${palette.url}`).toBe(true)
    }
  })

  it('falls back to walnut rather than returning nothing', () => {
    // An unknown id has to render SOMETHING: a renamed palette must not leave a
    // student with a radio that has no texture at all.
    expect(radioPaletteUrl(null)).toBe(RADIO_PALETTES[0].url)
    expect(radioPaletteUrl(undefined)).toBe(RADIO_PALETTES[0].url)
    expect(radioPaletteUrl('deleted-palette')).toBe(RADIO_PALETTES[0].url)
    expect(radioPaletteUrl('bordeaux')).toContain('bordeaux')
  })

  it('defaults to one that exists', () => {
    expect(RADIO_PALETTES.some(p => p.id === DEFAULT_RADIO_PALETTE)).toBe(true)
  })
})

describe('the default placement', () => {
  it('stands the radio off-centre, where the window and book are not', () => {
    // Every room's aperture is centred and frontal by prompt, so a radio
    // starting at 0,0 would be dropped straight onto the book.
    expect(Math.abs(DEFAULT_RADIO_PLACEMENT.x)).toBeGreaterThan(0.5)
    expect(DEFAULT_RADIO_PLACEMENT.scale).toBeGreaterThan(0)
  })
})

describe('the radio inside the preload gate', () => {
  const room = {
    roomUrl: 'https://x/room.png',
    modelUrl: 'https://x/book.glb',
    coverUrl: 'https://x/cover.png',
    innerUrl: 'https://x/inner.png',
  }

  it('adds the model and the palette when a room has one placed', () => {
    const withRadio = challengeAssetTasks(
      { ...room, radioModelUrl: RADIO_MODEL_URL, radioTextureUrl: RADIO_PALETTES[0].url },
      true,
    )
    const without = challengeAssetTasks(room, true)
    expect(withRadio.length).toBe(without.length + 2)
  })

  it('adds nothing when the room has no radio', () => {
    // radioModelUrl is null unless a placement exists, so a room without one
    // never downloads a model it will not draw.
    expect(challengeAssetTasks({ ...room, radioModelUrl: null, radioTextureUrl: null }, true))
      .toHaveLength(challengeAssetTasks(room, true).length)
  })

  it('never adds the radio on the 2D path', () => {
    const tasks = challengeAssetTasks(
      { graphUrl: 'https://x/g.png', radioModelUrl: RADIO_MODEL_URL, radioTextureUrl: RADIO_PALETTES[0].url },
      false,
    )
    expect(tasks).toHaveLength(1)
  })

  it('does not weight 24 KB like the 2.63 MiB book', () => {
    // Given the model's weight, the bar would sit at nothing while the book —
    // the actual wait — downloaded.
    const tasks = challengeAssetTasks(
      { ...room, radioModelUrl: RADIO_MODEL_URL, radioTextureUrl: RADIO_PALETTES[0].url },
      true,
    )
    expect(tasks.filter(t => t.kind === 'model')).toHaveLength(1)
  })
})
