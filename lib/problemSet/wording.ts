/**
 * Which wording a printed problem carries.
 *
 * A .henryproblem snapshot keeps the two languages in separate fields, so a
 * set can be printed in one of them — an English-speaking substitute teacher
 * gets a sheet with no Chinese on it, and a Chinese-only handout stops wasting
 * half the page. Dropping a field is all it takes: HenryProblemSheet renders a
 * wording panel only when that field has text, and falls back from its
 * side-by-side graph layout to a single full-width panel on its own.
 *
 * ── WHAT THIS CANNOT DO ─────────────────────────────────────
 * A problem that was not imported from a .henryproblem has one `description`
 * with whatever the teacher typed in it. There is no marked boundary between
 * an English sentence and its translation, so there is nothing to drop, and
 * guessing by script range would cut a Chinese problem in half at its first
 * bit of algebra. Those print unchanged whatever is chosen here, and the
 * window says how many of them are in the range.
 */

import type { HenryProblemFields } from '@/lib/henryproblem'

export type PrintLanguage = 'both' | 'en' | 'zh'

/** Read the URL parameter, defaulting to the both-languages worksheet. */
export function parsePrintLanguage(value: string | null | undefined): PrintLanguage {
  return value === 'en' || value === 'zh' ? value : 'both'
}

/**
 * The problem as it should print.
 *
 * A problem written in only one language keeps it even when the other was
 * asked for. Honouring the request literally would print a sheet with a title,
 * a graph and no question on it — the teacher would rather have the wording
 * they have than a blank.
 */
export function wordingFor(problem: HenryProblemFields, lang: PrintLanguage): HenryProblemFields {
  if (lang === 'both') return problem

  const english = problem.english.trim()
  const chinese = problem.chinese.trim()
  // Nothing to choose between.
  if (!english || !chinese) return problem

  return lang === 'en'
    ? { ...problem, chinese: '' }
    : { ...problem, english: '' }
}
