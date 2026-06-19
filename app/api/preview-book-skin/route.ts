// app/api/preview-book-skin/route.ts
//
// Generates a preview book cover image using gpt-image-1.
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

// Injected into every book cover generation prompt
const COVER_CONTEXT = `
STRICT COMPOSITION RULES — follow exactly:

This image is a hardcover book cover illustration on a TRANSPARENT background.

LAYOUT: The book cover face is a flat, front-facing rectangle that occupies the FULL WIDTH and FULL HEIGHT of the image — edge to edge. There are NO transparent margins. The book cover IS the entire image. Outside the image bounds is irrelevant.

BOOK COVER (full image): Flat, straight-on, no perspective, no tilt, no visible spine. Portrait orientation (taller than wide). The surface has thematic texture richer near edges and fading to plain smooth in the center. An ornate thin gold border line frames the perimeter.

CORNER OBJECTS: Large, richly detailed 3D objects sit at each of the four corners. They are large enough that they visually "break" the gold border frame edge — appearing to sit on top of and slightly overflow the book's surface. They have full natural colors, realistic volume, cast shadows on the cover surface.

CENTER ZONE: The inner area (roughly middle 30–60% width, 20–65% height) stays plain and relatively undecorated for text overlay.

NO TEXT, letters, words, or typography anywhere.
`.trim()

async function callGenerations(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1536',
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
  form.append('model', 'gpt-image-1')
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

    const { prompt, sourceImageUrl, changePrompt } = await request.json()
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    const uid = session.user.id
    const ts = Date.now()
    let finalB64: string
    let accumulatedPrompt: string

    if (sourceImageUrl && changePrompt?.trim()) {
      // Refine mode
      const editPrompt = `${changePrompt.trim()}\n\nPreserve: centered book cover rectangle with transparent margins around it, corner objects overflowing outside the book edges, clear center zone, gold border frame on the book. No text. Background outside the book is fully transparent.`
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
