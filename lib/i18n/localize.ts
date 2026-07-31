/**
 * Reading side of stored translations. Client-safe — no server-only import, no
 * API key — so components can pick the right rendering directly.
 *
 * Writing lives in lib/i18n/translateUserText.ts, which is server-only.
 */

import type { Language } from './catalog'

/**
 * Pick the rendering matching the reader.
 *
 * Falls back to the original whenever the wanted language is missing or empty,
 * which covers posts made before translation existed, posts where the API call
 * failed, and pure-math posts that were never sent. A reader always sees
 * something the author actually wrote.
 */
export function pickTranslation(
  original: string,
  en: string | null | undefined,
  zh: string | null | undefined,
  language: Language,
): string {
  const chosen = language === 'zh' ? zh : en
  return chosen?.trim() ? chosen : original
}

/** Shapes carrying a translated body, and optionally a translated title. */
export interface TranslatableText {
  text: string
  text_en?: string | null
  text_zh?: string | null
  title?: string | null
  title_en?: string | null
  title_zh?: string | null
}

/**
 * Both fields of a bubble question at once.
 *
 * Returned as a new object rather than mutated in place: search and duplicate
 * detection run against the ORIGINAL text, so overwriting it would silently
 * change which questions match.
 */
export function localizeQuestion<T extends TranslatableText>(
  item: T,
  language: Language,
): { title: string | null; text: string } {
  return {
    title: item.title
      ? pickTranslation(item.title, item.title_en, item.title_zh, language)
      : null,
    text: pickTranslation(item.text, item.text_en, item.text_zh, language),
  }
}
