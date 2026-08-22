/**
 * The paper a problem set is printed on.
 *
 * ── WHY THIS IS NOT JUST A COSMETIC SETTING ─────────────────
 * "Fit each problem to one page" measures the sheet against the height of a
 * page, so it has to know which page. When the CSS says A4 and the tray holds
 * US Letter, the browser rescales the whole document to make it fit the paper
 * — Letter is 18mm shorter than A4 — and every measurement taken before that
 * is off by the same amount. A problem shrunk to exactly one A4 page comes out
 * of a Letter printer at 94% with a margin of empty paper below it, and one
 * that just fitted spills a line onto a second sheet.
 *
 * Naming the paper in `@page size` makes the browser select it in the print
 * dialog instead of guessing, so nothing is rescaled behind the measurement.
 *
 * Dimensions are the ISO and ANSI definitions in millimetres; the imperial
 * ones are exact inch values converted at 25.4.
 */

import type { TranslationKey } from '@/lib/i18n/catalog'

export interface PaperSize {
  /** What `@page { size: … }` is given. Must be a CSS page-size keyword. */
  css: string
  widthMm: number
  heightMm: number
  /** Message key for the name shown in the dropdown. */
  label: TranslationKey
}

/** The margin every printed set uses, in millimetres. */
export const PAGE_MARGIN_MM = 10

export const PAPER_SIZES = {
  a4: { css: 'A4', widthMm: 210, heightMm: 297, label: 'pset.paperA4' },
  letter: { css: 'Letter', widthMm: 215.9, heightMm: 279.4, label: 'pset.paperLetter' },
  legal: { css: 'Legal', widthMm: 215.9, heightMm: 355.6, label: 'pset.paperLegal' },
  a5: { css: 'A5', widthMm: 148, heightMm: 210, label: 'pset.paperA5' },
} satisfies Record<string, PaperSize>

export type PaperId = keyof typeof PAPER_SIZES

export const PAPER_IDS = Object.keys(PAPER_SIZES) as PaperId[]

export function isPaperId(value: unknown): value is PaperId {
  return typeof value === 'string' && value in PAPER_SIZES
}

/** CSS reference pixels per millimetre, at the 96dpi the browser prints at. */
const PX_PER_MM = 96 / 25.4

/** The printable height of a page, in CSS pixels — what a sheet must fit in. */
export function pageContentPx(paper: PaperId): number {
  return Math.round((PAPER_SIZES[paper].heightMm - 2 * PAGE_MARGIN_MM) * PX_PER_MM)
}

/**
 * The paper this reader most likely has in the tray.
 *
 * Letter is standard across North America and the Philippines; the rest of the
 * world uses A4. Defaulting to the wrong one is not a cosmetic mistake here —
 * it is the miscalculation described at the top of this file, silently, on the
 * teacher's first print. The dropdown overrides it and the choice is
 * remembered, so this only has to be right often enough to save a step.
 */
const LETTER_REGIONS = new Set(['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'PR'])

export function defaultPaper(): PaperId {
  if (typeof navigator === 'undefined') return 'a4'
  for (const locale of navigator.languages ?? [navigator.language]) {
    // "en-US" → US. Intl.Locale also resolves "en-Latn-US" and likely regions.
    let region: string | undefined
    try {
      region = new Intl.Locale(locale).maximize().region
    } catch {
      region = locale?.split('-')[1]
    }
    if (region) return LETTER_REGIONS.has(region.toUpperCase()) ? 'letter' : 'a4'
  }
  return 'a4'
}

const STORAGE_KEY = 'henry.problemSet.paper'

/** A teacher's printer does not change between one set and the next. */
export function readStoredPaper(): PaperId {
  if (typeof window === 'undefined') return 'a4'
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (isPaperId(saved)) return saved
  } catch {
    // Private browsing and blocked storage both throw; the default is fine.
  }
  return defaultPaper()
}

export function storePaper(paper: PaperId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, paper)
  } catch {
    // Not being able to remember the choice is not worth an error.
  }
}
