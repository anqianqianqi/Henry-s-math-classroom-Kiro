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

COMPOSITION: This is a CLOSED HARDCOVER BOOK viewed from the FRONT at a very slight angle (3/4 perspective), so you can see a narrow spine/binding on the left edge of the cover. The book should look like a real physical object — show the book's thickness, the spine with gold lettering edge, slight shadow underneath, and the texture of the cloth or leather cover material. The cover fills most of the image but there is a narrow left spine visible.

COVER SURFACE: The main cover face should have a dark, rich, textured background (leather, cloth, or premium hardcover material). The surface should look physically real — not a digital illustration.

CENTER ZONE: The middle area of the cover face (roughly 30–70% width, 25–75% height) must be LEFT COMPLETELY CLEAR — smooth background texture only, no illustrations or decorations overlapping this zone. This space will show the book title and an "Open the Book" button.

CORNER DECORATIONS: Place rich, three-dimensional illustrated objects ONLY in the four corners of the cover face. These objects should look like they are PHYSICALLY RESTING ON or EMBOSSED INTO the book cover — with proper cast shadows, depth, and materiality (gold, bronze, gemstones, etc.). They should protrude slightly from the cover surface. NOT flat 2D artwork — truly 3D sculptural elements.

BORDER: Include a thin, ornate gold or metallic decorative border/frame around the edges of the cover face.

LIGHTING: Directional lighting from upper-left, creating realistic shadows and highlights that reinforce the book as a physical 3D object sitting in space.

ASPECT RATIO: Portrait, taller than wide (approximately 2:3). The full image should show the book cover as the main subject with dark/shadowed background.

NO TEXT anywhere on the image. No words, titles, or labels.
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
      const editPrompt = `${changePrompt.trim()}\n\nPreserve the physical book appearance: the 3/4 angle showing the spine on the left, the cover texture and depth, the ornate gold border, and the clear center zone. Corner decorations should remain 3D and sculptural. No text anywhere.`
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
