// app/api/generate-cluster-objects/route.ts
//
// Generates 3 object images from ONE corner cluster using gpt-image-2.
// Accepts pre-enriched prompts (from /api/enrich-cluster-items) so this
// endpoint only does image generation + upload — no GPT-4o overhead.
// Fits comfortably within 60s (3 parallel gpt-image-2 calls ~20-40s each).
//
// POST body:
//   {
//     items: { label: string; prompt: string }[]  — enriched prompts from enrich-cluster-items
//     clusterIndex: 0 | 1 | 2 | 3                — for labelling uploaded files
//   }
//
// Returns:
//   { objects: { label: string; imageUrl: string }[]; clusterIndex: number; errors?: string[] }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120  // 3 parallel gpt-image-2 calls; should complete in 40-60s

// ── Call gpt-image-2 for one object ───────────────────────────────────────
async function generateObject(apiKey: string, enrichedPrompt: string): Promise<string> {
  const fullPrompt = `${enrichedPrompt}

RENDERING REQUIREMENTS (MANDATORY):
• FULLY TRANSPARENT BACKGROUND — alpha = 0 everywhere outside the object. No dark backdrop, colour fill, gradient, or vignette. The object must float on pure transparency.
• 3D photorealistic render — specular highlights on metal/glass, subsurface scattering on organic materials, realistic micro-surface detail.
• Object fills 60-70% of the 1024×1024 frame; generous transparent padding on all sides.
• Single soft drop shadow directly beneath the object — the ONLY non-transparent area outside the object silhouette.
• Natural material colours: brass is golden-brown, copper is reddish-orange, iron is dark grey, wood is warm brown — do NOT alter the object's fundamental material.
• Output: RGBA PNG with genuine per-pixel transparency.`

  const res = await fetch('https://api.openai.com/v1/images/generations', {
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

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`gpt-image-2 failed (${res.status}): ${errText.slice(0, 300)}`)
  }
  const data = await res.json()
  const b64: string | undefined = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data returned from gpt-image-2')
  return b64
}

// ── Upload base64 PNG to Supabase storage ─────────────────────────────────
async function uploadPng(supabase: any, b64: string, path: string): Promise<string> {
  const buf = Buffer.from(b64, 'base64')
  const { error } = await supabase.storage
    .from('book-skins')
    .upload(path, buf, { contentType: 'image/png', upsert: false })
  if (error) throw new Error('Storage upload failed: ' + error.message)
  const { data: { publicUrl } } = supabase.storage.from('book-skins').getPublicUrl(path)
  return publicUrl
}

// ── Route handler ─────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: roles } = await supabase
      .from('user_roles').select('roles!inner(name)').eq('user_id', session.user.id).is('class_id', null)
    const isAdmin = (roles as any[])?.some((r: any) => r.roles?.name === 'administrator' || r.roles?.name === 'teacher')
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { items, clusterIndex } = await request.json()
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array required' }, { status: 400 })
    }
    const idx = Number(clusterIndex)
    if (isNaN(idx) || idx < 0 || idx > 3) {
      return NextResponse.json({ error: 'clusterIndex must be 0–3' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    const uid = session.user.id
    const ts = Date.now()

    // Generate all items in parallel — only 3 simultaneous calls, safe for rate limits
    const genResults = await Promise.allSettled(
      items.map((item: { label: string; prompt: string }) => generateObject(apiKey, item.prompt))
    )

    const objects: { label: string; imageUrl: string }[] = []
    const errors: string[] = []

    for (let i = 0; i < genResults.length; i++) {
      const result = genResults[i]
      const label: string = items[i]?.label ?? `object-${i}`

      if (result.status === 'rejected') {
        const msg = result.reason?.message ?? 'unknown error'
        console.warn(`[generate-cluster-objects] cluster=${idx} item="${label}" FAILED:`, msg)
        errors.push(`${label}: ${msg}`)
        continue
      }

      try {
        const slug = label.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 30)
        const filePath = `${uid}/cluster${idx}-${ts}-${i}-${slug}.png`
        const publicUrl = await uploadPng(supabase, result.value, filePath)
        objects.push({ label, imageUrl: publicUrl })
      } catch (uploadErr: any) {
        const msg = uploadErr.message ?? 'upload error'
        console.warn(`[generate-cluster-objects] upload failed for "${label}":`, msg)
        errors.push(`${label} (upload): ${msg}`)
      }
    }

    return NextResponse.json({
      objects,
      clusterIndex: idx,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('[generate-cluster-objects] fatal error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
