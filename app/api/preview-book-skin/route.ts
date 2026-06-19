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
STRICT RULES for this book cover image — follow exactly:

VIEWPOINT: The book cover is viewed PERFECTLY FLAT and STRAIGHT-ON, facing directly toward the camera with NO angle, NO perspective distortion, and NO visible spine. The cover fills the entire image edge-to-edge. You are looking at the front face of the book head-on, as if the book were lying flat on a scanner. Absolutely no 3/4 angle.

BACKGROUND: The background outside the book cover boundary must be FULLY TRANSPARENT. The book cover edges go all the way to the image borders — the entire image IS the book cover face, with no margins, no shadow, no background color.

COVER MATERIAL: Rich textured hardcover material (leather, cloth, or premium binding) covering the entire image. The cover fills edge-to-edge.

CENTER ZONE: The middle area of the cover (roughly 30–70% width, 25–75% height) must be LEFT COMPLETELY CLEAR — smooth background texture only, no illustrations overlapping this zone. This space will show the book title and "Open the Book" button as overlays.

CORNER DECORATIONS: Place rich, THREE-DIMENSIONAL sculptural objects ONLY in the four corners of the cover. These should look physically real — like miniature bronze, gold, or pewter figurines bolted onto the cover surface, with proper shadows cast onto the cover, depth, and material texture. They should appear raised above the cover surface. NOT flat 2D artwork.

BORDER: Thin ornate gold or metallic decorative border/frame around the entire edge of the cover.

LIGHTING: Soft directional lighting from above to give the 3D corner objects depth and shadow while keeping the cover face flat and front-facing.

NO TEXT, words, or typography anywhere on the image.
NO BACKGROUND — fully transparent outside the cover boundaries.
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
      const editPrompt = `${changePrompt.trim()}\n\nPreserve: perfectly flat front-facing book cover (no angle, no spine), transparent background outside the cover, clear center zone, 3D sculptural corner ornaments with shadows. No text.`
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
