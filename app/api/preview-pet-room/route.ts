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
import { PET_AREA_CONTEXT, PET_ROOM_IMAGE_SIZE } from '@/lib/petRoom/promptContext'

export const dynamic = 'force-dynamic'

// The shared context says where the room is shown and what shape it must be;
// what follows is only what THIS step needs on top of it — an empty room with
// a blank patch for the frame that step two paints on.
const ROOM_CONTEXT = `
${PET_AREA_CONTEXT}

STRICT RULES for this step — follow exactly:
1. NO animals, cats, pets, or any characters in the scene.
2. On the upper-right wall area (roughly 60-80% from left, 5-38% from top), include a FLAT BLANK WALL SPACE — a uniform-coloured rectangle with ZERO decoration or texture variation. This will receive a picture frame in the next step.
3. Lower-centre floor should be clear — no furniture blocking it.
`.trim()

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
    body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size: PET_ROOM_IMAGE_SIZE, output_format: 'png', quality: 'high' }),
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
  form.append('image', imgBlob, 'room.png')
  form.append('prompt', editPrompt)
  form.append('n', '1')
  form.append('size', PET_ROOM_IMAGE_SIZE)
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
      const roomB64 = await callGenerations(apiKey, `${prompt.trim()}\n\n${ROOM_CONTEXT}`)

      // Upload intermediate room so images.edit can fetch it via URL
      const roomBuf = Buffer.from(roomB64, 'base64')
      const roomFile = `${uid}/pet-room-step1-${ts}.png`
      const { error: r1Err } = await supabase.storage.from('challenge-images').upload(roomFile, roomBuf, { contentType: 'image/png', upsert: false })
      if (r1Err) throw new Error('Step1 upload failed: ' + r1Err.message)
      const { data: { publicUrl: roomUrl } } = supabase.storage.from('challenge-images').getPublicUrl(roomFile)

      // Step 2: bake frame onto the room
      finalB64 = await callEdit(apiKey, roomUrl, FRAME_EDIT_PROMPT)
      accumulatedPrompt = prompt.trim()
    }

    // Upload final combined image
    const finalBuf = Buffer.from(finalB64, 'base64')
    const finalFile = `${uid}/pet-room-preview-${ts}.png`
    const { error: finalErr } = await supabase.storage.from('challenge-images').upload(finalFile, finalBuf, { contentType: 'image/png', upsert: false })
    if (finalErr) return NextResponse.json({ error: 'Final upload failed: ' + finalErr.message }, { status: 500 })
    const { data: { publicUrl: finalUrl } } = supabase.storage.from('challenge-images').getPublicUrl(finalFile)

    return NextResponse.json({
      image_url: finalUrl,
      frame_overlay_url: null,   // frame is baked into the room image
      frame_slot: null,          // admin sets this via 📐 Adjust Frame after saving
      prompt: accumulatedPrompt,
    })
  } catch (err: any) {
    console.error('[preview-pet-room] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
