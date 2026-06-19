// app/api/preview-pet-room/route.ts
//
// Generates a pet room image + matching frame overlay and uploads both to
// storage. Does NOT insert a pet_room_backgrounds row — returns URLs so the
// admin can iterate before deciding to save.
//
// POST body: { prompt: string, sourceImageUrl?: string, changePrompt?: string }
//   - prompt only                   → fresh generation (room + frame)
//   - sourceImageUrl + changePrompt → edit/refine room only (frame unchanged)
// Returns:
//   { image_url, frame_overlay_url, frame_slot, prompt }
//
// The frame overlay is 1536×1024 PNG, white background, decorative picture
// frame centered in the upper-right wall area. Rendered in the pet area with
// CSS mix-blend-mode: multiply so white becomes transparent.
//
// frame_slot = { x, y, w, h } as percentages of the full image dimensions,
// defining the inner photo area where the user's blindbox image is placed.

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── Frame slot (as % of 1536×1024) ───────────────────────────────────────────
// Upper-right wall area. Kept consistent across all rooms so compositing is
// predictable. The actual pixel position for 1536×1024:
//   x: 60% → 921px from left
//   y: 6%  → 61px from top
//   w: 20% → 307px wide
//   h: 32% → 327px tall  (≈ square inner area after frame border)
const FRAME_SLOT = { x: 60, y: 6, w: 20, h: 32 }

// ── Room background context ───────────────────────────────────────────────────
const ROOM_CONTEXT = `
The image is a background for a pet area on a web dashboard.
Landscape orientation (wider than tall, 3:2 aspect ratio, 1536x1024 pixels).
Leave the lower-centre clear — a small cat sits there.
On the upper-right area of the wall (approximately 60-80% from the left, 6-38% from the top),
include a FLAT SOLID LIGHT-COLOURED RECTANGLE on the wall — this is a blank wall space
where a decorative picture frame will be overlaid. The rectangle should be a uniform colour
(light beige, cream, or wall colour) with NO detail inside it.
Style: anime / Studio Ghibli cozy interior.
`.trim()

// ── Frame overlay prompt ──────────────────────────────────────────────────────
// The frame is generated separately and composited on top of the room.
// White background → rendered with mix-blend-mode: multiply at runtime.
function buildFramePrompt(roomStyle: string): string {
  return `A single decorative picture frame, anime / Studio Ghibli style matching: ${roomStyle}.
The frame is centered on a pure white background.
The frame occupies roughly the centre 40% of the image (both horizontally and vertically).
The frame has an ornate border — wood, carved, or gilded depending on the room style.
The inner opening of the frame is pure white (completely empty, no image inside).
Everything outside the frame border is pure white.
No shadows, no background room elements, no furniture — only the frame on white.
The frame opening is approximately square (1:1 ratio).
Image size: 1536x1024, landscape.`
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
