// app/api/generate-single-object/route.ts
//
// Generates ONE object image using gpt-image-2.
// Returns the image as base64 directly — the UI displays it immediately.
// Supabase upload only happens at save time to avoid the upload latency penalty.
//
// POST body:
//   {
//     label:        string   — display name (e.g. "weather vane rooster")
//     prompt:       string   — enriched image prompt from enrich-cluster-items
//     clusterIndex: 0|1|2|3 — corner cluster this object belongs to
//     objectIndex:  number   — position within cluster (0,1,2) — used for file naming
//   }
//
// Returns:
//   { label: string; b64: string; clusterIndex: number }
//   (b64 is a data:image/png;base64,... URI ready to set as <img src>)

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300  // gpt-image-2 high quality can take 60-120s; 300s is the max

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

    // The enriched prompt already contains the full thematic description and colour cues.
    // The rendering block below adds only the technical output requirements — it does NOT
    // override material colours (those come from the enriched prompt above).
    const fullPrompt = `${prompt.trim()}

TECHNICAL RENDERING REQUIREMENTS:
• REAL PHYSICAL OBJECT — render this as an actual item, NOT a sculpture, statuette, or monochrome cast. Keep the object's real identity and material nature.
• NATURAL MATERIAL COLOURS — show the object's actual material colours as described above. The thematic atmosphere affects the surface condition (weathering, ambient light, patina) but NOT the fundamental material — a brass dial stays brass, glass stays glass, leather stays leather.
• FULLY TRANSPARENT BACKGROUND — alpha = 0 everywhere outside the object and its shadow. No white fill, no light backdrop, no gradient, no vignette behind the object.
• SHADOW — render a single soft, dark semi-transparent drop shadow directly beneath the object, cast onto the transparent canvas. The shadow must be dark (dark grey/brown, NOT white or light), soft-edged, and fully transparent where it fades out. It should look exactly like the shadow you see on baked-in book cover assets — grounded and realistic.
• Warm directional lighting from slightly above-left; sharp specular on metal and glass; soft depth cues on organic materials.
• Object fills 60-70% of the 1024×1024 frame; generous transparent padding on all sides.
• Output: RGBA PNG with genuine per-pixel transparency — object + shadow visible, everything else alpha = 0.`

    // Generate the image
    const genRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: fullPrompt,
        n: 1,
        size: '1024x1024',
        output_format: 'png',
        background: 'transparent',
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
    const b64raw: string | undefined = genData.data?.[0]?.b64_json
    if (!b64raw) return NextResponse.json({ error: 'No image data returned from gpt-image-2' }, { status: 500 })

    // Return base64 directly — UI displays immediately, upload happens at save time
    const ci = Number(clusterIndex) >= 0 ? Number(clusterIndex) : 0
    const dataUri = `data:image/png;base64,${b64raw}`

    return NextResponse.json({
      label: label.trim(),
      b64: dataUri,          // browser-ready data URI for immediate display
      b64raw,                // raw base64 for upload at save time
      clusterIndex: ci,
      objectIndex: Number(objectIndex) >= 0 ? Number(objectIndex) : 0,
    })
  } catch (err: any) {
    console.error('[generate-single-object] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
