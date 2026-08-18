/**
 * Finding the handwriting on a scanned sheet, from the pixels.
 *
 * ── WHY NOT ASK THE MODEL FOR THE BOX ───────────────────────
 * It was asked, and it is bad at it. Vision models identify things reliably
 * and locate them approximately: the boxes it returned began inside the
 * printed problem card — so a crop arrived with the Chinese wording and the
 * tag chips sitting above the student's answer — and ended above the last
 * line of working, cutting the answer off. Both faults at once, on the same
 * page.
 *
 * The boundary does not need a model. The sheet is one this site printed, and
 * its problem card is a warm cream panel on white paper. Cream is not a
 * shade of white, it is a colour: on the card R exceeds B by a wide margin,
 * and on paper they are equal. That difference survives a phone camera, a
 * cheap scanner, and a bad desk lamp, because it is a property of the ink
 * rather than of the exposure. So the card's bottom edge can be found by
 * measuring, and the working is what lies below it.
 *
 * The model keeps the job it is good at: saying which problem a sheet is.
 *
 * Pure functions over raw pixels, so every rule here is testable against an
 * image built to have a known answer.
 */

import type { Box } from './crop'

/** Straight RGBA pixels, as getImageData hands them over. */
export interface Pixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

/**
 * How much warmer than the paper a pixel must be to count as card.
 *
 * Measured against the sheet's own background rather than against an absolute
 * number, because an absolute one does not survive contact with a scanner.
 * The card's background is #F6F0E6, which is R−B = 16 — only two above the
 * fixed threshold this used to carry, so a slightly cool white balance lost
 * the card altogether and the crop swallowed the printed question. Worse the
 * other way: photograph the same sheet under a warm lamp, or scan yellowed
 * paper, and every white pixel clears an absolute threshold, so the whole page
 * reads as card and the boundary lands somewhere in the middle of the working.
 *
 * A difference from the paper survives both. Whatever the light did, it did it
 * to the paper and the card alike.
 */
const WARM_OVER_PAPER = 8

/** Above this a pixel is a light background rather than a mark. */
const LIGHT_FLOOR = 140

/** Below this a pixel is a mark: printed type, pencil, or biro. */
const INK_CEILING = 145

/** A row is part of the card when this much of its width is warm. */
const CARD_ROW_SHARE = 0.35

/** A row holds working when this much of its width is ink. */
const INK_ROW_SHARE = 0.004

/**
 * Ink pixels a column needs before it counts as part of the working.
 *
 * Two, because a pen stroke is thicker than one pixel and a speck of scanner
 * noise is not. One would let a single dark dot in the margin widen the crop
 * to the edge of the page.
 */
const COLUMN_INK_MIN = 2

/** The card is looked for in the top part of the sheet only. */
const CARD_SEARCH_LIMIT = 0.72

/** The footer's URL and page number live in the last of the sheet. */
const FOOTER_ZONE = 0.955

/** Breathing room left around the working, as a fraction of the sheet. */
const MARGIN = 0.012

/**
 * The sheet's own paper colour, as a warmth figure.
 *
 * The low quartile of warmth over light pixels. A quartile rather than the
 * median because a sheet can be more card than paper — a short answer on a
 * printed problem leaves the card occupying most of the page — and the median
 * would then measure the card and call it the baseline. The 25th percentile
 * lands on paper for any sheet that has some.
 */
export function paperWarmth(px: Pixels, step = 8): number {
  const warmths: number[] = []
  for (let y = 0; y < px.height; y += step) {
    for (let x = 0; x < px.width; x += step) {
      const i = (y * px.width + x) * 4
      const r = px.data[i]
      const g = px.data[i + 1]
      const b = px.data[i + 2]
      const luma = (r * 299 + g * 587 + b * 114) / 1000
      if (luma > LIGHT_FLOOR) warmths.push(r - b)
    }
  }
  if (!warmths.length) return 0
  warmths.sort((a, b) => a - b)
  return warmths[Math.floor(warmths.length * 0.25)]
}

export interface RowProfile {
  /** Per row, the share of pixels that are warm and light — card panel. */
  warm: number[]
  /** Per row, the share of pixels dark enough to be a mark. */
  ink: number[]
}

/**
 * One pass over the region, reduced to two numbers per row.
 *
 * Sampled every `step` pixels across: the answer is a share of the width and
 * does not change meaningfully for looking at every fourth pixel, and a full
 * scan of a 2000px page in JavaScript is slow enough to be felt.
 */
export function rowProfile(
  px: Pixels,
  region?: { left: number; right: number },
  step = 4,
  baseWarmth?: number,
): RowProfile {
  const base = baseWarmth ?? paperWarmth(px)
  const left = Math.max(0, region?.left ?? 0)
  const right = Math.min(px.width, region?.right ?? px.width)
  const span = Math.max(1, right - left)

  const warm: number[] = new Array(px.height).fill(0)
  const ink: number[] = new Array(px.height).fill(0)

  for (let y = 0; y < px.height; y++) {
    let warmCount = 0
    let inkCount = 0
    let seen = 0
    for (let x = left; x < right; x += step) {
      const i = (y * px.width + x) * 4
      const r = px.data[i]
      const g = px.data[i + 1]
      const b = px.data[i + 2]
      // Rec. 601 luma, near enough and cheap.
      const luma = (r * 299 + g * 587 + b * 114) / 1000
      if (luma < INK_CEILING) inkCount++
      else if (luma > LIGHT_FLOOR && r - b - base > WARM_OVER_PAPER) warmCount++
      seen++
    }
    warm[y] = seen ? warmCount / seen : 0
    ink[y] = seen ? inkCount / seen : 0
  }

  return { warm, ink }
}

/**
 * The last row of the printed problem card, or null if no card was found.
 *
 * Takes the LAST warm band in the top of the sheet rather than the first.
 * The card is not one solid block of cream: the banner, the two wording
 * panels and the tag row are each warm, separated by paler gaps. Stopping at
 * the first gap put the boundary above the Chinese panel, which is precisely
 * the crop that came back with printed text in it.
 */
export function findCardBottom(profile: RowProfile, height: number): number | null {
  const limit = Math.floor(height * CARD_SEARCH_LIMIT)
  let lastWarm = -1
  for (let y = 0; y < limit; y++) {
    if (profile.warm[y] >= CARD_ROW_SHARE) lastWarm = y
  }
  return lastWarm < 0 ? null : lastWarm
}

/** First and last row of working below the card, or null when the sheet is blank. */
export function findWorkRows(
  profile: RowProfile,
  cardBottom: number | null,
  height: number,
): { top: number; bottom: number } | null {
  const start = cardBottom === null ? 0 : cardBottom + 1
  const end = Math.floor(height * FOOTER_ZONE)

  let top = -1
  let bottom = -1
  for (let y = start; y < end; y++) {
    if (profile.ink[y] >= INK_ROW_SHARE) {
      if (top < 0) top = y
      bottom = y
    }
  }
  return top < 0 ? null : { top, bottom }
}

/** The columns the working actually occupies, so the crop is not all margin. */
export function findWorkColumns(
  px: Pixels,
  rows: { top: number; bottom: number },
  region: { left: number; right: number },
  step = 2,
): { left: number; right: number } {
  let left = -1
  let right = -1
  for (let x = region.left; x < region.right; x += step) {
    let inkInColumn = 0
    /*
      Every row of the band, not every third.

      A line of writing is roughly horizontal, so a column crosses it once,
      over the thickness of the stroke. Sampling every third row turned that
      single crossing into one hit or none — and the test below wants two — so
      a column only counted where two SEPARATE lines happened to overlap in
      it. With five lines of dense working that is most columns and the crop
      looked right; with two short lines it is almost none, and the box
      collapsed to a sliver a few pixels wide with the answer outside it.

      The band is short, so reading every row of it costs little, and it is
      read once per sheet.
    */
    for (let y = rows.top; y <= rows.bottom; y++) {
      const i = (y * px.width + x) * 4
      const luma = (px.data[i] * 299 + px.data[i + 1] * 587 + px.data[i + 2] * 114) / 1000
      if (luma < INK_CEILING) { inkInColumn++; if (inkInColumn >= COLUMN_INK_MIN) break }
    }
    if (inkInColumn >= COLUMN_INK_MIN) {
      if (left < 0) left = x
      right = x
    }
  }
  return left < 0 ? { left: region.left, right: region.right } : { left, right }
}

/**
 * Where the sheets sit on a scan that holds two of them side by side.
 *
 * A two-up scan has a tall column of untouched background down the middle.
 * Looked for only near the centre, because the gaps between words are also
 * empty columns and there is no shortage of them.
 */
export function findGutter(px: Pixels, step = 4): number | null {
  const base = paperWarmth(px)
  const from = Math.floor(px.width * 0.42)
  const to = Math.floor(px.width * 0.58)
  let bestRun = 0
  let bestCentre = -1
  let run = 0

  for (let x = from; x < to; x += step) {
    /*
      A gutter is a column with no SHEET in it, not merely no ink.

      Counting only dark pixels made the card count as empty, so a column
      running straight down the middle of a single printed page looked like a
      gutter whenever the sampling happened to step between lines of writing —
      and splitting there would have cut one problem in half and offered each
      side as a separate answer. Cream counts as content for the same reason it
      is worth detecting elsewhere: it is the sheet.
    */
    let content = 0
    for (let y = 0; y < px.height; y += step) {
      const i = (y * px.width + x) * 4
      const r = px.data[i]
      const g = px.data[i + 1]
      const b = px.data[i + 2]
      const luma = (r * 299 + g * 587 + b * 114) / 1000
      if (luma < INK_CEILING || (luma > LIGHT_FLOOR && r - b - base > WARM_OVER_PAPER)) {
        content++
        if (content > 2) break
      }
    }
    if (content <= 2) {
      run += step
      if (run > bestRun) { bestRun = run; bestCentre = x - run / 2 }
    } else {
      run = 0
    }
  }

  // A real gutter is a wide band. A narrow one is the space between columns
  // of a single sheet, and splitting on it would halve one problem.
  return bestRun >= px.width * 0.04 ? bestCentre : null
}

/**
 * The crop for one sheet, as a normalised box, or null when nothing is written.
 *
 * `half` says which side of a two-up scan to look at, and is the only thing
 * taken from the model — a judgement about which sheet, not about where.
 */
export function detectWorkBox(px: Pixels, half: 'left' | 'right' | 'whole' = 'whole'): Box | null {
  let region = { left: 0, right: px.width }

  if (half !== 'whole') {
    const gutter = findGutter(px)
    if (gutter !== null) {
      region = half === 'left'
        ? { left: 0, right: Math.round(gutter) }
        : { left: Math.round(gutter), right: px.width }
    }
  }

  // Measured once for the whole image, so the two halves of a two-up scan
  // are judged against the same paper rather than each against its own.
  const profile = rowProfile(px, region, 4, paperWarmth(px))
  const cardBottom = findCardBottom(profile, px.height)
  const rows = findWorkRows(profile, cardBottom, px.height)
  if (!rows) return null

  const cols = findWorkColumns(px, rows, region)

  const pad = MARGIN
  const x = Math.max(0, cols.left / px.width - pad)
  const y = Math.max(0, rows.top / px.height - pad)
  const right = Math.min(1, cols.right / px.width + pad)
  const bottom = Math.min(1, rows.bottom / px.height + pad)

  return { x, y, w: right - x, h: bottom - y }
}
