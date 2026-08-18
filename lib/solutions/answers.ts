/**
 * Reading the model reply for the solution splitter.
 *
 * Its own module rather than living in the route: a Next route file may only
 * export its HTTP handlers, so anything exported for testing has to live
 * outside it. That suits this code anyway — it is pure, it is the part most
 * worth testing, and it has nothing to do with HTTP.
 */

export interface SplitAnswer {
  id: string
  page: number
  box: { x: number; y: number; w: number; h: number }
  confidence: number
}

/**
 * What the model said, reduced to answers that can actually be acted on.
 *
 * Everything is checked against the request rather than trusted. An id that
 * was never sent, or a page number past the end of the upload, would crop from
 * nowhere and post under the wrong problem — and this output ends up as a
 * student's submitted work, so a plausible-looking wrong answer is worse than
 * a missing one. Anything that fails is dropped, and that problem simply shows
 * in the review with no answer found, which the page already handles.
 */
export function readAnswers(
  raw: string,
  problems: { id: string }[],
  pageCount: number,
): SplitAnswer[] | null {
  const cleaned = String(raw ?? '')
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()

  let payload: any
  try {
    payload = JSON.parse(cleaned)
  } catch {
    return null
  }

  const list = Array.isArray(payload) ? payload : payload?.answers
  if (!Array.isArray(list)) return null

  const known = new Set(problems.map(p => p.id))
  const seen = new Set<string>()
  const out: SplitAnswer[] = []

  for (const item of list) {
    if (!item || typeof item !== 'object') continue

    const id = String(item.id ?? '')
    // Unknown id, or the same problem answered twice: the second is guesswork.
    if (!known.has(id) || seen.has(id)) continue
    if (item.found === false) continue

    const page = Number(item.page)
    if (!Number.isInteger(page) || page < 0 || page >= pageCount) continue

    const b = item.box
    if (!b || typeof b !== 'object') continue
    const box = { x: Number(b.x), y: Number(b.y), w: Number(b.w), h: Number(b.h) }
    if (!Object.values(box).every(n => Number.isFinite(n))) continue
    // A degenerate box is how a model says "nothing here" in geometry.
    if (box.w <= 0.01 || box.h <= 0.01) continue

    const confidence = Number(item.confidence)
    seen.add(id)
    out.push({
      id,
      page,
      box,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    })
  }

  return out
}
