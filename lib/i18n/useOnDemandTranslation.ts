'use client'

/**
 * On-demand translation of user-written posts.
 *
 * A post is stored as the author typed it. When a reader viewing the other
 * language opens it, this asks the server to translate it, and the server keeps
 * the result — so the wait happens once for the first reader and never again.
 *
 * Contrast with static strings (UI labels, challenge tags): those are a small
 * fixed set written once and read constantly, so they are stored in both
 * languages up front. Posts are the opposite — unbounded, and mostly read in
 * the language they were written in.
 *
 * Until the translation arrives the reader sees the original. Nothing is ever
 * blank and nothing is ever a spinner in place of text.
 */

import { useEffect, useState } from 'react'
import type { Language } from './catalog'
import { localizeQuestion, looksUntranslated, type TranslatableText } from './localize'

export type PostKind = 'question' | 'response' | 'submission' | 'comment'

interface Fields {
  text_en?: string | null
  text_zh?: string | null
  title_en?: string | null
  title_zh?: string | null
}

/** Results survive re-renders and remounts, so scrolling a list re-costs nothing. */
const cache = new Map<string, Fields>()
/** One request per row even when several components ask at the same moment. */
const inFlight = new Map<string, Promise<Fields | null>>()

/**
 * Long threads would otherwise open a request per post the instant they render.
 * A small ceiling keeps that to a steady trickle; posts near the top of the
 * list are requested first because that is what the reader is looking at.
 */
const MAX_CONCURRENT = 4
let active = 0
const waiting: (() => void)[] = []

async function withSlot<T>(run: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>(resolve => waiting.push(resolve))
  }
  active++
  try {
    return await run()
  } finally {
    active--
    waiting.shift()?.()
  }
}

async function requestTranslation(kind: PostKind, id: string): Promise<Fields | null> {
  const key = `${kind}:${id}`

  const cached = cache.get(key)
  if (cached) return cached

  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = withSlot(async () => {
    try {
      const res = await fetch('/api/i18n/translate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id }),
      })
      if (!res.ok) return null

      const data = await res.json()

      // No engine was reachable, so the server handed back the original in both
      // slots. Don't remember that — the reader already sees the original, and
      // caching it would stop the next attempt in this session from happening.
      if (data.status === 'unavailable') return null

      const fields: Fields = {
        text_en: data.text?.en ?? null,
        text_zh: data.text?.zh ?? null,
        title_en: data.title?.en ?? null,
        title_zh: data.title?.zh ?? null,
      }
      cache.set(key, fields)
      return fields
    } catch {
      // Offline, or the request was cancelled. The original is already on
      // screen, so there is nothing to report and nothing to retry right now.
      return null
    } finally {
      inFlight.delete(key)
    }
  })

  inFlight.set(key, promise)
  return promise
}

/**
 * Localize one post, fetching a translation if the reader's language is missing.
 *
 * @param enabled pass false for content that should never be translated (a
 *   collapsed thread, a hidden tab) so it costs nothing until it is shown.
 * @returns the best text available right now, plus whether a request is out.
 */
export function useOnDemandTranslation<T extends TranslatableText>(
  kind: PostKind,
  id: string | null | undefined,
  item: T | null | undefined,
  language: Language,
  enabled = true,
): { title: string | null; text: string; pending: boolean } {
  const [fetched, setFetched] = useState<Fields | null>(() =>
    id ? cache.get(`${kind}:${id}`) ?? null : null,
  )
  const [pending, setPending] = useState(false)

  // Whatever came with the row wins; anything fetched only fills the gaps. A
  // fetched null must never blank out a value the row already had.
  const firstFilled = (...values: (string | null | undefined)[]) =>
    values.find(v => v?.trim()) ?? null

  const merged = {
    ...(item ?? { text: '' }),
    text_en: firstFilled(item?.text_en, fetched?.text_en),
    text_zh: firstFilled(item?.text_zh, fetched?.text_zh),
    title_en: firstFilled(item?.title_en, fetched?.title_en),
    title_zh: firstFilled(item?.title_zh, fetched?.title_zh),
  } as T

  // Missing covers two cases: never translated, and frozen by an older build as
  // the original in both slots. Without the second the column looks filled, the
  // request is never made, and the self-healing path in the route never runs.
  const missing =
    !(language === 'zh' ? merged.text_zh : merged.text_en) ||
    looksUntranslated(item?.text, merged.text_en, merged.text_zh)

  useEffect(() => {
    if (!enabled || !id || !item || !missing) return

    let cancelled = false
    setPending(true)
    requestTranslation(kind, id)
      .then(fields => {
        if (!cancelled && fields) setFetched(fields)
      })
      .finally(() => {
        if (!cancelled) setPending(false)
      })

    return () => {
      cancelled = true
    }
    // `missing` collapses the parts of `item` that matter here; re-running on
    // the whole object would refire on every unrelated parent render.
  }, [kind, id, missing, enabled, item !== null && item !== undefined])

  const localized = localizeQuestion(merged, language)
  return { ...localized, pending: pending && missing }
}

/** Prefetch without rendering — e.g. when a thread is about to be expanded. */
export function prefetchTranslation(kind: PostKind, id: string) {
  void requestTranslation(kind, id)
}
