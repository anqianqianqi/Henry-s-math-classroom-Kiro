// app/api/identify-cover-objects/route.ts
//
// Uses GPT-4o vision to enumerate all individual 3D objects visible in the
// corner cluster decorations of a generated book cover.
//
// POST body: { imageUrl: string, coverPrompt: string }
// Returns:   { objects: string[] }   e.g. ["dragon", "crystal orb", "flame", "treasure chest"]

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30  // GPT-4o vision call is fast, 30s is plenty

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: roles } = await supabase
      .from('user_roles').select('roles!inner(name)').eq('user_id', session.user.id).is('class_id', null)
    const isAdmin = (roles as any[])?.some((r: any) => r.roles?.name === 'administrator' || r.roles?.name === 'teacher')
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { imageUrl, coverPrompt } = await request.json()
    if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    const systemPrompt = `You are an art analyst examining a book cover illustration.
The cover has decorative corner clusters — small groups of 2–4 closely grouped 3D objects in each corner.
Your task: list every individual distinct object you can see across ALL four corners, broken down to detail level.
For example, if a corner has a "dragon and a crystal orb and a flame", list them as three separate items: "dragon", "crystal orb", "flame".
Also list any other notable decorative elements (e.g. "gold border ornament", "compass rose", "anchor").

Respond ONLY with a valid JSON array of short lowercase noun strings. No explanations. No numbering.
Example: ["dragon", "crystal orb", "flame", "treasure chest", "compass rose", "gold coins", "anchor"]
Maximum 12 items. If unsure about an object, skip it.`

    const userContent: any[] = [
      {
        type: 'image_url',
        image_url: { url: imageUrl, detail: 'high' },
      },
      {
        type: 'text',
        text: `Cover description: "${coverPrompt || '(no description provided)'}"\n\nList all individual objects in the corner cluster decorations.`,
      },
    ]

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 200,
        temperature: 0.2,
      }),
    })

    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`GPT-4o failed (${res.status}): ${txt.slice(0, 200)}`)
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '[]'

    // Parse the JSON array — be forgiving of minor formatting issues
    let objects: string[] = []
    try {
      // Extract JSON array even if there's surrounding text
      const match = raw.match(/\[[\s\S]*\]/)
      objects = match ? JSON.parse(match[0]) : []
      objects = objects.filter((o: any) => typeof o === 'string' && o.trim().length > 0)
        .map((o: string) => o.trim().toLowerCase())
        .slice(0, 12)
    } catch {
      // Fallback: split by comma if JSON parse failed
      objects = raw
        .replace(/[\[\]"]/g, '')
        .split(',')
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 12)
    }

    return NextResponse.json({ objects })
  } catch (err: any) {
    console.error('[identify-cover-objects] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
