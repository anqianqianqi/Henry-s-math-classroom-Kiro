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
 * The source language keeps the original verbatim rather than round-tripping,
 * so nothing can quietly reword what the author actually typed.
 *
 * ── ENGINE ──────────────────────────────────────────────────
 * A dedicated machine-translation API is preferred over an LLM, and is chosen
 * automatically by whichever key is configured:
 *
 *   DEEPL_API_KEY        -> DeepL          (best EN<->ZH quality)
 *   GOOGLE_TRANSLATE_API_KEY -> Google Cloud Translation
 *   OPENAI_API_KEY       -> gpt-4o-mini    (fallback)
 *
 * Why not the LLM by default: an LLM handed "When A is 60, how old is C?" may
 * decide to answer it, or silently correct a student's mistake. A prompt can ask
 * it not to; an MT engine cannot do it at all. MT is also stable run-to-run,
 * where temperature 0.1 is not, so two students posting the same sentence get
 * the same translation. It is faster too, which matters because this runs
 * before the insert.
 *
 * ── MATH ────────────────────────────────────────────────────
 * Expressions are masked to placeholders before the text leaves this module and
 * restored afterwards, so no engine ever sees them — see lib/mathtext-core.ts.
 * Every engine mangles LaTeX given the chance; masking is not engine-specific.
 */

import { detectLanguage, maskMath, unmaskMath } from '@/lib/mathtext-core'
import { stripIgnoreTags, wrapForIgnore } from './placeholderTags'

export interface TranslatedText {
  /** 'en' | 'zh' | 'other' — the detected language of the original. */
  lang: 'en' | 'zh' | 'other'
  en: string
  zh: string
}

/** 'zh' throughout this codebase means Simplified Chinese (zh-Hans). */
export type Target = 'en' | 'zh'

// ── Engines ─────────────────────────────────────────────────

/**
 * DeepL. Placeholders are wrapped in <x> and declared ignorable, so the engine
 * treats each as one opaque unit rather than something to translate or reflow.
 */
async function translateDeepL(text: string, target: Target): Promise<string> {
  const key = process.env.DEEPL_API_KEY!
  // Free keys end in ":fx" and use a different host.
  const host = key.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com'

  const params = new URLSearchParams({
    text: wrapForIgnore(text),
    target_lang: target === 'zh' ? 'ZH-HANS' : 'EN-GB',
    tag_handling: 'xml',
    ignore_tags: 'x',
    preserve_formatting: '1',
  })

  const res = await fetch(`https://${host}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  if (!res.ok) throw new Error(`DeepL ${res.status} ${res.statusText}`)

  const data = await res.json()
  const out = data.translations?.[0]?.text
  if (typeof out !== 'string') throw new Error('DeepL returned no text')
  return stripIgnoreTags(out)
}

/** Google Cloud Translation v2. */
async function translateGoogle(text: string, target: Target): Promise<string> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY!
  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        target: target === 'zh' ? 'zh-CN' : 'en',
        format: 'text',
      }),
    },
  )
  if (!res.ok) throw new Error(`Google Translate ${res.status} ${res.statusText}`)

  const data = await res.json()
  const out = data.data?.translations?.[0]?.translatedText
  if (typeof out !== 'string') throw new Error('Google returned no text')
  // format:text still HTML-escapes a few characters on the way back.
  return out
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/** Fallback. Kept so the feature works before an MT key is configured. */
async function translateOpenAI(text: string, target: Target): Promise<string> {
  const key = process.env.OPENAI_API_KEY!
  const targetName = target === 'zh' ? 'Simplified Chinese (简体中文)' : 'English'

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            `You translate messages from a school maths classroom into ${targetName}.\n` +
            'Rules:\n' +
            '- Preserve every ⟦M0⟧, ⟦M1⟧ … placeholder EXACTLY. They stand for mathematical expressions.\n' +
            '- Do not answer, correct, explain or expand the content. Translate only.\n' +
            '- Keep the author’s tone. Preserve line breaks.\n' +
            '- Reply with the translation and nothing else.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 2000,
      temperature: 0,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status} ${res.statusText}`)

  const data = await res.json()
  const out = data.choices?.[0]?.message?.content
  if (typeof out !== 'string') throw new Error('OpenAI returned no text')
  return out.trim()
}

type Engine = { name: string; run: (text: string, target: Target) => Promise<string> }

/** First configured engine wins; order is deliberate, best fit first. */
function selectEngine(): Engine | null {
  if (process.env.DEEPL_API_KEY) return { name: 'deepl', run: translateDeepL }
  if (process.env.GOOGLE_TRANSLATE_API_KEY) return { name: 'google', run: translateGoogle }
  if (process.env.OPENAI_API_KEY) return { name: 'openai', run: translateOpenAI }
  return null
}

// ── Public API ──────────────────────────────────────────────

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
  // has no words at all. Skip the call for the second — "$x = 2y$" reads the
  // same in every language.
  const wordless = maskMath(text).masked.replace(/⟦M\d+⟧/g, '').match(/\p{L}/u) === null
  if (wordless) return { lang, en: text, zh: text }

  const engine = selectEngine()
  if (!engine) {
    console.warn('[i18n] no translation key configured; storing original for both languages')
    return { lang, en: text, zh: text }
  }

  const targets: Target[] = lang === 'en' ? ['zh'] : lang === 'zh' ? ['en'] : ['en', 'zh']
  const { masked, math } = maskMath(text)

  const result: TranslatedText = { lang, en: text, zh: text }

  await Promise.all(
    targets.map(async target => {
      try {
        const translated = await engine.run(masked, target)
        const restored = unmaskMath(translated, math)
        if (restored.trim()) result[target] = restored
      } catch (err) {
        // Leave this target as the original. One direction failing should not
        // cost the other, and neither should cost the post.
        console.error(`[i18n] ${engine.name} -> ${target}:`, err)
      }
    }),
  )

  return result
}

// The reading side lives in lib/i18n/localize.ts — this module is server-only,
// so a client component cannot import from it.
