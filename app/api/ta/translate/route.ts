/**
 * POST /api/ta/translate
 *
 * Translates TA grading output fields into Traditional Chinese (繁體中文).
 * Used by the language toggle in the TA panel — no grading logic here,
 * just translation of existing text.
 *
 * Body: { fields: { [key: string]: string } }
 * Response: { fields: { [key: string]: string } }  — same keys, Chinese values
 */

import { NextRequest, NextResponse } from 'next/server'

const OPENAI_KEY = process.env.OPENAI_API_KEY!

export const maxDuration = 30

export async function POST(req: NextRequest) {
  let body: { fields: Record<string, string> }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { fields } = body
  if (!fields || typeof fields !== 'object') {
    return NextResponse.json({ error: 'fields required' }, { status: 400 })
  }

  // Build a single prompt that translates all fields at once (one API call)
  const entries = Object.entries(fields).filter(([, v]) => v && v.trim())
  if (entries.length === 0) return NextResponse.json({ fields: {} })

  const inputJson = JSON.stringify(Object.fromEntries(entries), null, 2)

  const systemPrompt = `You are a professional translator specializing in math education content.
Translate the given JSON fields from English into Traditional Chinese (繁體中文).

Rules:
- Preserve the exact JSON keys unchanged
- Translate only the values
- Keep math expressions, numbers, and variable names (a, b, c, X, Y, Z) as-is
- Use natural, warm educational language appropriate for a middle/high school math classroom
- Output ONLY valid JSON — no markdown, no extra text`

  const userMessage = `Translate these TA grading fields to Traditional Chinese:\n\n${inputJson}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',  // cheaper model is fine for translation
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
      max_tokens: 1500,
      temperature: 0.1,
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: `OpenAI error ${res.status}` }, { status: 500 })
  }

  const raw = (await res.json()).choices[0].message.content as string
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()

  try {
    const translated = JSON.parse(cleaned)
    return NextResponse.json({ fields: translated })
  } catch {
    return NextResponse.json({ error: 'Translation response was not valid JSON' }, { status: 500 })
  }
}
