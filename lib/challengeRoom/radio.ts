/**
 * The radio: where its files live, and what clicking each part does.
 *
 * Small and free of React so both the challenge page and the preloader can read
 * it without pulling a component in.
 */

import type { Placement } from '@/lib/types/challengeRoom'
import type { TranslationKey } from '@/lib/i18n/catalog'

/** Stripped GLB — geometry and the seven region materials, no textures. */
export const RADIO_MODEL_URL = '/models/vintage-radio-notex.glb'

/**
 * Where a newly added radio starts, before an admin drags it.
 *
 * Upper right rather than centre: every room's aperture is centred and frontal
 * by prompt, so the middle of the frame is where the window — and the book
 * below it — already are. Off to one side of the sill is both a sensible first
 * guess and somewhere the admin can see it to grab it.
 */
export const DEFAULT_RADIO_PLACEMENT: Placement = {
  x: 1.35, y: 0.55, scale: 1, tilt: 0, turn: -20, roll: 0,
}

export interface RadioPalette {
  id: string
  /**
   * Message key, typed against the catalogue so a renamed key is a compile
   * error rather than a raw `radio.paletteBordeaux` shown to a student. The
   * names are ours, so unlike track titles they are translated.
   */
  labelKey: TranslationKey
  url: string
}

/**
 * Baked by scripts/bake-radio-palettes.mjs from the presets that ship in the
 * handoff's regions.json. Adding one means re-running the baker — the runtime
 * has no recolour path, deliberately.
 */
export const RADIO_PALETTES: RadioPalette[] = [
  { id: 'original-walnut', labelKey: 'radio.paletteOriginalWalnut', url: '/models/radio-palettes/radio-original-walnut.png' },
  { id: 'forest-room',     labelKey: 'radio.paletteForestRoom',     url: '/models/radio-palettes/radio-forest-room.png' },
  { id: 'atlantic-blue',   labelKey: 'radio.paletteAtlanticBlue',   url: '/models/radio-palettes/radio-atlantic-blue.png' },
  { id: 'bordeaux',        labelKey: 'radio.paletteBordeaux',       url: '/models/radio-palettes/radio-bordeaux.png' },
  { id: 'pistachio',       labelKey: 'radio.palettePistachio',      url: '/models/radio-palettes/radio-pistachio.png' },
]

export const DEFAULT_RADIO_PALETTE = RADIO_PALETTES[0].id

/** Falls back to walnut for an unknown or absent id, so a bad row still renders. */
export function radioPaletteUrl(id: string | null | undefined): string {
  return (RADIO_PALETTES.find(p => p.id === id) ?? RADIO_PALETTES[0]).url
}

/**
 * What a click on each part of the radio does.
 *
 * The stripped GLB is one primitive per region material, so the raycast hands
 * back these names directly. Only the two parts a person would actually reach
 * for get their own behaviour; everything else is "the radio", which opens the
 * panel where the full controls live.
 */
export type RadioAction = 'next' | 'playlist' | 'panel'

export function radioActionFor(region: string | null | undefined): RadioAction {
  if (region === 'region_knobs') return 'next'
  if (region === 'region_dial_face') return 'playlist'
  return 'panel'
}
