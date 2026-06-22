// app/api/generate-cluster-objects/route.ts
//
// Generates 3 individual objects from ONE corner cluster of a book cover prompt.
// Called 4 times sequentially by the UI (once per corner cluster) so results
// appear progressively rather than waiting for all 12 objects at once.
//
// POST body:
//   {
//     coverPrompt:  string   — full original prompt (background + all corner clusters)
//     clusterIndex: 0 | 1 | 2 | 3   — which cluster to generate (top-left → bottom-right)
//   }
//
// Returns:
//   { objects: { label: string; imageUrl: string }[]; clusterIndex: number }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120   // 3 parallel image gens should complete well within 2 min

const CORNER_NAMES = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

// ── Parse a single cluster's items ────────────────────────────────────────
// e.g. "[weather vane rooster + barometer + raindrops]" → ["weather vane rooster", "barometer", "raindrops"]
function parseCluster(coverPrompt: string, clusterIndex: number): string[] {
  const matches = coverPrompt.match(/\[([^\]]+)\]/g)
  if (!matches || !matches[clusterIndex]) return []
  const inner = matches[clusterIndex].replace(/^\[|\]$/g, '').trim()
  return inner.split(/\s*\+\s*/).map(s => s.trim()).filter(Boolean).slice(0, 3)
}

// ── Ask GPT-4o to enrich each item's description coherent with the cover theme ──
async function enrichItems(
  apiKey: string,
  items: string[],
  coverPrompt: string,
  corner: string,
): Promise<{ label: string; prompt: string }[]> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert art director crafting image generation prompts for isolated 3D decorative objects destined for the ${corner} corner of a themed hardcover book.

Each object must look like a PHYSICAL PROP that belongs in this book's world — rendered as a richly detailed 3D object sitting in natural lighting, as if placed directly onto the book cover. Think museum-quality prop photography.

RULES:
1. PRESERVE THE OBJECT'S NATURAL MATERIAL — brass stays brass, iron stays iron, glass stays glass, leather stays leather. Don't change the object into something else.
2. APPLY THEMATIC SURFACE TREATMENT — the book's atmosphere affects the object's surface condition:
   - Stormy/electric → rain-streaked surfaces, condensation on glass, electric-blue ambient light, water beading on metal
   - Volcanic/fire → ember-orange underside glow, soot-darkened patina, heat-cracked enamel, faint magma shimmer
   - Underwater/ocean → barnacle-crusted edges, verdigris patina, bioluminescent speckle, kelp-green tint on aged metal
   - Arctic/frost → rime frost on edges, cold-blue rim light, ice crystal deposits, breath-fogged glass
   - Magic/fantasy → faint rune engravings glowing softly, iridescent sheen at seams, mana-dust particles nearby
   - Steampunk → copper-green patina, riveted seams, oil stain rings, gear-tooth engravings
   - Ancient/parchment → aged ochre stain, worn gilding, cracked leather, patinated bronze fittings
3. LIGHTING: warm, directional — as if lit from slightly above-left, casting one soft shadow beneath
4. COMPOSITION: object centred, filling 60–70% of frame, generous padding on all sides
5. TRANSPARENT BACKGROUND: pure alpha=0 outside the object boundary; one soft ground shadow only
6. RENDER QUALITY: photorealistic 3D, subsurface scattering on organic materials, sharp specular on metal/glass, micro surface detail
7. NO text, no book surface, no other objects in the frame

Respond ONLY with valid JSON: [{"label":"short name","prompt":"full image gen prompt (max 120 words)"},...]`,
        },
        {
          role: 'user',
          content: `Full book cover theme:\n"${coverPrompt}"\n\nGenerate enriched prompts for these 3 objects in the ${corner} corner cluster:\n${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}`,
        },
      ],
      max_tokens: 1800,
      temperature: 0.4,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`GPT-4o enrichment failed (${res.status}): ${errText.slice(0, 200)}`)
  }
  const data = await res.json()
  const raw: string = data.choices?.[0]?.message?.content?.trim() ?? '[]'
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    const arr: any[] = match ? JSON.parse(match[0]) : []
    const valid = arr
      .filter((o: any) => o.label && o.prompt)
      .map((o: any) => ({ label: String(o.label).trim(), prompt: String(o.prompt).trim() }))
    if (valid.length > 0) return valid
  } catch { /* fall through to fallback */ }

  // Fallback: build basic themed prompts without GPT-4o
  const themeHint = coverPrompt.split(',')[0].trim()
  return items.map(item => ({
    label: item,
    prompt: `A single isolated 3D decorative prop: "${item}". Natural real-world materials shaped by the atmosphere of: "${themeHint}". Warm directional lighting from above-left. Object centred, filling 65% of frame, transparent RGBA background (alpha=0 outside), one soft ground shadow. Photorealistic, no text, no background fill.`,
  }))
}

// ── Call gpt-image-2 for one object ───────────────────────────────────────
async function generateObject(apiKey: string, enrichedPrompt: string): Promise<string> {
  const fullPrompt = `${enrichedPrompt}

RENDERING REQUIREMENTS (MANDATORY):
• FULLY TRANSPARENT BACKGROUND — alpha = 0 everywhere outside the object. Absolutely no dark backdrop, colour fill, gradient, or vignette. The object must float on pure transparency.
• 3D photorealistic render — specular highlights, realistic shadows between surfaces, subsurface scattering on organic/translucent materials.
• Object fills 60-70% of the 1024×1024 frame; generous transparent padding on all sides.
• Single soft drop shadow directly beneath the object — this is the ONLY non-transparent area outside the object silhouette.
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
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', session.user.id)
      .is('class_id', null)
    const isAdmin = (roles as any[])?.some(
      (r: any) => r.roles?.name === 'administrator' || r.roles?.name === 'teacher'
    )
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { coverPrompt, clusterIndex } = await request.json()
    if (!coverPrompt?.trim()) {
      return NextResponse.json({ error: 'coverPrompt required' }, { status: 400 })
    }
    const idx = Number(clusterIndex)
    if (isNaN(idx) || idx < 0 || idx > 3) {
      return NextResponse.json({ error: 'clusterIndex must be 0–3' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    const uid = session.user.id
    const ts = Date.now()
    const corner = CORNER_NAMES[idx]

    // 1. Parse the 3 items from this cluster
    const rawItems = parseCluster(coverPrompt, idx)
    if (rawItems.length === 0) {
      return NextResponse.json(
        { error: `No items found in cluster ${idx}. Check prompt format: [item1 + item2 + item3]` },
        { status: 400 }
      )
    }

    // 2. Enrich all 3 items with themed descriptions via GPT-4o
    const enriched = await enrichItems(apiKey, rawItems, coverPrompt.trim(), corner)

    // 3. Generate all 3 images in parallel (only 3 simultaneous calls — safe rate-limit-wise)
    const genResults = await Promise.allSettled(
      enriched.map(item => generateObject(apiKey, item.prompt))
    )

    // 4. Upload successes and collect results
    const objects: { label: string; imageUrl: string }[] = []
    const errors: string[] = []

    for (let i = 0; i < genResults.length; i++) {
      const result = genResults[i]
      const label = enriched[i]?.label ?? rawItems[i] ?? `object-${i}`

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
        console.warn(`[generate-cluster-objects] upload failed for "${label}":`, uploadErr.message)
        errors.push(`${label} (upload): ${uploadErr.message}`)
      }
    }

    return NextResponse.json({
      objects,
      clusterIndex: idx,
      corner,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('[generate-cluster-objects] fatal error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
