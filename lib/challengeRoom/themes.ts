/**
 * Room theme presets for the ChallengeRoom generator.
 *
 * Each theme carries a gadget pool; randomRoomSpec() deals four distinct
 * gadgets into the left/right tabletop slots so repeated rolls of the same
 * theme still produce different rooms.
 */

import type { RoomSpec } from '@/lib/types/challengeRoom'

interface RoomTheme {
  name: string
  mood: string
  palette: string
  architecture: string
  materials: string
  lighting: string
  views: string[]
  accent: string
  gadgets: string[]
}

export const ROOM_THEMES: RoomTheme[] = [
  {
    name: 'Moonlit Tide Observatory',
    mood: 'hushed, enchanted, contemplative',
    palette: 'deep teal, midnight blue, antique brass, warm amber',
    architecture: 'an intimate dark-wood observatory-library with carved arches and restrained climbing ivy',
    materials: 'walnut, aged brass, smoky glass, woven linen',
    lighting: 'warm pools of lamplight balanced against cool underwater moonlight',
    views: [
      'a luminous kelp forest beneath a moonlit ocean surface',
      'a quiet coral canyon with distant silver fish',
      'an ancient submerged garden glowing with blue plankton',
    ],
    accent: 'tiny constellations etched into the brass details',
    gadgets: [
      'a compact brass armillary sphere',
      'an amber stained-glass desk lamp',
      'a precision celestial dial',
      'a small inkwell with a gold quill',
      'a mechanical tide clock',
      'a glass specimen dome',
    ],
  },
  {
    name: 'Cloud Garden Atelier',
    mood: 'airy, hopeful, gently whimsical',
    palette: 'powder blue, cream, pale sage, brushed gold',
    architecture: 'a sun-washed botanical atelier with arched plasterwork and delicate trellised vines',
    materials: 'limewash plaster, pale oak, frosted glass, porcelain',
    lighting: 'soft morning sunlight with floating dust motes and a pearly sky glow',
    views: [
      'floating islands drifting through a sea of clouds',
      'a sky garden of enormous white blossoms',
      'distant airships crossing a peach-and-blue sunrise',
    ],
    accent: 'fine gold leaf lines following the architectural curves',
    gadgets: [
      'a porcelain wind compass',
      'a tiny brass weather vane',
      'a glass cloud barometer',
      'a potted miniature olive tree',
      'a pearl-handled magnifying lens',
      'a folded celestial map stand',
    ],
  },
  {
    name: 'Emberglass Alchemist',
    mood: 'mysterious, warm, precise',
    palette: 'charcoal, oxblood, ember orange, tarnished copper',
    architecture: 'a refined volcanic-stone study with a broad arched aperture and geometric copper inlay',
    materials: 'black basalt, smoked oak, hammered copper, amber glass',
    lighting: 'low firelight, gentle orange reflections, and a cool rim from the window',
    views: [
      'a distant volcanic valley threaded with glowing rivers',
      'a black-sand plain under an amber aurora',
      'crystalline lava caverns sparkling beyond the glass',
    ],
    accent: 'subtle alchemical glyphs engraved into metal edges',
    gadgets: [
      'a copper orrery',
      'an amber retort in a brass stand',
      'a mechanical astrolabe',
      'a hooded ember lamp',
      'a small mineral specimen case',
      'a sealed charcoal sketch folio',
    ],
  },
  {
    name: 'Frostbound Storykeeper',
    mood: 'serene, wintry, magical',
    palette: 'ice blue, parchment, silver, weathered pine',
    architecture: 'a northern story room with deep timber window reveals and carved snowflake tracery',
    materials: 'weathered pine, brushed silver, wool, translucent ice glass',
    lighting: 'candle warmth against clear blue polar twilight',
    views: [
      'a quiet snowy forest beneath green aurora ribbons',
      'a frozen fjord reflecting a violet dawn',
      'snow-covered mountains under a star-filled sky',
    ],
    accent: 'frost-like filigree along the shelving',
    gadgets: [
      'a silver moon compass',
      'a frosted-glass candle lantern',
      'a carved wooden star wheel',
      'a crystal snow globe',
      'a miniature brass telescope',
      'a pale ceramic ink pot',
    ],
  },
  {
    name: 'Mosslight Woodland Archive',
    mood: 'earthy, secret, welcoming',
    palette: 'fern green, chestnut, honey, soft moss',
    architecture: 'a storybook woodland archive grown into a hollow ancient tree with a deep arched window',
    materials: 'living wood, moss, hammered bronze, handblown green glass',
    lighting: 'dappled golden light with tiny firefly glows',
    views: [
      'an old-growth forest filled with fireflies and mist',
      'a fern valley with a distant waterfall',
      'a moonlit mushroom grove beneath giant roots',
    ],
    accent: 'delicate leaf veins picked out in aged gold',
    gadgets: [
      'a bronze beetle clock',
      'a mushroom-cap reading lamp',
      'a tiny terrarium globe',
      'a leaf-shaped compass',
      'a ceramic acorn inkwell',
      'a miniature field microscope',
    ],
  },
]

function pick<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)]
}

/** Fisher-Yates, then take the first `count` — guarantees no repeats. */
function pickDistinct(values: string[], count: number): string[] {
  const copy = [...values]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
}

export function randomRoomSpec(theme?: RoomTheme): RoomSpec {
  const t = theme ?? pick(ROOM_THEMES)
  const objects = pickDistinct(t.gadgets, 4)
  return {
    name: t.name,
    mood: t.mood,
    palette: t.palette,
    architecture: t.architecture,
    materials: t.materials,
    lighting: t.lighting,
    outsideView: pick(t.views),
    leftObjects: [objects[0], objects[1]],
    rightObjects: [objects[2], objects[3]],
    accent: t.accent,
    notes: '',
  }
}

export function emptyRoomSpec(): RoomSpec {
  return {
    name: '',
    mood: '',
    palette: '',
    architecture: '',
    materials: '',
    lighting: '',
    outsideView: '',
    leftObjects: ['', ''],
    rightObjects: ['', ''],
    accent: '',
    notes: '',
  }
}
