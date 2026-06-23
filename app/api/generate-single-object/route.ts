// app/api/generate-single-object/route.ts
//
// Generates ONE object image using gpt-image-2 and uploads it.
// Called sequentially per-object so each one appears in the UI as soon as ready.
// Single request timeline: ~15-30s (well within any serverless timeout).
//
// POST body:
//   {
//     label:        string   — display name (e.g. "weather vane rooster")
//     prompt:       string   — enriched image prompt from enrich-all-clusters
//     clusterIndex: 0|1|2|3 — corner cluster this object belongs to
//     objectIndex:  number   — position within cluster (0,1,2) — used for file naming
//   }
//
// Returns:
//   { label: string; imageUrl: string; clusterIndex: number }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300  // gpt-image-2 high quality can take 60-120s; 300s is the max allowed

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: roles } = await supabase
      .from('user_roles').select('roles!inner(name)').eq('user_id', session.user.id).is('class_id', null)
    const isAdmin = (roles as any[])?.some((r: any) => r.roles?.name === 'administrator' || r.roles?.name === 'teacher')
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { label, prompt, clusterIndex, objectIndex } = await request.json()
    if (!label?.trim() || !prompt?.trim()) {
      return NextResponse.json({ error: 'label and prompt are required' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    const fullPrompt = `${prompt.trim()}

RENDERING REQUIREMENTS (MANDATORY):
• FULLY TRANSPARENT BACKGROUND — alpha = 0 everywhere outside the object. No dark backdrop, colour fill, gradient, or vignette. The object floats on pure transparency.
• 3D photorealistic render — sharp specular highlights on metal/glass, subsurface scattering on organic/translucent materials, realistic micro-surface detail.
• Object fills 60-70% of the 1024×1024 frame; generous transparent padding on all sides.
• Single soft drop shadow directly beneath the object — the ONLY non-transparent pixels outside the object silhouette.
• Natural material colours preserved: brass is golden-brown, copper is reddish-orange, iron is dark grey, wood is warm brown.
• Output: RGBA PNG with genuine per-pixel transparency.`

    // Generate the image
    const genRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt: fullPrompt,
        n: 1,
        size: '1024x1024',
        output_format: 'png',
        quality: 'high',
      }),
    })

    if (!genRes.ok) {
      const errText = await genRes.text()
      return NextResponse.json(
        { error: `gpt-image-2 failed (${genRes.status}): ${errText.slice(0, 300)}` },
        { status: 500 }
      )
    }

    const genData = await genRes.json()
    const b64: string | undefined = genData.data?.[0]?.b64_json
    if (!b64) return NextResponse.json({ error: 'No image data returned from gpt-image-2' }, { status: 500 })

    // Upload to Supabase storage
    const uid = session.user.id
    const ts = Date.now()
    const slug = String(label).replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 30)
    const ci = Number(clusterIndex) >= 0 ? Number(clusterIndex) : 0
    const oi = Number(objectIndex) >= 0 ? Number(objectIndex) : 0
    const filePath = `${uid}/obj-c${ci}-${oi}-${ts}-${slug}.png`

    const buf = Buffer.from(b64, 'base64')
    const { error: uploadErr } = await supabase.storage
      .from('book-skins')
      .upload(filePath, buf, { contentType: 'image/png', upsert: false })

    if (uploadErr) {
      return NextResponse.json({ error: 'Storage upload failed: ' + uploadErr.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from('book-skins').getPublicUrl(filePath)

    return NextResponse.json({ label: label.trim(), imageUrl: publicUrl, clusterIndex: ci })
  } catch (err: any) {
    console.error('[generate-single-object] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
