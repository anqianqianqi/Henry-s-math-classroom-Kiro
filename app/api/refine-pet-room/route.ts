// app/api/refine-pet-room/route.ts
//
// Takes an existing pet_room_backgrounds row and a "what to change" instruction,
// fetches the current image, and calls GPT Image 2 images.edit to produce a
// refined version. The result is saved as a NEW row (original is preserved).
//
// POST body:
//   sourceId    — UUID of the existing pet_room_backgrounds row to refine
//   changePrompt — what to change, e.g. "make the lighting warmer and add a cat on the shelf"
//   name         — name for the new refined background
//   description? — optional description
//   setDefault?  — whether to set new row as default
//
// Returns: { id, image_url, name, prompt }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Same composition context as generate — keeps every iteration aligned
const PET_AREA_CONTEXT = `
The image is a background for a pet area on a web dashboard.
Landscape orientation (wider than tall, 3:2 aspect ratio).
Keep the lower-centre clear — a small cat sits there.
Wall art / picture frames should remain as clearly defined rectangular areas.
Anime / Studio Ghibli cozy interior style.
`.trim()

export async function POST(request: Request) {
  try {
    // ── Auth + role check ────────────────────────────────────────────────────
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
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden — admins/teachers only' }, { status: 403 })

    // ── Parse body ───────────────────────────────────────────────────────────
    const { sourceId, changePrompt, name, description, setDefault = false } = await request.json()
    if (!sourceId)       return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })
    if (!changePrompt?.trim()) return NextResponse.json({ error: 'changePrompt is required' }, { status: 400 })
    if (!name?.trim())   return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    // ── Fetch the source background row ─────────────────────────────────────
    const { data: sourceBg, error: fetchErr } = await supabase
      .from('pet_room_backgrounds')
      .select('id, image_url, prompt, frame_slots')
      .eq('id', sourceId)
      .single()

    if (fetchErr || !sourceBg) {
      return NextResponse.json({ error: 'Source background not found' }, { status: 404 })
    }

    // ── Download the source image ────────────────────────────────────────────
    const imgRes = await fetch(sourceBg.image_url)
    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Failed to download source image' }, { status: 502 })
    }
    const imgBuffer = await imgRes.arrayBuffer()
    const imgBlob = new Blob([imgBuffer], { type: 'image/png' })

    // ── Build the edit prompt ────────────────────────────────────────────────
    // Combine the change instruction with the composition context so the model
    // always respects the pet area constraints, even when making targeted edits.
    const editPrompt = `${changePrompt.trim()}\n\nAdditional constraints to preserve:\n${PET_AREA_CONTEXT}`

    // ── Call images.edit via multipart/form-data ─────────────────────────────
    // GPT Image 2 (gpt-image-1) supports images.edit without a mask —
    // it uses the image as full context and applies the instruction globally.
    const formData = new FormData()
    formData.append('model', 'gpt-image-1')
    formData.append('image', imgBlob, 'source.png')
    formData.append('prompt', editPrompt)
    formData.append('n', '1')
    formData.append('size', '1536x1024')    // same landscape dimensions as generation

    const editRes = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    })

    if (!editRes.ok) {
      const errText = await editRes.text()
      console.error('[refine-pet-room] OpenAI error:', errText)
      return NextResponse.json({ error: `Image edit failed: ${editRes.status} ${editRes.statusText}` }, { status: 502 })
    }

    const editData = await editRes.json()
    const b64 = editData.data?.[0]?.b64_json
    if (!b64) {
      console.error('[refine-pet-room] No b64_json in response:', JSON.stringify(editData).slice(0, 500))
      return NextResponse.json({ error: 'No image data returned from OpenAI' }, { status: 502 })
    }

    // ── Upload refined PNG to Supabase storage ────────────────────────────────
    const buffer = Buffer.from(b64, 'base64')
    const fileName = `pet-room-bg-${Date.now()}.png`

    const { error: uploadErr } = await supabase.storage
      .from('challenge-images')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: false })

    if (uploadErr) {
      console.error('[refine-pet-room] Storage upload error:', uploadErr)
      return NextResponse.json({ error: 'Failed to upload image: ' + uploadErr.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('challenge-images')
      .getPublicUrl(fileName)

    // ── Clear default if requested ────────────────────────────────────────────
    if (setDefault) {
      await supabase
        .from('pet_room_backgrounds')
        .update({ is_default: false })
        .eq('is_default', true)
    }

    // Build the accumulated prompt: original + this refinement step
    const originalPrompt = sourceBg.prompt ?? ''
    const accumulatedPrompt = originalPrompt
      ? `${originalPrompt}\n\n[Refinement] ${changePrompt.trim()}`
      : changePrompt.trim()

    // ── Insert as new row (original preserved) ────────────────────────────────
    const { data: newBg, error: insertErr } = await supabase
      .from('pet_room_backgrounds')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        image_url: publicUrl,
        prompt: accumulatedPrompt,   // full history of prompts for further iteration
        is_default: setDefault,
        is_active: true,
        created_by: session.user.id,
        frame_slots: sourceBg.frame_slots ?? [
          { id: 'wall_frame', x: 60, y: 6, w: 20, h: 30, z_index: 2, label: 'Wall Picture', default_image_url: null }
        ],
      })
      .select('id, name, image_url, prompt')
      .single()

    if (insertErr || !newBg) {
      console.error('[refine-pet-room] DB insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to save refined background: ' + insertErr?.message }, { status: 500 })
    }

    return NextResponse.json(newBg)
  } catch (err: any) {
    console.error('[refine-pet-room] Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
