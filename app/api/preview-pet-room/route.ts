// app/api/preview-pet-room/route.ts
//
// Generates a pet room image and uploads it to storage but does NOT insert
// a pet_room_backgrounds row. Returns the public URL so the admin can iterate
// before deciding to save.
//
// POST body: { prompt: string, sourceImageUrl?: string, changePrompt?: string }
//   - prompt only        → fresh generation
//   - sourceImageUrl + changePrompt → edit/refine existing image
// Returns: { image_url, prompt: string (accumulated) }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PET_AREA_CONTEXT = `
The image will be used as a background for a pet area on a web dashboard.
Landscape orientation (wider than tall, 3:2 aspect ratio).
Leave the lower-centre clear — a small cat sits there.
Wall art / picture frames should be clearly defined rectangular areas.
Style: anime / Studio Ghibli cozy interior.
`.trim()

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

    let b64: string
    let accumulatedPrompt: string

    if (sourceImageUrl && changePrompt?.trim()) {
      // ── Refine mode: images.edit ────────────────────────────────────────
      if (!changePrompt.trim()) return NextResponse.json({ error: 'changePrompt required for refinement' }, { status: 400 })

      const imgRes = await fetch(sourceImageUrl)
      if (!imgRes.ok) return NextResponse.json({ error: 'Could not fetch source image' }, { status: 502 })
      const imgBuffer = await imgRes.arrayBuffer()
      const imgBlob = new Blob([imgBuffer], { type: 'image/png' })

      const editPrompt = `${changePrompt.trim()}\n\nPreserve:\n${PET_AREA_CONTEXT}`
      const formData = new FormData()
      formData.append('model', 'gpt-image-1')
      formData.append('image', imgBlob, 'source.png')
      formData.append('prompt', editPrompt)
      formData.append('n', '1')
      formData.append('size', '1536x1024')

      const editRes = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData,
      })
      if (!editRes.ok) {
        const errText = await editRes.text()
        console.error('[preview-pet-room] edit error:', errText)
        return NextResponse.json({ error: `Image edit failed: ${editRes.status}` }, { status: 502 })
      }
      const editData = await editRes.json()
      b64 = editData.data?.[0]?.b64_json
      if (!b64) return NextResponse.json({ error: 'No image data from OpenAI' }, { status: 502 })

      const base = prompt?.trim() ?? ''
      accumulatedPrompt = base ? `${base}\n\n[Refinement] ${changePrompt.trim()}` : changePrompt.trim()

    } else {
      // ── Generate from scratch ────────────────────────────────────────────
      if (!prompt?.trim()) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

      const fullPrompt = `${prompt.trim()}\n\n${PET_AREA_CONTEXT}`
      const genRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-image-1', prompt: fullPrompt, n: 1, size: '1536x1024', output_format: 'png', quality: 'high' }),
      })
      if (!genRes.ok) {
        const errText = await genRes.text()
        console.error('[preview-pet-room] gen error:', errText)
        return NextResponse.json({ error: `Generation failed: ${genRes.status}` }, { status: 502 })
      }
      const genData = await genRes.json()
      b64 = genData.data?.[0]?.b64_json
      if (!b64) return NextResponse.json({ error: 'No image data from OpenAI' }, { status: 502 })
      accumulatedPrompt = prompt.trim()
    }

    // Upload to storage (user-prefixed path, not saved to DB)
    const buffer = Buffer.from(b64, 'base64')
    const fileName = `${session.user.id}/pet-room-preview-${Date.now()}.png`
    const { error: uploadErr } = await supabase.storage
      .from('challenge-images')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: false })
    if (uploadErr) return NextResponse.json({ error: 'Storage upload failed: ' + uploadErr.message }, { status: 500 })

    const { data: { publicUrl } } = supabase.storage.from('challenge-images').getPublicUrl(fileName)

    return NextResponse.json({ image_url: publicUrl, prompt: accumulatedPrompt })
  } catch (err: any) {
    console.error('[preview-pet-room] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
