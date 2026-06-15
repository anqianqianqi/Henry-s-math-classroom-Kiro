// app/api/parse-challenge-image/route.ts
// Accepts a base64-encoded image of a teacher's handwritten/typed challenge notes
// and uses GPT-4o vision to extract: title, description, maxPoints, and hint.
// Only callable by authenticated teachers.

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Verify auth
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify teacher role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', session.user.id)
      .is('class_id', null)

    const isTeacher = (roles as any[])?.some((r: any) =>
      r.roles?.name === 'teacher' || r.roles?.name === 'administrator'
    )
    if (!isTeacher) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const { imageBase64, mimeType = 'image/jpeg' } = await request.json()
    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 })
    }

    const prompt = `You are helping a math teacher enter a challenge into an online classroom portal.

Look at this image of the teacher's challenge notes and extract the following fields.

CRITICAL: Preserve the EXACT language used in the image. If the text is in Chinese, keep it in Chinese. If it is in English, keep it in English. If it is mixed, keep it mixed. Do NOT translate anything.

Extract:
- title: A concise challenge title (1 line, no trailing punctuation). Use the exact language from the image.
- description: The full problem statement exactly as written, preserving the original language and wording. Include all parts of the problem. For math notation use plain text (e.g. "x^2 + 3x - 4 = 0").
- maxPoints: The point value as an integer (look for numbers like "10 pts", "/10", "10分", etc.). Default to 100 if not found.
- hint: Any hint text written for students (preserve original language), or null if none.

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{"title":"...","description":"...","maxPoints":100,"hint":null}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[parse-challenge-image] OpenAI error:', err)
      return NextResponse.json({ error: 'Failed to call OpenAI: ' + response.statusText }, { status: 500 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()

    if (!content) {
      return NextResponse.json({ error: 'No response from OpenAI' }, { status: 500 })
    }

    // Parse the JSON response from GPT
    let parsed: { title: string; description: string; maxPoints: number; hint: string | null }
    try {
      // Strip markdown code fences if GPT wrapped it anyway
      const clean = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      console.error('[parse-challenge-image] Failed to parse GPT response:', content)
      return NextResponse.json({ error: 'Could not parse AI response. Try a clearer image.' }, { status: 422 })
    }

    return NextResponse.json({
      title: String(parsed.title || '').trim(),
      description: String(parsed.description || '').trim(),
      maxPoints: Number.isFinite(parsed.maxPoints) ? Math.max(1, Math.round(parsed.maxPoints)) : 100,
      hint: parsed.hint ? String(parsed.hint).trim() : null,
    })
  } catch (err) {
    console.error('[parse-challenge-image] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
