/**
 * POST /api/i18n/translate-post
 *
 * Translates one piece of user-written text on demand — a bubble room question,
 * an answer or reply, a challenge submission, or a comment on one.
 *
 * Why on demand rather than at write time: most posts are never read in the
 * other language, so translating every one up front spends money and adds a
 * round trip to posting for nothing. Translating when a reader actually asks
 * pays only for text somebody reads, and posting stays instant.
 *
 * The result is written back into the same *_en / *_zh columns, so it is paid
 * for once no matter how many people read it afterwards. Those columns behave
 * as a cache now rather than something the insert has to fill. Static, reusable
 * strings — UI labels, challenge tags — are still stored in both languages up
 * front; they are a small fixed set that would otherwise be translated forever.
 *
 * Body: { kind: 'question' | 'response' | 'submission' | 'comment', id: string }
 * Returns: { lang, text: { en, zh }, title?: { en, zh } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { translateUserText } from '@/lib/i18n/translateUserText'
import { looksUntranslated } from '@/lib/i18n/localize'

export const dynamic = 'force-dynamic'

/**
 * Which column holds the prose, per kind. `title` is only for questions — the
 * other three have a single body field.
 */
const KINDS = {
  question: { table: 'bubble_room_questions', body: 'text', title: 'title' },
  response: { table: 'bubble_room_responses', body: 'text', title: null },
  submission: { table: 'challenge_submissions', body: 'content', title: null },
  comment: { table: 'submission_comments', body: 'content', title: null },
  // Written by an admin rather than a student, but translated the same way —
  // the row is append-only, so a new announcement always starts with empty
  // body_en/body_zh and there is no stale cache to clear.
  announcement: { table: 'announcements', body: 'body', title: null },
} as const

type Kind = keyof typeof KINDS

export async function POST(request: NextRequest) {
  try {
    const { kind, id } = await request.json()

    if (!kind || !(kind in KINDS)) {
      return NextResponse.json({ error: 'Unknown kind' }, { status: 400 })
    }
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const spec = KINDS[kind as Kind]

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    /**
     * Read through the caller's own client so RLS decides whether they may see
     * this row. Translating is a read: anything this returns, the caller could
     * already have fetched directly. Going straight to the service role here
     * would turn the endpoint into a way to read any post by guessing its id.
     */
    const columns = [
      spec.body, `${spec.body}_en`, `${spec.body}_zh`, `${spec.body}_lang`,
      ...(spec.title ? [spec.title, `${spec.title}_en`, `${spec.title}_zh`] : []),
    ].join(', ')

    const { data: row, error: readError } = await supabase
      .from(spec.table)
      .select(columns)
      .eq('id', id)
      .single()

    if (readError || !row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // The column list is built at runtime, so supabase-js cannot infer a row
    // shape for it and falls back to an error-ish union.
    const r = row as unknown as Record<string, string | null>
    const filled = (v: string | null | undefined) => Boolean(v && v.trim())

    // Already translated by an earlier reader — return it and spend nothing.
    // looksUntranslated catches rows an older build froze as the original twice
    // over, so those retranslate here rather than staying stuck forever.
    const bodyDone =
      filled(r[`${spec.body}_en`]) &&
      filled(r[`${spec.body}_zh`]) &&
      !looksUntranslated(r[spec.body], r[`${spec.body}_en`], r[`${spec.body}_zh`])

    const titleDone = !spec.title
      || !filled(r[spec.title])
      || (filled(r[`${spec.title}_en`])
          && filled(r[`${spec.title}_zh`])
          && !looksUntranslated(r[spec.title], r[`${spec.title}_en`], r[`${spec.title}_zh`]))

    if (bodyDone && titleDone) {
      return NextResponse.json({
        cached: true,
        lang: r[`${spec.body}_lang`] ?? 'other',
        text: { en: r[`${spec.body}_en`], zh: r[`${spec.body}_zh`] },
        ...(spec.title
          ? { title: { en: r[`${spec.title}_en`], zh: r[`${spec.title}_zh`] } }
          : {}),
      })
    }

    const bodyT = await translateUserText(r[spec.body] ?? '')
    const titleT = spec.title && filled(r[spec.title])
      ? await translateUserText(r[spec.title] ?? '')
      : null

    /**
     * Only cache a real answer.
     *
     * When no engine is reachable translateUserText hands back the original in
     * both slots, which is right for the reader but must never be written: it
     * is indistinguishable from a finished translation, so storing it marks the
     * row done forever and no later reader — or later API key — can undo that.
     * 'skipped' is safe; pure math genuinely is the same in both languages.
     */
    const worthCaching = bodyT.status !== 'unavailable'

    if (worthCaching) {
      /**
       * Write back with the service role. The reader is usually not the author,
       * and RLS rightly stops one student editing another's post — but filling
       * a cache is not editing, and only the translation columns are touched.
       */
      const update: Record<string, string> = {
        [`${spec.body}_en`]: bodyT.en,
        [`${spec.body}_zh`]: bodyT.zh,
        [`${spec.body}_lang`]: bodyT.lang,
      }
      if (spec.title && titleT && titleT.status !== 'unavailable') {
        update[`${spec.title}_en`] = titleT.en
        update[`${spec.title}_zh`] = titleT.zh
      }

      const service = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const { error: writeError } = await service
        .from(spec.table)
        .update(update)
        .eq('id', id)

      // A failed write costs the next reader another translation; it does not
      // cost this one their result, so it is logged rather than returned.
      if (writeError) {
        console.error('[i18n] cache write failed', spec.table, id, writeError)
      }
    }

    return NextResponse.json({
      cached: false,
      status: bodyT.status,
      // Which engine ran and how it failed. "Nothing translated" has three very
      // different causes — no key configured, the wrong key picked up, or the
      // chosen engine erroring — and they cannot be told apart without this.
      engine: bodyT.engine,
      ...(bodyT.error ? { error: bodyT.error } : {}),
      lang: bodyT.lang,
      text: { en: bodyT.en, zh: bodyT.zh },
      ...(titleT ? { title: { en: titleT.en, zh: titleT.zh } } : {}),
    })
  } catch (err: any) {
    console.error('[i18n] translate-post', err)
    return NextResponse.json({ error: err?.message ?? 'Translation failed' }, { status: 500 })
  }
}
