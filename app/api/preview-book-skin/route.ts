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

CANVAS: The output image is exactly 1024 pixels wide × 1536 pixels tall. The entire canvas is the book cover — no transparent margins, no padding, no letterboxing. The book cover rectangle fills from pixel 0,0 to pixel 1024,1536 corner to corner.

BOOK COVER SHAPE: Flat, perfectly straight-on front view, no perspective, no tilt, no foreshortening, no visible spine or side. The cover fills the FULL WIDTH of 1024px and the FULL HEIGHT of 1536px — it is NOT narrower than the canvas. Portrait aspect ratio ~2:3. The cover surface has rich thematic texture near the edges, fading to a smoother tone toward the center. An ornate thin metallic border line runs along the inner perimeter edge.

CORNER CLUSTERS: Each of the four corners contains a DENSE MINI-SCENE — 2–4 closely grouped 3D objects forming a small vignette. The lead object is flanked by smaller props that add context and depth (examples: volcano + lava rocks + ash plume; rocket + launchpad + fuel tank + exhaust smoke; globe + stacked books + compass; crystal + gem shards + glow dust). Clusters are large, richly detailed, with realistic volume, full natural colors, cast shadows on the cover surface, and physically extend past the metallic border frame at the corners.

CENTER ZONE: Keep the central rectangular area (roughly x: 150–870, y: 300–1100) relatively plain and uncluttered — this space is reserved for title and text overlay. Subtle background texture is fine but no objects or large decorations should intrude into this zone.

STYLE: Highly detailed digital illustration, photorealistic lighting on objects, vibrant full color, sharp crisp details at every corner. Ultra high detail — every object richly textured and clearly defined.

ABSOLUTELY NO text, letters, numbers, words, or glyphs anywhere in the image.
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
      output_compression: 0,
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
      const editPrompt = `${changePrompt.trim()}\n\nPreserve: the book cover fills the FULL WIDTH and FULL HEIGHT of the canvas (1024×1536px), flat front-facing portrait rectangle with no margins or padding, corner cluster objects, clear plain center zone, metallic border frame. No text anywhere.`
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
