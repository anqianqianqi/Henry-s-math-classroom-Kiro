/**
 * Book theme presets for the ChallengeRoom book bundles.
 *
 * Reshaped for the same reason as themes.ts: mood, palette, paper and frame
 * used to be one fixed string each, so five themes meant five books. They are
 * now small interchangeable lists per theme — coherent by construction, because
 * every pairing is one a person wrote down together.
 *
 * ── PAPER AND FRAME ARE REAL NOW ────────────────────────────
 * These two fields used to be stated in the prompt and then overridden three
 * lines later by a hard-coded "warm-ivory bleed" and "antique-gold botanical
 * frame". That is gone (see bookPrompt.ts), which is what lets a theme here be
 * something other than cream paper with gold filigree — and why the sci-fi and
 * indigo worlds below can exist at all.
 *
 * randomBookSpec() deals four distinct clusters into the corners.
 */

import type { BookSpec } from '@/lib/types/challengeRoom'
import type { ThemeFamily, Rng } from './themes'

export interface BookTheme {
  name: string
  family: ThemeFamily
  /** ART_STYLES ids this collection can carry. Books tolerate all six. */
  styles: string[]
  palettes: string[]
  moods: string[]
  papers: string[]
  frames: string[]
  /** Sparse motif edging the inner page — must stay quiet, text prints there. */
  innerAccents: string[]
  /** Corner vignettes; four are dealt per roll. Keep well above four. */
  clusters: string[]
}

export const BOOK_THEMES: BookTheme[] = [
  {
    name: 'Pastel Meadow Tales',
    family: 'nature',
    styles: ['watercolour', 'ghibli', 'vintage'],
    palettes: [
      'warm ivory, blush pink, strawberry red, meadow green, soft cornflower blue',
      'cream, buttermilk, clover pink, new-leaf green, pale sky',
      'oat, apricot, poppy red, sage, chalk blue',
    ],
    moods: [
      'tender, cheerful, nostalgic',
      'sunlit, playful, easy',
      'gentle, hopeful, a little sleepy',
    ],
    papers: [
      'warm ivory watercolor paper with gentle handmade grain',
      'soft cream cold-press stock with a fine tooth',
      'pale oat paper with a faint deckled texture',
    ],
    frames: [
      'thin antique-gold botanical filigree',
      'slender pressed-flower border in soft green ink',
      'fine hand-drawn rule with tiny clover leaves at the corners',
    ],
    innerAccents: [
      'a few meadow stems, two clover leaves and one pinhead blossom',
      'a scatter of grass seed heads and a single ladybird',
    ],
    clusters: [
      'a tabby cat with a yarn ball and a small open book',
      'strawberries with a polka-dot teacup and one biscuit',
      'a ladybug on an oak leaf with an acorn cap and berries',
      'a four-leaf clover with dewdrops and a small golden beetle',
      'a sleepy rabbit beside lavender and a tiny envelope',
      'blueberries with a gingham mug and a butter cookie',
      'a robin perched on a flowering apple twig',
      'a daisy wreath with a honeybee and a tiny brass key',
      'a snail on a fern frond beside two rosehips',
      'a jar of wildflowers with a folded paper note',
      'a wren with a length of ribbon and three seeds',
      'a slice of honeycomb with a sprig of thyme',
    ],
  },
  {
    name: 'Moon Garden Almanac',
    family: 'fantasy',
    styles: ['watercolour', 'ghibli', 'vintage', 'minimalist'],
    palettes: [
      'parchment, moonstone blue, dusty lavender, muted sage, pale gold',
      'bone, periwinkle, soft plum, grey-green, silver',
      'oyster, midnight blue, pale iris, dove grey, warm gold',
    ],
    moods: [
      'dreamy, quiet, luminous',
      'still, secretive, softly lit',
      'wistful, clear, faintly enchanted',
    ],
    papers: [
      'soft moon-ivory watercolor paper with visible cold-press grain',
      'cool bone laid paper with a fine chain-line grain',
      'pale grey-blue stock with a smooth chalky surface',
    ],
    frames: [
      'fine pale-gold vines with tiny stars and crescent details',
      'slender silver rule dotted with pinhead constellations',
      'thin indigo linework of night-blooming stems',
    ],
    innerAccents: [
      'two jasmine sprigs and a scatter of pinhead stars',
      'a single crescent motif with three fine grass stems',
    ],
    clusters: [
      'a silver moth with jasmine blossoms and three tiny stars',
      'a sleeping fox curled around a crescent moon charm',
      'lavender sprigs with a pearl compass and a blue ribbon',
      'a white hare beside moonflowers and a glass dewdrop',
      'a little owl with a closed letter and a wax seal',
      'wild blueberries beneath a constellation beetle',
      'a night-blooming cereus with a small silver key',
      'a firefly jar beside two folded paper stars',
      'a pale mushroom ring with one dropped feather',
      'a hedgehog asleep under a thimble of moonlight',
      'a sprig of rosemary with a hanging crescent pendant',
      'a glass phial of starlight with a cork stopper',
    ],
  },
  {
    name: 'Woodland Picnic Journal',
    family: 'nature',
    styles: ['watercolour', 'ghibli', 'vintage', 'realistic'],
    palettes: [
      'oat cream, moss green, russet, berry red, honey gold',
      'birch white, fern, chestnut, rosehip, amber',
      'linen, olive, terracotta, plum, warm brass',
    ],
    moods: [
      'cozy, playful, homespun',
      'brisk, cheerful, out-of-doors',
      'warm, unhurried, well-fed',
    ],
    papers: [
      'creamy fibrous watercolor paper with subtle deckled texture',
      'warm oat stock with visible flecks of pulp',
      'soft buff paper with a light woven grain',
    ],
    frames: [
      'narrow antique-gold oak-leaf and berry border',
      'thin russet rule with small acorn corner marks',
      'fine green linework of bramble and fern',
    ],
    innerAccents: [
      'two fern fronds and a scatter of small berries',
      'a single oak twig with one acorn and a curl of moss',
    ],
    clusters: [
      'a red squirrel with hazelnuts and a tiny checked napkin',
      'blackberries with an enamel teacup and a shortbread biscuit',
      'a hedgehog beside mushrooms and a curled fern',
      'an acorn lantern with clover and a ladybug',
      'a field mouse carrying a strawberry and a wooden spoon',
      'a robin with rosehips and a tiny picnic basket',
      'a wedge of cheese with two walnuts and a sprig of thyme',
      'a badger cub asleep against a rolled blanket',
      'a stack of three pancakes with a jug of syrup',
      'a woven basket spilling apples and one pear',
      'a kettle on a small folding stove',
      'a jay feather laid across a folded map',
    ],
  },
  {
    name: 'Seaside Keepsake Book',
    family: 'nature',
    styles: ['watercolour', 'ghibli', 'vintage', 'minimalist'],
    palettes: [
      'shell ivory, sea-glass aqua, coral pink, sand, soft brass',
      'salt white, storm slate, kelp olive, cold rose, pewter',
      'wet-sand beige, sea-holly blue, bleached bone, weathered copper',
    ],
    moods: [
      'fresh, gentle, sunlit',
      'brisk, bright, methodical',
      'grey-day, tender, unhurried',
    ],
    papers: [
      'sun-warmed ivory watercolor stock with a fine salt-paper grain',
      'salt-flecked cream paper with a coarse cold-press tooth',
      'cool bone stock with faint tide-line staining',
    ],
    frames: [
      'slender antique-gold seaweed filigree',
      'narrow pewter rope-twist border',
      'thin bleached-driftwood rule with tiny knot marks',
    ],
    innerAccents: [
      'a few dune grasses, one small shell and scattered sand grains',
      'sparse kelp fronds and two pinhead barnacles',
    ],
    clusters: [
      'a tiny sailboat with a striped flag and two shells',
      'a curious seal with sea lavender and a glass float',
      'strawberries beside a blue enamel cup and a shell biscuit',
      'a sand dollar with coral sprigs and a golden crab',
      'a puffin beside a folded map and a little compass',
      'a pearl oyster with sea grass and three bubbles',
      'a curled razor shell with sea holly and one glass float',
      'an oystercatcher beside a knotted rope end and three pebbles',
      'a lighthouse the size of a thimble with two gulls',
      'a rock pool with an anemone and a small starfish',
      'a message bottle half buried in sand',
      'a crab line wound on a wooden reel with a bucket',
    ],
  },
  {
    name: 'Little Celestial Herbarium',
    family: 'science',
    styles: ['watercolour', 'vintage', 'ghibli', 'realistic'],
    palettes: [
      'vellum cream, indigo, sage, plum, antique gold',
      'parchment, deep navy, olive, wine, tarnished brass',
      'warm bone, ink blue, grey-green, damson, pale gilt',
    ],
    moods: [
      'curious, refined, magical',
      'precise, quiet, faintly reverent',
      'studious, warm, orderly',
    ],
    papers: [
      'warm vellum-toned watercolor paper with restrained botanical grain',
      'smooth parchment stock with a faint mottled tone',
      'pale bone paper with fine visible laid lines',
    ],
    frames: [
      'precise antique-gold botanical linework dotted with tiny constellations',
      'fine indigo rule with small engraved star points',
      'slender brass border of pressed stems and seed heads',
    ],
    innerAccents: [
      'two pressed stems and a scatter of tiny star points',
      'a single seed head with three fine constellation dots',
    ],
    clusters: [
      'a violet pansy with a miniature brass telescope',
      'a tabby kitten holding a star chart beside a ribbon spool',
      'figs and rosemary with a dotted porcelain teacup',
      'a luna moth on an oak leaf with an acorn and berries',
      'a four-leaf clover with dewdrops and a constellation beetle',
      'a poppy seed head with a tiny moon compass',
      'a fern specimen pinned beside a handwritten label',
      'a magnifying lens resting on a pressed violet',
      'a brass orrery the size of a walnut with two sprigs',
      'a glass phial of seeds beside a folded star map',
      'a dried thistle head with a small sextant',
      'a bee specimen card with a pair of fine tweezers',
    ],
  },

  // ── New collections ───────────────────────────────────────────────────────
  // These are the ones the old prompt physically could not produce: it forced
  // ivory paper, an antique-gold botanical frame and watercolour on everything,
  // so a dark, a modern or a bold collection was impossible however the theme
  // was written.

  {
    name: 'Orbital Survey Ledger',
    family: 'science',
    styles: ['futuristic', 'minimalist', 'realistic'],
    palettes: [
      'vacuum black, instrument cyan, bone white, warning amber',
      'deep navy, cold silver, pale mint, signal magenta',
      'graphite, ice blue, off-white, faint violet',
    ],
    moods: [
      'exact, weightless, quietly awed',
      'clinical, clear, unhurried',
      'remote, luminous, orderly',
    ],
    papers: [
      'smooth matte composite sheet with a faint hexagonal weave',
      'cool bone-white synthetic stock with a barely-visible grid emboss',
      'soft charcoal panel with a fine brushed-metal sheen',
    ],
    frames: [
      'hairline cyan circuit-trace border with small node dots',
      'thin brushed-aluminium rule with machined corner ticks',
      'fine luminous white keyline with faint dashed registration marks',
    ],
    innerAccents: [
      'two faint orbital arcs and a scatter of pinhead stars',
      'a single dashed trajectory line with three small nodes',
    ],
    clusters: [
      'a ringed planet with two small moons and a dotted orbit',
      'a folded solar sail beside a sealed sample vial',
      'a comet head with a fine dust tail and three stars',
      'a hexagonal instrument dial with a cyan readout',
      'a tethered probe with a coiled cable and a beacon light',
      'a lunar core sample tube beside a set of callipers',
      'a star tracker lens with a faint reticle overlay',
      'an ice crystal specimen in a sealed cube',
      'a docking clamp with two indicator lamps',
      'a folded thermal blanket with a numbered tag',
      'a small drone with folded rotors and a charge port',
      'a magnetic pen floating beside a slim tablet',
    ],
  },
  {
    name: 'Ink and Lantern Chapbook',
    family: 'history',
    styles: ['vintage', 'ghibli', 'watercolour', 'minimalist'],
    palettes: [
      'lantern red, ink black, aged bamboo, warm gold',
      'persimmon, deep charcoal, tea green, ivory',
      'cinnabar, indigo, straw, antique brass',
    ],
    moods: [
      'lively, warm, companionable',
      'quiet, disciplined, faintly festive',
      'late, unhurried, softly lit',
    ],
    papers: [
      'warm bamboo paper with a visible long-fibre grain',
      'aged tea-toned stock with soft mottling',
      'pale straw paper with a fine ribbed texture',
    ],
    frames: [
      'thin cinnabar rule with small square corner seals',
      'fine ink border of bamboo leaves and knots',
      'slender gold key-fret border with plain corners',
    ],
    innerAccents: [
      'two bamboo leaves and a single small red seal mark',
      'a sparse spray of plum blossom with three ink dots',
    ],
    clusters: [
      'a brush rest with two brushes and a small ink stone',
      'a paper lantern with a tassel and one moth',
      'a plum branch in bloom beside a folded fan',
      'a teapot with two cups and a sprig of jasmine',
      'a carved seal with a dish of cinnabar paste',
      'a bamboo stem with a dragonfly and a curled leaf',
      'a stack of thread-bound booklets tied with cord',
      'a persimmon and two chestnuts on a cloth',
      'a crane in flight above three small waves',
      'an abacus with a worn wooden frame',
      'a lotus pod beside a folded paper boat',
      'a caged cricket with a single grass blade',
    ],
  },
  {
    name: 'Bold Geometry Primer',
    family: 'everyday',
    styles: ['minimalist', 'futuristic', 'vintage'],
    palettes: [
      'chalk white, cobalt, signal red, warm black',
      'bone, mustard, teal, charcoal',
      'off-white, terracotta, navy, soft grey',
    ],
    moods: [
      'crisp, confident, playful',
      'orderly, bright, matter-of-fact',
      'bold, calm, faintly retro',
    ],
    papers: [
      'flat chalk-white stock with no visible grain',
      'smooth bone card with a very fine matte tooth',
      'warm off-white board with a soft even surface',
    ],
    frames: [
      'a single bold rule in flat cobalt with square corners',
      'two thin parallel lines in warm black, evenly spaced',
      'a plain terracotta keyline with small notched corners',
    ],
    innerAccents: [
      'three small flat circles set in a loose triangle',
      'two short parallel rules and a single filled square',
    ],
    clusters: [
      'a set of nested circles in flat cobalt and red',
      'three stacked triangles in mustard and charcoal',
      'a pair of compasses drawn as flat shapes',
      'a folded paper crane reduced to five flat planes',
      'a stack of coloured blocks in strict alignment',
      'a protractor arc with two straight rules',
      'a simple flat leaf made of two curved shapes',
      'a cup and saucer drawn as concentric ovals',
      'a flat sun with eight even rays',
      'a spiral of five diminishing squares',
      'a paper aeroplane in two tones',
      'a die showing three pips, drawn flat',
    ],
  },
]

function pick<T>(values: T[], rng: Rng = Math.random): T {
  return values[Math.floor(rng() * values.length)]
}

/** Fisher-Yates then take `count` — guarantees four different clusters. */
function pickDistinct(values: string[], count: number, rng: Rng = Math.random): string[] {
  const copy = [...values]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
}

export interface RandomBookOpts {
  style?: string
  /** Skip this theme name. Stops the dice repeating itself. */
  avoid?: string
  rng?: Rng
}

export function randomBookSpec(theme?: BookTheme, opts: RandomBookOpts = {}): BookSpec {
  const rng = opts.rng ?? Math.random

  const pool = opts.avoid
    ? BOOK_THEMES.filter(t => t.name !== opts.avoid)
    : BOOK_THEMES
  const t = theme ?? pick(pool.length > 0 ? pool : BOOK_THEMES, rng)

  const c = pickDistinct(t.clusters, 4, rng)
  return {
    name: t.name,
    mood: pick(t.moods, rng),
    palette: pick(t.palettes, rng),
    paper: pick(t.papers, rng),
    frame: pick(t.frames, rng),
    cornerClusters: [c[0], c[1], c[2], c[3]],
    notes: '',
    artStyle: opts.style ?? pick(t.styles, rng),
    innerAccent: pick(t.innerAccents, rng),
  }
}
