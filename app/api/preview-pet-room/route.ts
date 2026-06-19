// app/api/preview-pet-room/route.ts
//
// Step 1: Generates a pet room (no cats, blank wall patch).
// Step 2: Uses images.edit on that result to paint a decorative frame
//         onto the blank wall area — frame is baked into the room image.
// No separate frame overlay needed; the admin uses the 📐 slot editor
// to calibrate where the photo goes inside the frame.
//
// POST body:
//   { prompt }                              → fresh generation (room + frame baked in)
//   { prompt, sourceImageUrl, changePrompt } → refine existing room image
// Returns: { image_url, prompt }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── Step 1: clean room prompt ─────────────────────────────────────────────────
const ROOM_CONTEXT = `
STRICT RULES — follow exactly:
1. NO animals, cats, pets, or any characters in the scene.
2. On the upper-right wall area (roughly 60-80% from left, 5-38% from top), include a FLAT BLANK WALL SPACE — a uniform-coloured rectangle with ZERO decoration or texture variation. This will receive a picture frame in the next step.
3. Lower-centre floor should be clear — no furniture blocking it.
4. Landscape orientation, 3:2 aspect ratio, 1536x1024.
5. Anime / Studio Ghibli cozy interior style.
`.trim()

// ── Step 2: bake frame onto room ──────────────────────────────────────────────
const FRAME_EDIT_PROMPT = `Paint a decorative picture frame directly onto the blank wall space in the upper-right area of this room image.
The frame should match the room's art style (anime / Studio Ghibli).
The frame border should be ornate — wood, gilded, or carved.
The inner area of the frame must remain completely empty and light-coloured (show the wall colour through the frame opening).
The frame must fit exactly within the blank wall rectangle that is already there — do not make it larger than that space.
Keep all other parts of the image unchanged.`

async function callGenerations(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size: '1536x1024', output_format: 'png', quality: 'high' }),
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
  form.append('image', imgBlob, 'room.png')
  form.append('prompt', editPrompt)
  form.append('n', '1')
  form.append('size', '1536x1024')
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
      // ── Refine mode: edit the existing room+frame image ───────────────────
      const editPrompt = `${changePrompt.trim()}\n\nPreserve the decorative picture frame on the wall. Keep all other rules: no animals or characters, clear lower-centre floor.`
      finalB64 = await callEdit(apiKey, sourceImageUrl, editPrompt)
      const base = prompt?.trim() ?? ''
      accumulatedPrompt = base ? `${base}\n\n[Refinement] ${changePrompt.trim()}` : changePrompt.trim()

    } else {
      // ── Fresh generation: room → then bake frame onto it ─────────────────
      if (!prompt?.trim()) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

      // Step 1: generate clean room with blank wall patch
      const roomPrompt = `${prompt.trim()}\n\n${ROOM_CONTEXT}`
      const roomB64 = await callGenerations(apiKey, roomPrompt)

      // Upload intermediate room (so images.edit can fetch it)
      const roomBuf = Buffer.from(roomB64, 'base64')
      const roomFile = `${uid}/pet-room-step1-${ts}.png`
      const { error: r1Err } = await supabase.storage.from('challenge-images').upload(roomFile, roomBuf, { contentType: 'image/png', upsert: false })
      if (r1Err) throw new Error('Step1 upload failed: ' + r1Err.message)
      const { data: { publicUrl: roomUrl } } = supabase.storage.from('challenge-images').getPublicUrl(roomFile)

      // Step 2: bake frame onto the room
      const framedB64 = await callEdit(apiKey, roomUrl, FRAME_EDIT_PROMPT)
      finalB64 = framedB64
      accumulatedPrompt = prompt.trim()
    }

    // Upload final image
    const finalBuf = Buffer.from(finalB64, 'base64')
    const finalFile = `${uid}/pet-room-preview-${ts}.png`
    const { error: finalErr } = await supabase.storage.from('challenge-images').upload(finalFile, finalBuf, { contentType: 'image/png', upsert: false })
    if (finalErr) return NextResponse.json({ error: 'Final upload failed: ' + finalErr.message }, { status: 500 })
    const { data: { publicUrl: finalUrl } } = supabase.storage.from('challenge-images').getPublicUrl(finalFile)

    return NextResponse.json({
      image_url: finalUrl,
      frame_overlay_url: null,   // no longer used — frame is baked into the room
      frame_slot: null,          // admin sets this via the slot editor after saving
      prompt: accumulatedPrompt,
    })
  } catch (err: any) {
    console.error('[preview-pet-room] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}


import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── Frame slot (as % of 1536×1024) ───────────────────────────────────────────
// Upper-right wall area. A small-to-medium picture frame on the wall.
// Pixel position for 1536×1024:
//   x: 62% → ~952px from left
//   y: 8%  → ~82px from top
//   w: 18% → ~276px wide
//   h: 28% → ~287px tall (close to square inner area)
const FRAME_SLOT = { x: 62, y: 8, w: 18, h: 28 }

// ── Room background context ───────────────────────────────────────────────────
const ROOM_CONTEXT = `
IMPORTANT COMPOSITION RULES — follow exactly:
1. This is a BACKGROUND image only. Do NOT include any animals, cats, pets, or characters.
2. On the upper-right portion of the wall (roughly the area 62% to 80% from left, 8% to 36% from top), paint a plain empty rectangular patch of flat uniform wall colour (cream, beige, or light grey). This patch should look like a blank section of wall — NO artwork, NO decoration, NO texture variation inside this rectangle. It will have a picture frame overlaid on top later.
3. The lower-centre of the image should be clear floor space (no furniture blocking it).
4. Landscape orientation, 3:2 aspect ratio.
5. Anime / Studio Ghibli interior style.
`.trim()

// ── Frame overlay prompt ──────────────────────────────────────────────────────
function buildFramePrompt(roomStyle: string): string {
  return `A single decorative picture frame on a pure white background.
Style: anime / Studio Ghibli, matching this room: ${roomStyle}.
IMPORTANT RULES:
- The frame is SMALL — it occupies only about 20% of the image width and 30% of the image height, positioned in the upper-right area of the canvas.
- The frame has a decorative border — wood, gilded, or carved.
- The inside of the frame is completely empty — pure white, no image inside.
- Everything outside the frame border is pure white.
- No room, no background, no shadows, no furniture — just the frame on white.
- The frame opening is approximately square (1:1 ratio).
Image canvas: 1536x1024 landscape. Frame positioned at roughly 62-80% from left, 8-36% from top.`
}

async function generateImage(
  apiKey: string,
  prompt: string,
  size: string = '1536x1024',
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size, output_format: 'png', quality: 'high' }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Image generation failed (${res.status}): ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data returned from OpenAI')
  return b64
}

async function editImage(
  apiKey: string,
  sourceUrl: string,
  prompt: string,
): Promise<string> {
  const imgRes = await fetch(sourceUrl)
  if (!imgRes.ok) throw new Error('Could not fetch source image')
  const imgBuffer = await imgRes.arrayBuffer()
  const imgBlob = new Blob([imgBuffer], { type: 'image/png' })

  const formData = new FormData()
  formData.append('model', 'gpt-image-1')
  formData.append('image', imgBlob, 'source.png')
  formData.append('prompt', prompt)
  formData.append('n', '1')
  formData.append('size', '1536x1024')

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Image edit failed (${res.status}): ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data from OpenAI edit')
  return b64
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: roles } = await supabase
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', session.user.id)
      .is('class_id', null)
    const isAdmin = (roles as any[])?.some((r: any) =>
      r.roles?.name === 'administrator' || r.roles?.name === 'teacher'
    )
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { prompt, sourceImageUrl, changePrompt } = await request.json()
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    const uid = session.user.id
    const ts = Date.now()
    let roomB64: string
    let frameB64: string | null = null
    let accumulatedPrompt: string

    if (sourceImageUrl && changePrompt?.trim()) {
      // ── Refine mode: edit room only, reuse existing frame ─────────────────
      const editPrompt = `${changePrompt.trim()}\n\nPreserve:\n${ROOM_CONTEXT}`
      roomB64 = await editImage(apiKey, sourceImageUrl, editPrompt)
      const base = prompt?.trim() ?? ''
      accumulatedPrompt = base ? `${base}\n\n[Refinement] ${changePrompt.trim()}` : changePrompt.trim()
      // Don't regenerate frame on refinements — caller passes existing frame_overlay_url
    } else {
      // ── Fresh generation: room + frame ────────────────────────────────────
      if (!prompt?.trim()) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

      const roomPrompt = `${prompt.trim()}\n\n${ROOM_CONTEXT}`
      const framePrompt = buildFramePrompt(prompt.trim())

      // Generate room and frame in parallel
      const [rb64, fb64] = await Promise.all([
        generateImage(apiKey, roomPrompt),
        generateImage(apiKey, framePrompt),
      ])
      roomB64 = rb64
      frameB64 = fb64
      accumulatedPrompt = prompt.trim()
    }

    // ── Upload room background ────────────────────────────────────────────
    const roomBuf = Buffer.from(roomB64, 'base64')
    const roomFile = `${uid}/pet-room-preview-${ts}.png`
    const { error: roomUploadErr } = await supabase.storage
      .from('challenge-images')
      .upload(roomFile, roomBuf, { contentType: 'image/png', upsert: false })
    if (roomUploadErr) return NextResponse.json({ error: 'Room upload failed: ' + roomUploadErr.message }, { status: 500 })
    const { data: { publicUrl: roomUrl } } = supabase.storage.from('challenge-images').getPublicUrl(roomFile)

    // ── Upload frame overlay (fresh generation only) ──────────────────────
    let frameOverlayUrl: string | null = null
    if (frameB64) {
      const frameBuf = Buffer.from(frameB64, 'base64')
      const frameFile = `${uid}/pet-room-frame-${ts}.png`
      const { error: frameUploadErr } = await supabase.storage
        .from('challenge-images')
        .upload(frameFile, frameBuf, { contentType: 'image/png', upsert: false })
      if (!frameUploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('challenge-images').getPublicUrl(frameFile)
        frameOverlayUrl = publicUrl
      }
      // Frame upload failure is non-fatal — room still usable without frame
    }

    return NextResponse.json({
      image_url: roomUrl,
      frame_overlay_url: frameOverlayUrl,
      frame_slot: frameOverlayUrl ? FRAME_SLOT : null,
      prompt: accumulatedPrompt,
    })
  } catch (err: any) {
    console.error('[preview-pet-room] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
