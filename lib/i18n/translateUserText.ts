import 'server-only'

/**
 * Translate user-written text into both English and Simplified Chinese.
 *
 * Every post is stored three ways: the original untouched, plus an English and
 * a Simplified Chinese rendering. Which two get generated depends on what the
 * author wrote:
 *
 *   English original  -> translate to Chinese; the English copy is the original
 *   Chinese original  -> translate to English; the Chinese copy is the original
 *   Neither           -> translate to both
 *
 * Copying the original into its own language column costs a little storage and
 * saves every reader from having to know which column to read.
 *
 * Math never reaches the model. Expressions are masked to placeholders first
 * and restored afterwards, so a translator cannot turn 2x into 2× or reword a
 * variable — see lib/mathtext-core.ts.
 */

import { detectLanguage, maskMath, unmaskMath } from '@/lib/mathtext-core'

export interface TranslatedText {
  /** 'en' | 'zh' | 'other' — the detected language of the original. */
  lang: 'en' | 'zh' | 'other'
  en: string
  zh: string
}

const MODEL = 'gpt-4o-mini'

/** Placeholders must survive translation verbatim, so the prompt says so. */
const SYSTEM_PROMPT = `You translate messages from a school maths classroom.

Rules:
- Preserve every placeholder of the form ⟦M0⟧, ⟦M1⟧ … EXACTLY as written. They stand for mathematical expressions. Never translate, reorder the digits of, reformat, or drop them.
- Keep the author's tone and register. These are students and teachers talking to each other, not published prose.
- Do not answer, correct, explain or expand the content. Translate only.
- Preserve line breaks.
- Output ONLY valid JSON matching the requested shape — no markdown fences, no commentary.`

async function callModel(
  apiKey: string,
  masked: string,
  targets: ('en' | 'zh')[],
): Promise<Record<string, string>> {
  const wanted = targets
    .map(t => (t === 'en' ? '"en": "<English>"' : '"zh": "<Simplified Chinese>"'))
    .join(', ')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            `Translate this message. Reply with JSON: { ${wanted} }\n\n` +
            `Message:\n${masked}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    throw new Error(`translation failed: ${res.status} ${res.statusText}`)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('translation returned no content')
  return JSON.parse(content)
}

/**
 * @returns both renderings, or the original in both slots if translation is
 *   unavailable. Callers should treat failure as non-fatal: a post that saves
 *   without translations is far better than a post that fails to save.
 */
export async function translateUserText(original: string): Promise<TranslatedText> {
  const text = (original ?? '').trim()
  const lang = detectLanguage(text)

  if (!text) return { lang, en: '', zh: '' }

  // 'other' covers two different things: prose in a third language, which does
  // need translating into both, and content that is only math and digits, which
  // has no words at all. Skip the API call for the second — "$x = 2y$" reads the
  // same in every language, and a model given it will invent commentary.
  const wordless = maskMath(text).masked.replace(/⟦M\d+⟧/g, '').match(/\p{L}/u) === null
  if (wordless) return { lang, en: text, zh: text }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[i18n] OPENAI_API_KEY not set; storing original for both languages')
    return { lang, en: text, zh: text }
  }

  const targets: ('en' | 'zh')[] =
    lang === 'en' ? ['zh'] : lang === 'zh' ? ['en'] : ['en', 'zh']

  const { masked, math } = maskMath(text)

  try {
    const result = await callModel(apiKey, masked, targets)
    const restore = (value: unknown) =>
      typeof value === 'string' && value.trim() ? unmaskMath(value, math) : text

    return {
      lang,
      // The source language keeps the original verbatim — no round trip, so no
      // chance of the model quietly rewording what the author actually wrote.
      en: lang === 'en' ? text : restore(result.en),
      zh: lang === 'zh' ? text : restore(result.zh),
    }
  } catch (err) {
    console.error('[i18n] translateUserText:', err)
    return { lang, en: text, zh: text }
  }
}

// The reading side lives in lib/i18n/localize.ts — this module is server-only,
// so a client component cannot import from it.
