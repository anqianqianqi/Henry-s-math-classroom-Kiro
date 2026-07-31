/**
 * Book theme presets for the cover + inner-page bundle designer.
 *
 * Each theme carries a cluster pool; randomBookSpec() deals four distinct
 * clusters into the corners, so repeated rolls of the same theme still produce
 * different covers.
 */

import type { BookSpec } from '@/lib/types/challengeRoom'

interface BookTheme {
  name: string
  mood: string
  palette: string
  paper: string
  frame: string
  clusters: string[]
}

export const BOOK_THEMES: BookTheme[] = [
  {
    name: 'Pastel Meadow Tales',
    mood: 'tender, cheerful, nostalgic',
    palette: 'warm ivory, blush pink, strawberry red, meadow green, soft cornflower blue',
    paper: 'warm ivory watercolor paper with gentle handmade grain',
    frame: 'thin antique-gold botanical filigree',
    clusters: [
      'a tabby cat with a yarn ball and a small open book',
      'strawberries with a polka-dot teacup and one biscuit',
      'a ladybug on an oak leaf with an acorn cap and berries',
      'a four-leaf clover with dewdrops and a small golden beetle',
      'a sleepy rabbit beside lavender and a tiny envelope',
      'blueberries with a gingham mug and a butter cookie',
      'a robin perched on a flowering apple twig',
      'a daisy wreath with a honeybee and a tiny brass key',
    ],
  },
  {
    name: 'Moon Garden Almanac',
    mood: 'dreamy, quiet, luminous',
    palette: 'parchment, moonstone blue, dusty lavender, muted sage, pale gold',
    paper: 'soft moon-ivory watercolor paper with visible cold-press grain',
    frame: 'fine pale-gold vines with tiny stars and crescent details',
    clusters: [
      'a silver moth with jasmine blossoms and three tiny stars',
      'a sleeping fox curled around a crescent moon charm',
      'lavender sprigs with a pearl compass and a blue ribbon',
      'a white hare beside moonflowers and a glass dewdrop',
      'a little owl with a closed letter and a wax seal',
      'wild blueberries beneath a constellation beetle',
    ],
  },
  {
    name: 'Woodland Picnic Journal',
    mood: 'cozy, playful, homespun',
    palette: 'oat cream, moss green, russet, berry red, honey gold',
    paper: 'creamy fibrous watercolor paper with subtle deckled texture',
    frame: 'narrow antique-gold oak-leaf and berry border',
    clusters: [
      'a red squirrel with hazelnuts and a tiny checked napkin',
      'blackberries with an enamel teacup and a shortbread biscuit',
      'a hedgehog beside mushrooms and a curled fern',
      'an acorn lantern with clover and a ladybug',
      'a field mouse carrying a strawberry and a wooden spoon',
      'a robin with rosehips and a tiny picnic basket',
    ],
  },
  {
    name: 'Seaside Keepsake Book',
    mood: 'fresh, gentle, sunlit',
    palette: 'shell ivory, sea-glass aqua, coral pink, sand, soft brass',
    paper: 'sun-warmed ivory watercolor stock with a fine salt-paper grain',
    frame: 'slender antique-gold seaweed filigree',
    clusters: [
      'a tiny sailboat with a striped flag and two shells',
      'a curious seal with sea lavender and a glass float',
      'strawberries beside a blue enamel cup and a shell biscuit',
      'a sand dollar with coral sprigs and a golden crab',
      'a puffin beside a folded map and a little compass',
      'a pearl oyster with sea grass and three bubbles',
    ],
  },
  {
    name: 'Little Celestial Herbarium',
    mood: 'curious, refined, magical',
    palette: 'vellum cream, indigo, sage, plum, antique gold',
    paper: 'warm vellum-toned watercolor paper with restrained botanical grain',
    frame: 'precise antique-gold botanical linework dotted with tiny constellations',
    clusters: [
      'a violet pansy with a miniature brass telescope',
      'a tabby kitten holding a star chart beside a ribbon spool',
      'figs and rosemary with a dotted porcelain teacup',
      'a luna moth on an oak leaf with an acorn and berries',
      'a four-leaf clover with dewdrops and a constellation beetle',
      'a poppy seed head with a tiny moon compass',
    ],
  },
]

function pick<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)]
}

/** Fisher-Yates then take `count` — guarantees four different clusters. */
function pickDistinct(values: string[], count: number): string[] {
  const copy = [...values]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
}

export function randomBookSpec(theme?: BookTheme): BookSpec {
  const t = theme ?? pick(BOOK_THEMES)
  const c = pickDistinct(t.clusters, 4)
  return {
    name: t.name,
    mood: t.mood,
    palette: t.palette,
    paper: t.paper,
    frame: t.frame,
    cornerClusters: [c[0], c[1], c[2], c[3]],
    notes: '',
  }
}
