/**
 * Find each problem's answer on the pages a student uploaded.
 *
 * The student prints a problem set, works on paper, and photographs or scans
 * it back. This route is given those pages as images together with the
 * problems that were in the set, and answers one question per problem: which
 * page is your answer on, and whereabouts on it.
 *
 * ── WHY BOXES AND NOT TEXT ──────────────────────────────────
 * The submission that gets posted is a crop of the student's own handwriting,
 * not a transcription of it. Transcribing handwritten mathematics puts a
 * machine's reading of the work in front of the teacher instead of the work,
 * and every mis-read becomes something a student has to argue about. A crop
 * cannot be wrong about what was written — at worst it is cut in the wrong
 * place, which anyone can see at a glance, and the review step exists to
 * catch exactly that.
 *
 * So the model is asked for the thing it is reliable at — recognising which
 * question a piece of working belongs to — and not for the thing it is not.
 */

import { NextRequest, NextResponse } from 'next/server'
import { readAnswers } from '@/lib/solutions/answers'

const OPENAI_KEY = process.env.OPENAI_API_KEY!

export const maxDuration = 120

/** Guards against a client sending a whole scanned exercise book. */
const MAX_PAGES = 20
const MAX_PROBLEMS = 40

interface ProblemBrief {
  id: string
  title: string
  /** A little of the wording, enough to tell the problems apart. */
  wording: string
}

/*
  The prompt describes the page the student actually prints, because that page
  is ours and its shape is fixed. A general "find the handwriting" instruction
  produced boxes that swallowed the printed question; naming the parts — a
  bordered problem card at the top, working underneath, a footer with the URL
  and a page count — turns the job into "cut between two known landmarks",
  which a vision model does far more reliably than free-form region finding.

  Two identifiers are printed on every sheet and both are worth reading: the
  card's Title line, and the "1 / 7" page marker in the corner, which is the
  problem's position in the set as it was generated.
*/
const SYSTEM = [
  'You locate a student handwritten working on scanned homework pages.',
  '',
  'The pages are a printed problem set from a maths site, worked on by hand.',
  'Every printed sheet is laid out the same way, top to bottom:',
  '1. A thin header with a date and "Henry\'s Math Classroom". Ignore it.',
  '2. A bordered problem card on a cream background: a banner reading',
  '   "Henry" and a logo, then "Title : <name>" and "Score : <n> pts", then the',
  '   question written twice, once in English and once in Chinese, each in its',
  '   own panel, then a row of tag chips.',
  '3. A page marker at the right, like "1 / 7" — the position of this problem',
  '   in the set.',
  '4. BELOW the card: the student handwritten working. This is what you want.',
  '5. A footer with a long URL and a page number. Ignore it.',
  '',
  'IMPORTANT: one scanned image may hold TWO printed sheets side by side, a',
  'left half and a right half. Treat each half as its own sheet with its own',
  'problem, and box each separately.',
  '',
  'Matching a sheet to a problem, best signal first:',
  '- The "Title :" printed on the card. It matches one problem title exactly.',
  '- The printed question text, against the wording given below.',
  '- The "1 / 7" marker: problems are listed below in the order they were set.',
  'Some sheets may be missing, and some may be blank where the student did not',
  'answer. Do not stretch to fill every problem.',
  '',
  'Give a rough box around the handwriting, as fractions of the WHOLE image:',
  'x and y are the left and top edges, w and h the width and height, 0 to 1,',
  'origin at the top left. It does NOT need to be accurate — the exact crop is',
  'measured from the page afterwards. What it is read for is which sheet you',
  'mean: on a two-up scan, a box on the right-hand sheet has x around 0.5.',
  'So put it roughly over the working and spend your effort on identifying the',
  'problem correctly instead.',
  '',
  'If a sheet has the printed card but nothing handwritten under it, that',
  'problem was not answered.',
  '',
  'If you find no working for a problem, report "found": false rather than',
  'guessing a box. A missing answer is a normal outcome and is handled.',
  '',
  'Reply with JSON only, no prose and no code fence:',
  '{"answers":[{"id":"<problem id>","found":true,"page":0,',
  '"box":{"x":0.0,"y":0.0,"w":0.0,"h":0.0},"confidence":0.0}]}',
  'confidence is your own 0-1 estimate that this really is that problem work.',
].join('\n')

export async function POST(req: NextRequest) {
  if (!OPENAI_KEY) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  let body: { pages?: string[]; problems?: ProblemBrief[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }

  const pages = Array.isArray(body.pages) ? body.pages : []
  const problems = Array.isArray(body.problems) ? body.problems : []

  if (!pages.length || !problems.length) {
    return NextResponse.json({ error: 'nothing_to_match' }, { status: 400 })
  }
  if (pages.length > MAX_PAGES || problems.length > MAX_PROBLEMS) {
    return NextResponse.json(
      { error: 'too_much', maxPages: MAX_PAGES, maxProblems: MAX_PROBLEMS },
      { status: 413 },
    )
  }
  if (!pages.every(p => typeof p === 'string' && p.startsWith('data:image/'))) {
    return NextResponse.json({ error: 'bad_pages' }, { status: 400 })
  }

  const problemList = problems
    .map((p, i) => `${i + 1}. id=${p.id}\n   title: ${p.title}\n   wording: ${String(p.wording ?? '').slice(0, 400)}`)
    .join('\n')

  const content: any[] = [
    {
      type: 'text',
      text: `The homework covered these ${problems.length} problems:\n\n${problemList}\n\n`
        + `The ${pages.length} pages follow in order, page 0 first.`,
    },
  ]
  pages.forEach((dataUrl, i) => {
    content.push({ type: 'text', text: `Page ${i}:` })
    // "high" detail: telling two answers apart means reading a problem number
    // in handwriting, which the low-detail path does not resolve.
    content.push({ type: 'image_url', image_url: { url: dataUrl, detail: 'high' } })
  })

  let raw: string
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content },
        ],
        max_tokens: 2000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: 'model_failed', detail: (await res.text()).slice(0, 300) },
        { status: 502 },
      )
    }
    raw = (await res.json())?.choices?.[0]?.message?.content ?? ''
  } catch (err: any) {
    return NextResponse.json(
      { error: 'model_unreachable', detail: String(err?.message ?? err).slice(0, 200) },
      { status: 502 },
    )
  }

  const answers = readAnswers(raw, problems, pages.length)
  if (!answers) {
    return NextResponse.json(
      { error: 'model_returned_nonsense', raw: raw.slice(0, 300) },
      { status: 502 },
    )
  }

  return NextResponse.json({ answers })
}
