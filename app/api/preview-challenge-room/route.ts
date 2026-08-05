// app/api/preview-challenge-room/route.ts
//
// Generates a ChallengeRoom background plate with gpt-image-2 and uploads it to
// the book-skins bucket for preview. Does NOT insert into challenge_rooms — the
// admin tunes book placement against the plate first, then saves.
//
// POST body:
//   { spec }                              → fresh generation
//   { spec, sourceImageUrl, changePrompt } → refine an existing plate
// Returns: { image_url, prompt }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { compileRoomPrompt, validateRoomSpec } from '@/lib/challengeRoom/prompt'
import type { RoomSpec } from '@/lib/types/challengeRoom'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// 3:2 landscape — the plate is the full-page background behind the book.
const ROOM_SIZE = '1536x1024'

async function callGenerations(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt,
      n: 1,
      size: ROOM_SIZE,
      output_format: 'png',
      quality: 'high',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[preview-challenge-room] OpenAI error:', errText.slice(0, 500))
    throw new Error(`Image generation failed: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data returned from OpenAI')
  return b64
}

async function callEdit(apiKey: string, sourceImageUrl: string, editPrompt: string): Promise<string> {
  const srcRes = await fetch(sourceImageUrl)
  if (!srcRes.ok) throw new Error('Could not read the previous room image for refinement')
  const srcBuf = Buffer.from(await srcRes.arrayBuffer())

  const form = new FormData()
  form.append('model', 'gpt-image-2')
  form.append('prompt', editPrompt)
  form.append('n', '1')
  form.append('size', ROOM_SIZE)
  form.append('image', new Blob([srcBuf], { type: 'image/png' }), 'room.png')

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[preview-challenge-room] OpenAI edit error:', errText.slice(0, 500))
    throw new Error(`Image refinement failed: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data returned from OpenAI')
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
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden — admins/teachers only' }, { status: 403 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    const body = await request.json()
    const spec = body.spec as RoomSpec | undefined
    const sourceImageUrl: string | undefined = body.sourceImageUrl
    const changePrompt: string | undefined = body.changePrompt

    if (!spec) return NextResponse.json({ error: 'spec is required' }, { status: 400 })
    const invalid = validateRoomSpec(spec)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const basePrompt = compileRoomPrompt(spec)

    let b64: string
    let accumulatedPrompt: string

    if (sourceImageUrl && changePrompt?.trim()) {
      // Refine: restate the compositing constraints so an edit cannot fill in
      // the central placement zone or shift the camera pitch.
      const editPrompt = [
        changePrompt.trim(),
        '',
        'Preserve exactly: the 3:2 canvas, the downward 40–45 degree camera pitch,',
        'the centered aperture, the broad tabletop across the lower 45%,',
        'and the completely empty central placement zone (no book, paper, cloth,',
        'or ornament in the middle of the table). No text or lettering anywhere.',
      ].join('\n')
      b64 = await callEdit(apiKey, sourceImageUrl, editPrompt)
      accumulatedPrompt = `${basePrompt}\n\n[Refinement] ${changePrompt.trim()}`
    } else {
      b64 = await callGenerations(apiKey, basePrompt)
      accumulatedPrompt = basePrompt
    }

    // Path must start with the user's ID to satisfy the bucket RLS policy:
    // (storage.foldername(name))[1] = auth.uid()::text
    const buffer = Buffer.from(b64, 'base64')
    const fileName = `${session.user.id}/challenge-room-${Date.now()}.png`

    const { error: uploadErr } = await supabase.storage
      .from('book-skins')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: false })

    if (uploadErr) {
      console.error('[preview-challenge-room] Storage upload error:', uploadErr)
      return NextResponse.json({ error: 'Upload failed: ' + uploadErr.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('book-skins')
      .getPublicUrl(fileName)

    return NextResponse.json({ image_url: publicUrl, prompt: accumulatedPrompt })
  } catch (err: any) {
    console.error('[preview-challenge-room] Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
