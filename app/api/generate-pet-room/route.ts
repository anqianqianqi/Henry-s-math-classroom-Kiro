// app/api/generate-pet-room/route.ts
//
// Generates a pet room background image using GPT Image 2 (gpt-image-2),
// uploads the result to Supabase storage, and inserts a row in
// pet_room_backgrounds so it immediately appears in the pet room picker.
//
// Where the room is shown, and the size to ask for, both live in
// lib/petRoom/promptContext.ts — see the note there on why they are not
// written out here.
//
// POST body: { prompt: string, name: string, description?: string, setDefault?: boolean }
// Returns:   { id, image_url, name }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { PET_AREA_CONTEXT, PET_ROOM_IMAGE_SIZE } from '@/lib/petRoom/promptContext'

export const dynamic = 'force-dynamic'


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
    const { prompt, name, description, setDefault = false } = await request.json()
    if (!prompt?.trim()) return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    if (!name?.trim())   return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    // ── Compose full prompt (user prompt + pet area context) ─────────────────
    const fullPrompt = `${prompt.trim()}\n\n${PET_AREA_CONTEXT}`

    // ── Call GPT Image 2 via Responses API ───────────────────────────────────
        const imageRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt: fullPrompt,
        n: 1,
        size: PET_ROOM_IMAGE_SIZE,
        output_format: 'png',
        quality: 'high',
      }),
    })

    if (!imageRes.ok) {
      const errText = await imageRes.text()
      console.error('[generate-pet-room] OpenAI error:', errText)
      return NextResponse.json({ error: `Image generation failed: ${imageRes.status} ${imageRes.statusText}` }, { status: 502 })
    }

    const imageData = await imageRes.json()
    // GPT Image 2 returns base64 in data[0].b64_json
    const b64 = imageData.data?.[0]?.b64_json
    if (!b64) {
      console.error('[generate-pet-room] No b64_json in response:', JSON.stringify(imageData).slice(0, 500))
      return NextResponse.json({ error: 'No image data returned from OpenAI' }, { status: 502 })
    }

    // ── Upload PNG to Supabase storage (challenge-images bucket) ────────────
    // Path must start with the user's ID to satisfy the bucket RLS policy:
    // (storage.foldername(name))[1] = auth.uid()::text
    const buffer = Buffer.from(b64, 'base64')
    const fileName = `${session.user.id}/pet-room-bg-${Date.now()}.png`

    const { error: uploadErr } = await supabase.storage
      .from('challenge-images')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: false })

    if (uploadErr) {
      console.error('[generate-pet-room] Storage upload error:', uploadErr)
      return NextResponse.json({ error: 'Failed to upload image: ' + uploadErr.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('challenge-images')
      .getPublicUrl(fileName)

    // ── If setDefault, clear existing default ────────────────────────────────
    if (setDefault) {
      await supabase
        .from('pet_room_backgrounds')
        .update({ is_default: false })
        .eq('is_default', true)
    }

    // ── Insert into pet_room_backgrounds ─────────────────────────────────────
    const { data: newBg, error: insertErr } = await supabase
      .from('pet_room_backgrounds')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        image_url: publicUrl,
        prompt: prompt.trim(),   // store original prompt for iterative refinement
        is_default: setDefault,
        is_active: true,
        created_by: session.user.id,
        // Default wall-frame slot — positioned in upper-right area of image
        frame_slots: [
          { id: 'wall_frame', x: 60, y: 6, w: 20, h: 30, z_index: 2, label: 'Wall Picture', default_image_url: null }
        ],
      })
      .select('id, name, image_url, prompt')
      .single()

    if (insertErr || !newBg) {
      console.error('[generate-pet-room] DB insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to save background: ' + insertErr?.message }, { status: 500 })
    }

    return NextResponse.json(newBg)
  } catch (err: any) {
    console.error('[generate-pet-room] Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
