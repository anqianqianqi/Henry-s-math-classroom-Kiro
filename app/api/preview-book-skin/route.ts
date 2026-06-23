// app/api/preview-book-skin/route.ts
//
// Generates a preview book cover image using gpt-image-2.
// Does NOT insert into DB — caller displays the image then saves with a name.
//
// POST body:
//   { prompt }                              → fresh generation
//   { prompt, sourceImageUrl, changePrompt } → refine existing image
// Returns: { image_url, prompt }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Two cover context variants — selected by the cleanCorners flag in the request
const COVER_CONTEXT_CLEAN = `
COMPOSITION RULES — follow exactly:

Generate a hardcover book cover illustration on a TRANSPARENT background. The image format is RGBA PNG. The area outside the book must be fully transparent (alpha = 0) — no color, no fill, no background at all. Only the book itself should be opaque.

VIEW ANGLE — CRITICAL: The book must be shown in a PERFECTLY FLAT, DEAD-ON FRONT VIEW. The camera looks straight at the cover — zero tilt, zero rotation, zero perspective distortion, no 3/4 angle, no foreshortening, no vanishing point. The top edge and bottom edge are perfectly horizontal and parallel. The left and right edges are perfectly vertical and parallel. This is a 2D orthographic front view of the cover, not a product photo.

The book is a flat front-facing hardcover portrait rectangle that fills the canvas. It has a slight drop shadow around its edges (semi-transparent dark shadow that fades to transparent — this is the only thing allowed outside the book boundary).

COVER SURFACE: Rich thematic texture — deeply embossed near the edges, smoother toward the center. A thin ornate gold decorative border runs inside the cover perimeter. The cover material looks like premium cloth or leather hardcover.

CORNERS: Keep all four corners of the cover CLEAN and EMPTY — just the book surface texture and the border frame, no objects, no decorations, no clusters. The corners must be plain cover surface ready for animated overlay objects to be composited on top later.

CENTER ZONE — CRITICAL: The central rectangle (middle 60% width × middle 50% height) must be a PLAIN, FLAT, UNIFORM SURFACE. This means:
- NO scenic illustrations, NO landscapes, NO forests, NO scenes, NO characters, NO objects
- ONLY the bare book cover material (leather, cloth, or embossed texture) — flat and uniform
- Subtle embossed texture pattern is acceptable but NO representational imagery of any kind
- This area will hold the book title — it must read as a blank canvas

DEPTH: Give it physical weight through: edge darkening/vignette on the cover surface itself, embossed border ornaments, realistic material texture. Do NOT add depth through perspective or tilt.

TRANSPARENT BACKGROUND: Everything outside the book shape (except the drop shadow) must be fully transparent. No white fill, no color fill, no background.

NO text, letters, numbers, or glyphs anywhere in the image.
`.trim()

const COVER_CONTEXT_WITH_CORNERS = `
COMPOSITION RULES — follow exactly:

Generate a hardcover book cover illustration on a TRANSPARENT background. The image format is RGBA PNG. The area outside the book must be fully transparent (alpha = 0) — no color, no fill, no background at all. Only the book itself should be opaque.

VIEW ANGLE — CRITICAL: The book must be shown in a PERFECTLY FLAT, DEAD-ON FRONT VIEW. The camera looks straight at the cover — zero tilt, zero rotation, zero perspective distortion, no 3/4 angle, no foreshortening, no vanishing point. The top edge and bottom edge are perfectly horizontal and parallel. The left and right edges are perfectly vertical and parallel. This is a 2D orthographic front view of the cover, not a product photo.

The book is a flat front-facing hardcover portrait rectangle that fills the canvas. It has a slight drop shadow around its edges (semi-transparent dark shadow that fades to transparent — this is the only thing allowed outside the book boundary).

COVER SURFACE: Rich thematic texture — deeply embossed near the edges, smoother toward the center. A thin ornate gold decorative border runs inside the cover perimeter. The cover material looks like premium cloth or leather hardcover.

CORNER DECORATION: Each corner has a dense cluster of 2–4 closely grouped 3D objects forming a small vignette. Objects sit ON the cover surface, casting soft shadows on it. The clusters extend to the very corner edges of the cover.

CENTER ZONE — CRITICAL: The central rectangle (middle 60% width × middle 50% height) must be a PLAIN, FLAT, UNIFORM SURFACE. This means:
- NO scenic illustrations, NO landscapes, NO forests, NO scenes, NO characters, NO objects
- ONLY the bare book cover material (leather, cloth, or embossed texture) — flat and uniform
- Subtle embossed texture or faint thematic pattern is acceptable but NO representational imagery of any kind
- This area will hold the book title — it must read as a blank canvas

DEPTH: Give it physical weight through: edge darkening/vignette on the cover surface itself, embossed border ornaments, realistic material texture. Do NOT add depth through perspective or tilt.

TRANSPARENT BACKGROUND: Everything outside the book shape (except the drop shadow) must be fully transparent. No white fill, no color fill, no background.

NO text, letters, numbers, or glyphs anywhere in the image.
`.trim()

async function callGenerations(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt,
      n: 1,
      size: '1024x1536',   // portrait — fills canvas naturally, no side padding
      output_format: 'png',
      quality: 'high',
    }),
  })
  if (!res.ok) throw new Error(`Generation failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data from OpenAI')
  return b64
}

async function callEdit(apiKey: string, imageUrl: string, editPrompt: string): Promise<string> {
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error('Could not fetch source image')
  const imgBlob = new Blob([await imgRes.arrayBuffer()], { type: 'image/png' })
  const form = new FormData()
  form.append('model', 'gpt-image-2')
  form.append('image', imgBlob, 'cover.png')
  form.append('prompt', editPrompt)
  form.append('n', '1')
  form.append('size', '1024x1536')
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Edit failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data from edit')
  return b64
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: roles } = await supabase
      .from('user_roles').select('roles!inner(name)').eq('user_id', session.user.id).is('class_id', null)
    const isAdmin = (roles as any[])?.some((r: any) => r.roles?.name === 'administrator' || r.roles?.name === 'teacher')
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { prompt, sourceImageUrl, changePrompt, cleanCorners } = await request.json()
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    // Pick context based on whether admin wants clean corners (for overlay objects) or corner clusters
    const COVER_CONTEXT = cleanCorners ? COVER_CONTEXT_CLEAN : COVER_CONTEXT_WITH_CORNERS

    const uid = session.user.id
    const ts = Date.now()
    let finalB64: string
    let accumulatedPrompt: string

    if (sourceImageUrl && changePrompt?.trim()) {
      // Refine mode
      const editPrompt = `${changePrompt.trim()}\n\nPreserve: flat front-facing book cover filling the full canvas, 3:4 proportions, corner cluster objects, clear plain center zone, gold border frame. No text anywhere.`
      finalB64 = await callEdit(apiKey, sourceImageUrl, editPrompt)
      const base = prompt?.trim() ?? ''
      accumulatedPrompt = base ? `${base}\n\n[Refinement] ${changePrompt.trim()}` : changePrompt.trim()
    } else {
      if (!prompt?.trim()) return NextResponse.json({ error: 'prompt required' }, { status: 400 })
      finalB64 = await callGenerations(apiKey, `${prompt.trim()}\n\n${COVER_CONTEXT}`)
      accumulatedPrompt = prompt.trim()
    }

    // Upload to book-skins bucket for preview
    const finalBuf = Buffer.from(finalB64, 'base64')
    const finalFile = `${uid}/book-cover-preview-${ts}.png`
    const { error: uploadErr } = await supabase.storage
      .from('book-skins')
      .upload(finalFile, finalBuf, { contentType: 'image/png', upsert: false })
    if (uploadErr) return NextResponse.json({ error: 'Upload failed: ' + uploadErr.message }, { status: 500 })
    const { data: { publicUrl } } = supabase.storage.from('book-skins').getPublicUrl(finalFile)

    return NextResponse.json({ image_url: publicUrl, prompt: accumulatedPrompt })
  } catch (err: any) {
    console.error('[preview-book-skin] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
