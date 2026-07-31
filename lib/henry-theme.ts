/**
 * Visual theme for the Henry Math worksheet sheet.
 *
 * Everything the sheet draws — palette, header ornaments, rules — lives here
 * as data so the look can be changed without touching component markup. Swap
 * `defaultHenryTheme` for another HenrySheetTheme, or pass one to
 * <HenryProblemSheet theme={...} />.
 *
 * Geometry is intentionally unit-free: ornament positions are percentages of
 * the header strip, and sizes are percentages of its height. That keeps the
 * whole decoration set scaling with the sheet's root font-size, including
 * inside the enlarge overlay.
 *
 * The default theme mirrors draw_header_strip() in the Prettify Homework
 * workspace (tools/homework_prettifier.py), so the web sheet and the generated
 * JPEG read as the same design.
 */

export interface HenryPalette {
  /** Warm cream page background. */
  paper: string
  /** Writing surfaces and the header strip. */
  card: string
  /** Main Henry green — headings and the rule under the header. */
  green: string
  /** Spark orange accent. */
  orange: string
  /** Sunny yellow highlighter. */
  yellow: string
  /** Soft mint accent. */
  mint: string
  /** Rose pink accent. */
  rose: string
  /** Thinking blue accent. */
  blue: string
  /** Body text. */
  ink: string
  /** Secondary labels. */
  muted: string
  /** Soft border. */
  border: string
}

/** A horizontal highlighter swipe. */
export interface BarOrnament {
  kind: 'bar'
  /** Left edge, % of strip width. */
  x: number
  /** Top edge, % of strip height. */
  y: number
  /** % of strip width. */
  w: number
  /** % of strip height. */
  h: number
  color: keyof HenryPalette
  opacity?: number
}

/** A filled circle. */
export interface DotOrnament {
  kind: 'dot'
  /** Centre, % of strip width / height. */
  x: number
  y: number
  /** Diameter, % of strip height. */
  size: number
  color: keyof HenryPalette
  opacity?: number
}

/** A plus-shaped sparkle, as drawn by draw_sparkle(). */
export interface SparkleOrnament {
  kind: 'sparkle'
  x: number
  y: number
  /** Full width/height, % of strip height. */
  size: number
  color: keyof HenryPalette
  opacity?: number
}

export type HeaderOrnament = BarOrnament | DotOrnament | SparkleOrnament

export interface HenryHeaderTheme {
  /** Height of the strip, in em relative to the sheet root font-size. */
  height: string
  /** Corner radius, in em. */
  radius: string
  /** Orange cap down the left edge, % of strip width. */
  accentWidth: number
  accentColor: keyof HenryPalette
  /** Drawn in order, behind the title text. */
  ornaments: HeaderOrnament[]
  logo: {
    src: string
    /** Diameter, in em. */
    size: string
    /** How far the logo laps over the strip's right edge, in em. */
    overlap: string
  } | null
  /** Green rule under the strip. */
  rule: { color: keyof HenryPalette; thickness: string } | null
}

export interface HenrySheetTheme {
  palette: HenryPalette
  header: HenryHeaderTheme
}

export const henryPalette: HenryPalette = {
  paper: '#F6F0E6',
  card: '#FFFDF8',
  green: '#495F42',
  orange: '#E69542',
  yellow: '#F8D978',
  mint: '#DDEAD7',
  rose: '#F4C4B5',
  blue: '#7F98C6',
  ink: '#2F332B',
  muted: '#6F706A',
  border: '#DDD4C7',
}

/**
 * Ornament coordinates converted from the PDF's 632x66pt header strip.
 * e.g. the rose dot at (532, 891) on a strip spanning x 42-674, y 842-908
 * becomes x (532-42)/632 = 77.5%, y (908-891)/66 = 25.8%.
 */
const defaultOrnaments: HeaderOrnament[] = [
  // Highlighter swipe behind the title
  { kind: 'bar', x: 10.1, y: 69.7, w: 71.5, h: 15.2, color: 'yellow', opacity: 0.38 },
  // Mint stripe above the title
  { kind: 'bar', x: 19.0, y: 9.1, w: 36.4, h: 10.6, color: 'mint', opacity: 0.65 },

  // Two columns of cream dots punched out of the orange cap
  { kind: 'dot', x: 3.16, y: 15.2, size: 6.4, color: 'card', opacity: 0.5 },
  { kind: 'dot', x: 3.16, y: 36.4, size: 6.4, color: 'card', opacity: 0.5 },
  { kind: 'dot', x: 3.16, y: 57.6, size: 6.4, color: 'card', opacity: 0.5 },
  { kind: 'dot', x: 3.16, y: 78.8, size: 6.4, color: 'card', opacity: 0.5 },
  { kind: 'dot', x: 5.85, y: 22.7, size: 4.8, color: 'card', opacity: 0.5 },
  { kind: 'dot', x: 5.85, y: 43.9, size: 4.8, color: 'card', opacity: 0.5 },
  { kind: 'dot', x: 5.85, y: 65.2, size: 4.8, color: 'card', opacity: 0.5 },
  { kind: 'dot', x: 5.85, y: 86.4, size: 4.8, color: 'card', opacity: 0.5 },

  // Confetti to the left of the logo
  { kind: 'dot', x: 77.5, y: 25.8, size: 13.0, color: 'rose', opacity: 0.7 },
  { kind: 'dot', x: 80.7, y: 65.2, size: 11.5, color: 'blue', opacity: 0.52 },
  { kind: 'sparkle', x: 75.6, y: 71.2, size: 12.7, color: 'orange' },
  { kind: 'sparkle', x: 83.5, y: 22.7, size: 10.9, color: 'blue' },
]

export const defaultHenryTheme: HenrySheetTheme = {
  palette: henryPalette,
  header: {
    height: '2.9em',
    radius: '0.8em',
    accentWidth: 6.3,
    accentColor: 'orange',
    ornaments: defaultOrnaments,
    logo: { src: '/henry-math-logo.png', size: '2.6em', overlap: '0.9em' },
    rule: { color: 'green', thickness: '0.12em' },
  },
}

/** A stripped-back theme: no confetti, no logo. Useful in dense lists. */
export const plainHenryTheme: HenrySheetTheme = {
  palette: henryPalette,
  header: {
    ...defaultHenryTheme.header,
    height: '2.2em',
    ornaments: defaultOrnaments.filter(o => o.kind === 'bar'),
    logo: { src: '/henry-math-logo.png', size: '2em', overlap: '0.6em' },
    rule: { color: 'green', thickness: '0.1em' },
  },
}

/**
 * For the 3D challenge room: the worksheet sits directly on the book's own
 * page art, so it must not paint a page of its own. Paper and card go fully
 * transparent and the borders soften to ink-on-paper rules, leaving the
 * botanical inner-page texture showing through behind the wording.
 *
 * Text colours are untouched — the page art is a warm cream, the same surface
 * the palette's ink was chosen against.
 */
export const pageNativeHenryTheme: HenrySheetTheme = {
  palette: {
    ...henryPalette,
    paper: 'transparent',
    card: 'transparent',
    border: 'rgba(100,60,10,0.22)',
  },
  header: {
    ...defaultHenryTheme.header,
    // The header strip is the one surface that keeps a fill: it is the
    // worksheet's identity and reads as a printed banner, not a floating card.
  },
}

/** Resolve a palette key plus optional opacity to a CSS colour. */
export function themeColor(
  palette: HenryPalette,
  key: keyof HenryPalette,
  opacity?: number
): string {
  const hex = palette[key]
  if (opacity == null || opacity >= 1) return hex
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
