/**
 * Room theme presets for the ChallengeRoom generator.
 *
 * ── WHY A THEME IS LISTS, NOT STRINGS ───────────────────────
 * Each theme used to weld mood, palette, lighting and accent into one fixed
 * string apiece, so five themes meant five rooms: re-rolling gave you the same
 * picture with two different desk trinkets. A theme is now a WORLD that owns
 * several interchangeable values on each axis.
 *
 * The alternative — a free cross-product of global palette, mood and style
 * lists — buys more combinations and loses coherence: it will happily put a
 * volcanic alchemist's study in a pastel meadow palette. Per-theme sub-lists
 * mean no pairing exists that a person did not sign off on, and the review unit
 * stays one theme.
 *
 * ── STYLE VS SUBSTRATE ──────────────────────────────────────
 * `styles` is an allow-list, not decoration. An art style says HOW a thing is
 * painted; the theme owns WHAT it is made of. Minimalist — flat shapes, two or
 * three colours, no fine detail — fights a deep window reveal and delicate gold
 * accents, so only themes authored for it list it.
 *
 * randomRoomSpec() deals four distinct objects into the left/right tabletop
 * slots, so repeated rolls of one theme still differ.
 */

import type { RoomSpec } from '@/lib/types/challengeRoom'

/** Groups the theme chips in the admin picker; mirrors the /book-skins families. */
export type ThemeFamily = 'nature' | 'science' | 'fantasy' | 'history' | 'everyday'

export interface RoomTheme {
  name: string
  family: ThemeFamily
  /** ART_STYLES ids this world can carry without falling apart. */
  styles: string[]
  /** Singular on purpose — these two ARE the world's identity. */
  architecture: string
  materials: string
  palettes: string[]
  moods: string[]
  lighting: string[]
  /** The window's form. Fills a noun phrase in a fixed sentence — see prompt.ts. */
  apertures: string[]
  views: string[]
  accents: string[]
  /** Tabletop objects; four are dealt per roll. Keep well above four. */
  objects: string[]
}

export const ROOM_THEMES: RoomTheme[] = [
  {
    name: 'Moonlit Tide Observatory',
    family: 'fantasy',
    styles: ['ghibli', 'watercolour', 'realistic', 'vintage'],
    architecture: 'an intimate dark-wood observatory-library with carved arches and restrained climbing ivy',
    materials: 'walnut, aged brass, smoky glass, woven linen',
    palettes: [
      'deep teal, midnight blue, antique brass, warm amber',
      'abyssal indigo, pewter, sea-glass green, candle gold',
      'slate blue, drowned violet, tarnished silver, pale coral',
    ],
    moods: [
      'hushed, enchanted, contemplative',
      'expectant, secretive, softly wondrous',
      'still, scholarly, faintly melancholy',
    ],
    lighting: [
      'warm pools of lamplight balanced against cool underwater moonlight',
      'shifting caustics from the water throwing ripples across the ceiling',
      'a single low lamp with deep blue shadow filling the corners',
    ],
    apertures: [
      'arched window with a deep carved timber reveal',
      'brass-ringed observation port set into the stone',
    ],
    views: [
      'a luminous kelp forest beneath a moonlit ocean surface',
      'a quiet coral canyon with distant silver fish',
      'an ancient submerged garden glowing with blue plankton',
      'a slow whale passing far off through shafts of moonlight',
    ],
    accents: [
      'tiny constellations etched into the brass details',
      'faint tide-line marks scribed along the timber',
    ],
    objects: [
      'a compact brass armillary sphere',
      'an amber stained-glass desk lamp',
      'a precision celestial dial',
      'a small inkwell with a gold quill',
      'a mechanical tide clock',
      'a glass specimen dome over a coral fragment',
      'a folded chart weighted with a smooth black pebble',
      'a brass diving helmet the size of a teacup',
      'a rack of glass sounding tubes',
      'a nautilus shell on a turned wooden stand',
      'a lacquered box of navigational pins',
      'a magnifier with a mother-of-pearl handle',
    ],
  },
  {
    name: 'Cloud Garden Atelier',
    family: 'nature',
    styles: ['ghibli', 'watercolour', 'minimalist', 'realistic'],
    architecture: 'a sun-washed botanical atelier with arched plasterwork and delicate trellised vines',
    materials: 'limewash plaster, pale oak, frosted glass, porcelain',
    palettes: [
      'powder blue, cream, pale sage, brushed gold',
      'chalk white, soft apricot, celadon, pale straw',
      'morning grey, blush, mint, warm ivory',
    ],
    moods: [
      'airy, hopeful, gently whimsical',
      'unhurried, bright, quietly industrious',
      'fresh, open, faintly dreamlike',
    ],
    lighting: [
      'soft morning sunlight with floating dust motes and a pearly sky glow',
      'flat overcast daylight, even and shadowless',
      'late golden light raking low across the plaster',
    ],
    apertures: [
      'tall arched window with slim glazing bars and a broad plaster sill',
      'wide round oculus with a smooth deep plaster reveal',
    ],
    views: [
      'floating islands drifting through a sea of clouds',
      'a sky garden of enormous white blossoms',
      'distant airships crossing a peach-and-blue sunrise',
      'a slow river of mist pouring between green hills',
    ],
    accents: [
      'fine gold leaf lines following the architectural curves',
      'pressed leaf silhouettes set into the plasterwork',
    ],
    objects: [
      'a porcelain wind compass',
      'a tiny brass weather vane',
      'a glass cloud barometer',
      'a potted miniature olive tree',
      'a pearl-handled magnifying lens',
      'a folded celestial map stand',
      'a shallow dish of seed packets',
      'a bone-handled pair of botanical scissors',
      'a stack of pale ceramic specimen trays',
      'a glass cloche over a single fern frond',
      'a watering can in unglazed white clay',
      'a slim notebook bound in pale linen',
    ],
  },
  {
    name: 'Emberglass Alchemist',
    family: 'fantasy',
    styles: ['realistic', 'vintage', 'ghibli'],
    architecture: 'a refined volcanic-stone study with a broad arched aperture and geometric copper inlay',
    materials: 'black basalt, smoked oak, hammered copper, amber glass',
    palettes: [
      'charcoal, oxblood, ember orange, tarnished copper',
      'obsidian, rust, molten gold, deep umber',
      'ash grey, wine red, brass, smoke black',
    ],
    moods: [
      'mysterious, warm, precise',
      'intent, close, faintly dangerous',
      'patient, ritual, quietly proud',
    ],
    lighting: [
      'low firelight, gentle orange reflections, and a cool rim from the window',
      'a single furnace glow throwing long hard shadows',
      'banked embers with one bright amber lamp at the desk',
    ],
    apertures: [
      'broad arched aperture cut through thick basalt',
      'tall hexagonal window framed in hammered copper',
    ],
    views: [
      'a distant volcanic valley threaded with glowing rivers',
      'a black-sand plain under an amber aurora',
      'crystalline lava caverns sparkling beyond the glass',
      'a slow ash fall drifting past a red horizon',
    ],
    accents: [
      'subtle alchemical glyphs engraved into metal edges',
      'thin veins of copper inlaid across the black stone',
    ],
    objects: [
      'a copper orrery',
      'an amber retort in a brass stand',
      'a mechanical astrolabe',
      'a hooded ember lamp',
      'a small mineral specimen case',
      'a sealed charcoal sketch folio',
      'a set of graduated copper measures',
      'a mortar and pestle in black basalt',
      'a rack of stoppered amber vials',
      'a brass balance with tiny weights',
      'a folded leather tool roll',
      'a crucible cooling on a slate tile',
    ],
  },
  {
    name: 'Frostbound Storykeeper',
    family: 'nature',
    styles: ['ghibli', 'watercolour', 'realistic', 'minimalist'],
    architecture: 'a northern story room with deep timber window reveals and carved snowflake tracery',
    materials: 'weathered pine, brushed silver, wool, translucent ice glass',
    palettes: [
      'ice blue, parchment, silver, weathered pine',
      'glacier white, pale birch, cold pewter, soft rose',
      'deep navy, frost grey, bone, muted gold',
    ],
    moods: [
      'serene, wintry, magical',
      'snug, insulated, quietly glad',
      'crisp, solitary, clear-headed',
    ],
    lighting: [
      'candle warmth against clear blue polar twilight',
      'flat white snow-glare filling the room evenly',
      'green aurora light washing the ceiling above a low lamp',
    ],
    apertures: [
      'deep-set timber window with carved snowflake tracery',
      'small paned casement with a thick frost-rimed reveal',
    ],
    views: [
      'a quiet snowy forest beneath green aurora ribbons',
      'a frozen fjord reflecting a violet dawn',
      'snow-covered mountains under a star-filled sky',
      'a lone lit cabin far across an unbroken snowfield',
    ],
    accents: [
      'frost-like filigree along the shelving',
      'pale carved runes following the beam edges',
    ],
    objects: [
      'a silver moon compass',
      'a frosted-glass candle lantern',
      'a carved wooden star wheel',
      'a crystal snow globe',
      'a miniature brass telescope',
      'a pale ceramic ink pot',
      'a folded wool blanket on a low stool',
      'a birch-bark box tied with twine',
      'a pair of bone reading spectacles',
      'a small iron stove-lighter on a tile',
      'a stack of pressed-flower cards',
      'a mug of something steaming, left cooling',
    ],
  },
  {
    name: 'Mosslight Woodland Archive',
    family: 'nature',
    styles: ['ghibli', 'watercolour', 'vintage'],
    architecture: 'a storybook woodland archive grown into a hollow ancient tree with a deep arched window',
    materials: 'living wood, moss, hammered bronze, handblown green glass',
    palettes: [
      'fern green, chestnut, honey, soft moss',
      'deep forest, bark brown, amber, pale lichen',
      'olive, russet, cream, old bronze',
    ],
    moods: [
      'earthy, secret, welcoming',
      'drowsy, green, softly alive',
      'curious, sheltered, faintly ancient',
    ],
    lighting: [
      'dappled golden light with tiny firefly glows',
      'deep green shade broken by one shaft of afternoon sun',
      'low amber lamplight under a canopy of shadow',
    ],
    apertures: [
      'deep arched window opened through the living trunk',
      'irregular knothole window with a thick mossy sill',
    ],
    views: [
      'an old-growth forest filled with fireflies and mist',
      'a fern valley with a distant waterfall',
      'a moonlit mushroom grove beneath giant roots',
      'a stream running bright between mossed stones',
    ],
    accents: [
      'delicate leaf veins picked out in aged gold',
      'small bronze beetles set into the woodwork',
    ],
    objects: [
      'a bronze beetle clock',
      'a mushroom-cap reading lamp',
      'a tiny terrarium globe',
      'a leaf-shaped compass',
      'a ceramic acorn inkwell',
      'a miniature field microscope',
      'a bundle of dried herbs tied with thread',
      'a shallow bowl of collected seeds',
      'a magnifier resting on a pressed-fern sheet',
      'a carved wooden owl the size of a fist',
      'a green glass bottle holding one feather',
      'a coil of waxed twine on a wooden spool',
    ],
  },

  // ── New worlds ────────────────────────────────────────────────────────────
  // Chosen to widen the axes the old five never covered: no vintage-industrial,
  // no hard-edge or minimalist-friendly room, no warm tropical, no genuinely
  // dark palette, and nothing an admin could plausibly want for a maths class
  // set somewhere other than a storybook.

  {
    name: 'Brass Meridian Aeronautics',
    family: 'science',
    styles: ['vintage', 'realistic', 'ghibli'],
    architecture: 'a riveted airship chart-room with a curved hull wall and folding brass instrument arms',
    materials: 'riveted brass, oiled walnut, waxed canvas, cracked leather',
    palettes: [
      'oxidised brass, cloud white, navy ink, worn leather tan',
      'storm pewter, ochre canvas, verdigris, oil-lamp yellow',
      'sunrise coral, chart-paper cream, riveted steel, deep indigo',
    ],
    moods: [
      'purposeful, expectant, quietly heroic',
      'wind-scoured, adventurous, warm',
      'meticulous, patient, faintly nostalgic',
    ],
    lighting: [
      'flat high cloudlight from the aperture with a single warm gimbal lamp',
      'low sunrise raking across the chart table, brass throwing long highlights',
      'overcast grey wash softened by a hooded oil lamp',
    ],
    apertures: [
      'brass-ringed observation port with a visibly thick riveted rim',
      'tall bevelled navigation window set deep in the hull',
    ],
    views: [
      'an endless cloud deck lit from below by a hidden sunrise',
      'a mountain range breaking through a white overcast sea',
      'a distant fleet of dirigibles crossing a pale blue morning',
      'a slow thunderhead building over a patchwork of farmland',
    ],
    accents: [
      'engraved meridian degree marks along the brass edges',
      'fine compass-rose inlay repeated in the woodwork',
    ],
    objects: [
      'a gimballed brass chronometer',
      'a folded sectional chart in a leather sleeve',
      'a spirit-level inclinometer',
      'a waxed-canvas dispatch pouch',
      'a brass hand-crank signal lamp',
      'a set of dividers beside a parallel rule',
      'a cork-stoppered altitude flask',
      'an oil can with a long curved spout',
      'a leather flight helmet resting on its crown',
      'a small anemometer on a turned base',
      'a stack of weather slips under a brass weight',
      'a folding telescope collapsed to a stub',
    ],
  },
  {
    name: 'Quiet Signal Station',
    family: 'science',
    styles: ['minimalist', 'futuristic', 'realistic'],
    architecture: 'a spare listening-station room of poured concrete and pale ply with one recessed instrument wall',
    materials: 'poured concrete, pale ply, anodised aluminium, matte glass',
    palettes: [
      'bone white, cool graphite, signal cyan, pale sand',
      'off-white, slate, muted coral, brushed aluminium',
      'fog grey, ink black, soft mint, warm concrete',
    ],
    moods: [
      'calm, exact, unhurried',
      'alert, spare, quietly focused',
      'remote, patient, faintly lonely',
    ],
    lighting: [
      'even diffuse daylight with almost no shadow',
      'cold overcast light and one small warm task lamp',
      'low dusk light with a single pale instrument glow',
    ],
    apertures: [
      'square glazing panel set flush in the wall with a deep plain reveal',
      'frameless viewing pane with a thick plain concrete sill',
    ],
    views: [
      'a wide tundra plain under a flat white sky',
      'a distant array of dish antennas on a bare ridge',
      'a still lake mirroring an overcast horizon',
      'a snow squall crossing an empty runway',
    ],
    accents: [
      'a single thin painted datum line running the full width of the wall',
      'sparse machined index marks along the aluminium edges',
    ],
    objects: [
      'a matte aluminium desk clock',
      'a spiral-bound log book squared to the edge',
      'a small oscilloscope with a dark screen',
      'a single ceramic cup on a cork coaster',
      'a coiled cable looped over a hook',
      'a pale wooden ruler and one sharpened pencil',
      'a compact anemometer on a flat base',
      'a stack of punched index cards in a tray',
      'a hooded task lamp with a long arm',
      'a sealed sample jar holding grey sand',
      'a folded topographic map, creased square',
      'a mechanical counter with black-and-white drums',
    ],
  },
  {
    name: "Scholars' Monsoon Veranda",
    family: 'history',
    styles: ['watercolour', 'ghibli', 'realistic', 'vintage'],
    architecture: 'a shaded teak veranda study with carved screens and a broad shuttered opening onto the rain',
    materials: 'oiled teak, woven rattan, brass, unglazed terracotta',
    palettes: [
      'monsoon green, teak brown, brass, rain-washed grey',
      'turmeric gold, deep jade, terracotta, wet stone',
      'indigo, palm green, warm sand, oxidised bronze',
    ],
    moods: [
      'warm, steady, rain-soothed',
      'humid, generous, unhurried',
      'sheltered, studious, faintly festive',
    ],
    lighting: [
      'soft grey rain-light with one warm brass lamp',
      'bright break of sun after rain, everything glittering',
      'deep green shade with lamplight catching the wet floor',
    ],
    apertures: [
      'broad shuttered opening with carved teak screens folded back',
      'tall arched veranda arch with a deep whitewashed reveal',
    ],
    views: [
      'heavy monsoon rain falling through banana palms',
      'terraced green fields steaming after a downpour',
      'a courtyard tank brimming and pocked with raindrops',
      'distant hills wrapped in low cloud and wet light',
    ],
    accents: [
      'carved lotus motifs repeated along the screen edges',
      'fine brass inlay tracing the teak joinery',
    ],
    objects: [
      'a brass oil lamp with a curved handle',
      'a stack of palm-leaf manuscript sheets under a stone',
      'a terracotta water cup beading with damp',
      'a folding rosewood book rest',
      'a small pair of brass scales',
      'a lacquered box of coloured inks',
      'a woven rattan document tray',
      'a bronze bell the size of a plum',
      'a bundle of reed pens tied with cord',
      'a shallow dish of cardamom pods',
      'a rain gauge in graduated glass',
      'a folded cotton cloth weighted at one corner',
    ],
  },
  {
    name: 'Orbital Reading Deck',
    family: 'science',
    styles: ['futuristic', 'realistic', 'minimalist'],
    architecture: 'a curved observation deck of white composite panels with a recessed instrument rail beneath the aperture',
    materials: 'white composite, brushed titanium, smoked polycarbonate, grey foam',
    palettes: [
      'vacuum black, instrument cyan, bone white, warning amber',
      'deep navy, cold silver, pale mint, signal magenta',
      'graphite, ice blue, off-white, faint violet',
    ],
    moods: [
      'weightless, clear, quietly awed',
      'precise, calm, faintly solitary',
      'expectant, luminous, orderly',
    ],
    lighting: [
      'cold planetary light from the aperture with soft white fill',
      'low cabin lighting with a single instrument glow',
      'sharp raking sunrise light with deep black shadow',
    ],
    apertures: [
      'wide curved viewing pane set in a deep white composite reveal',
      'circular observation port ringed in brushed titanium',
    ],
    views: [
      'a blue planet limb with the terminator crossing it',
      'a slow ring system edge-on against deep starfield',
      'a moon rising over a banded gas giant',
      'a bright orbital sunrise flaring along the horizon',
    ],
    accents: [
      'thin luminous datum lines tracing the panel seams',
      'small machined registration marks along the rail',
    ],
    objects: [
      'a magnetic-based drinking bulb',
      'a slim tablet docked in a charging cradle',
      'a sealed sample canister with a labelled band',
      'a folded thermal blanket in a taut square',
      'a hand-held star tracker',
      'a titanium multi-tool clipped to a rail',
      'a soft-cover logbook held by an elastic strap',
      'a compact orbital slide rule',
      'a capped stylus in a magnetic holder',
      'a small pressure gauge on a short hose',
      'a tethered pen floating at the end of its cord',
      'a stack of foam-cut instrument trays',
    ],
  },
  {
    name: 'Lantern Market Loft',
    family: 'everyday',
    styles: ['ghibli', 'watercolour', 'vintage', 'realistic'],
    architecture: 'a snug upper-floor loft above a night market, with a low beamed ceiling and a wide shopfront window',
    materials: 'worn floorboards, painted plaster, enamelled tin, warm glass',
    palettes: [
      'lantern red, warm ochre, night blue, aged cream',
      'paper-lantern orange, deep plum, soft jade, smoke grey',
      'honey gold, brick, dusk violet, chalk white',
    ],
    moods: [
      'lively, warm, companionable',
      'late, cosy, gently tired',
      'busy, bright, faintly nostalgic',
    ],
    lighting: [
      'warm lantern glow from below spilling up through the window',
      'mixed street light and one bare bulb over the table',
      'quiet blue dusk with the market lights just coming on',
    ],
    apertures: [
      'wide shopfront window with a broad painted timber sill',
      'tall shuttered casement thrown open above the street',
    ],
    views: [
      'a night market of paper lanterns and steam below',
      'a narrow lane strung with lights between balconies',
      'wet cobbles reflecting a row of red lanterns',
      'rooftops descending toward a lit harbour',
    ],
    accents: [
      'hand-painted shop numerals along the window frame',
      'small enamel tiles set into the sill edge',
    ],
    objects: [
      'a paper lantern resting on its side',
      'an enamelled tin tea caddy',
      'a bamboo brush pot holding three brushes',
      'a small abacus with worn beads',
      'a stack of receipt slips on a spike',
      'a chipped porcelain spoon in a saucer',
      'a folding paper fan half open',
      'a squat brass weight from a market scale',
      'a jar of pickled plums with a cloth lid',
      'a bundle of chopsticks tied with red thread',
      'a hand-cranked coffee grinder',
      'a cloth-bound ledger with a ribbon marker',
    ],
  },
]

/** Injectable so tests can be deterministic instead of flaky. */
export type Rng = () => number

function pick<T>(values: T[], rng: Rng = Math.random): T {
  return values[Math.floor(rng() * values.length)]
}

/** Fisher-Yates, then take the first `count` — guarantees no repeats. */
function pickDistinct(values: string[], count: number, rng: Rng = Math.random): string[] {
  const copy = [...values]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
}

export interface RandomRoomOpts {
  /** Force a style rather than drawing from the theme's allow-list. */
  style?: string
  /** Skip this theme name when choosing. Stops the dice repeating itself. */
  avoid?: string
  rng?: Rng
}

export function randomRoomSpec(theme?: RoomTheme, opts: RandomRoomOpts = {}): RoomSpec {
  const rng = opts.rng ?? Math.random

  // With ten themes the dice lands on the same one about one roll in ten, and
  // that is the case that makes an admin think the button is broken.
  const pool = opts.avoid
    ? ROOM_THEMES.filter(t => t.name !== opts.avoid)
    : ROOM_THEMES
  const t = theme ?? pick(pool.length > 0 ? pool : ROOM_THEMES, rng)

  const objects = pickDistinct(t.objects, 4, rng)
  return {
    name: t.name,
    mood: pick(t.moods, rng),
    palette: pick(t.palettes, rng),
    architecture: t.architecture,
    materials: t.materials,
    lighting: pick(t.lighting, rng),
    outsideView: pick(t.views, rng),
    leftObjects: [objects[0], objects[1]],
    rightObjects: [objects[2], objects[3]],
    accent: pick(t.accents, rng),
    notes: '',
    artStyle: opts.style ?? pick(t.styles, rng),
    aperture: pick(t.apertures, rng),
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
    artStyle: '',
    aperture: '',
  }
}
