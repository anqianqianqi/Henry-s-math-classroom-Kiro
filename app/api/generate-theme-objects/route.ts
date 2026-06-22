// app/api/generate-theme-objects/route.ts
//
// Generates standalone decorative objects on TRANSPARENT backgrounds.
//
// Modes:
//   corner_clusters  — one image per corner cluster group (4 images)
//   individual_items — one image per individual item across all clusters
//                      Uses GPT-4o to write themed detailed descriptions for each
//   (default)        — GPT-4o suggests 4-6 objects, generates each
//
// Returns: { objects: { label, imageUrl }[] }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ── Parse individual items from cluster descriptions ──────────────────────
// Input:  "copper steam pipe + pressure gauge + rivets"
// Output: ["copper steam pipe", "pressure gauge", "rivets"]
function parseItemsFromClusters(coverPrompt: string): string[] {
  const clusterMatches = coverPrompt.match(/\[([^\]]+)\]/g)
  if (!clusterMatches) return []
  const items: string[] = []
  for (const cluster of clusterMatches) {
    const inner = cluster.replace(/^\[|\]$/g, '').trim()
    const parts = inner.split(/\s*\+\s*/)
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed) items.push(trimmed)
    }
  }
  return items
}

// ── Ask GPT-4o to write a detailed themed description for each item ───────
async function expandItemDescriptions(
  apiKey: string,
  items: string[],
  coverTheme: string,  // full cover prompt for full context
): Promise<{ label: string; prompt: string }[]> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an art director writing detailed image generation prompts for isolated 3D decorative objects that will be overlaid on a themed book cover.

Your goal: for each object, write a prompt that makes it look like it BELONGS to the book's world — not generically aged, but specifically shaped by this exact theme's atmosphere.

Rules:
1. KEEP THE OBJECT'S NATURAL REAL MATERIAL — a barometer stays brass/glass, a lantern stays iron/glass, copper stays copper. Do not transform the object into something it isn't.
2. APPLY THEMATIC VISUAL ATMOSPHERE — the book's mood colors the object's condition. Examples:
   - Stormy/electric theme → surfaces rain-streaked, glass fogged with condensation, metal picks up electric-blue or teal ambient reflections, water droplets on exposed surfaces
   - Volcanic/fire theme → soot-darkened surfaces, ember-orange glow on underside, heat-cracked patina, slight magma glow around edges
   - Fantasy/magic theme → faint luminous runes etched into surfaces, soft bioluminescent glow at seams, iridescent sheen
   - Arctic/frost theme → frost crystal deposits on edges, rime ice coating metalwork, cold blue light
   - Underwater theme → barnacles on corners, algae-green tint on aged metal, bioluminescent speckles
3. BE SPECIFIC about: material (e.g. "verdigris-patinated brass"), surface condition (e.g. "rain-streaked glass face"), lighting source (e.g. "lit from above by diffuse stormy grey light with electric-blue rim highlights"), decorative details (engravings, dials, scale markings)
4. TRANSPARENT BACKGROUND — every prompt must specify: fully transparent RGBA PNG background, alpha=0 outside the object, one soft drop shadow beneath
5. Keep each prompt under 130 words

Respond ONLY with a valid JSON array: [{"label": "item name", "prompt": "detailed prompt"}, ...]`,
        },
        {
          role: 'user',
          content: `Full book cover theme: "${coverTheme}"\n\nWrite themed image generation prompts for each of these objects:\n${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.5,
    }),
  })
  if (!res.ok) throw new Error(`GPT-4o expansion failed: ${res.status}`)
  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content?.trim() ?? '[]'
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    const arr = match ? JSON.parse(match[0]) : []
    // Ensure each entry has label + prompt
    return arr
      .filter((o: any) => o.label && o.prompt)
      .map((o: any) => ({ label: String(o.label).trim(), prompt: String(o.prompt).trim() }))
  } catch {
    // Fallback: use items as-is with basic prompts
    return items.map(item => ({
      label: item,
      prompt: `A single isolated 3D decorative object: "${item}". Natural real-world materials, themed to: "${coverTheme}". Fully transparent background, soft directional lighting, realistic cast shadow. No text, no background fill.`,
    }))
  }
}

// ── Generate one object image ──────────────────────────────────────────────
async function generateObject(apiKey: string, prompt: string): Promise<string> {
  const fullPrompt = `${prompt}

CRITICAL RENDERING REQUIREMENTS:
- FULLY TRANSPARENT BACKGROUND: alpha = 0 everywhere outside the object. No dark backdrop, no shadow background, no vignette. The object floats on pure transparency.
- True 3D rendering: subsurface scattering for organic materials, specular highlights on metal/glass, realistic surface imperfections.
- The object fills 55-70% of the frame. Generous transparent padding on all sides.
- One soft drop shadow directly beneath the object (the only allowed non-transparent area besides the object itself).
- Output format: RGBA PNG with genuine transparency.`

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
  if (!res.ok) throw new Error(`Image generation failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data returned')
  return b64
}

// ── Upload helper ──────────────────────────────────────────────────────────
async function uploadPng(supabase: any, b64: string, path: string): Promise<string> {
  const buf = Buffer.from(b64, 'base64')
  const { error } = await supabase.storage.from('book-skins').upload(path, buf, { contentType: 'image/png', upsert: false })
  if (error) throw new Error('Upload failed: ' + error.message)
  const { data: { publicUrl } } = supabase.storage.from('book-skins').getPublicUrl(path)
  return publicUrl
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

    const { coverPrompt, objectNames, mode } = await request.json()
    if (!coverPrompt?.trim()) return NextResponse.json({ error: 'coverPrompt required' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    const uid = session.user.id
    const ts = Date.now()
    const themeHint = coverPrompt.trim().split(',')[0].trim()

    // ── MODE: individual_items ──────────────────────────────────────────────
    if (mode === 'individual_items') {
      // Parse all items from cluster groups
      const rawItems = parseItemsFromClusters(coverPrompt)
      if (rawItems.length === 0) {
        return NextResponse.json({ error: 'No cluster items found in prompt. Use format: corner clusters: [item1 + item2] [item3]' }, { status: 400 })
      }

      // Ask GPT-4o to expand each item with a themed detailed description
      const expanded = await expandItemDescriptions(apiKey, rawItems, coverPrompt.trim())

      // Generate all in parallel
      const genResults = await Promise.allSettled(
        expanded.map(item => generateObject(apiKey, item.prompt))
      )

      const objects: { label: string; imageUrl: string }[] = []
      for (let i = 0; i < genResults.length; i++) {
        const result = genResults[i]
        const { label } = expanded[i]
        if (result.status === 'rejected') {
          console.warn(`[generate-theme-objects] Failed "${label}":`, result.reason?.message)
          continue
        }
        try {
          const slug = label.replace(/\s+/g, '-').toLowerCase().slice(0, 30)
          const filePath = `${uid}/item-${ts}-${i}-${slug}.png`
          const publicUrl = await uploadPng(supabase, result.value, filePath)
          objects.push({ label, imageUrl: publicUrl })
        } catch (uploadErr: any) {
          console.warn(`[generate-theme-objects] Upload failed for "${label}":`, uploadErr.message)
        }
      }

      return NextResponse.json({ objects, totalItems: rawItems.length })
    }

    // ── MODE: corner_clusters ───────────────────────────────────────────────
    if (mode === 'corner_clusters') {
      const clusterMatches = coverPrompt.match(/\[([^\]]+)\]/g)
      const parsedClusters = clusterMatches
        ? clusterMatches.slice(0, 4).map((m: string) => m.replace(/^\[|\]$/g, '').trim())
        : null

      const cornerLabels = ['top-left cluster', 'top-right cluster', 'bottom-left cluster', 'bottom-right cluster']

      const clusterPrompt = (pos: string, clusterDesc: string | null) => {
        const objectDesc = clusterDesc
          ? `a group of these specific objects: ${clusterDesc}`
          : `a thematic group of 2-4 decorative objects matching the theme: "${themeHint}"`
        return `A corner decoration cluster for a book cover themed: "${themeHint}".
Generate ${objectDesc}.
Arrange as a compact dense vignette for the ${pos} corner.
Natural real-world materials with thematic weathering/patina fitting the book mood.
FULLY TRANSPARENT BACKGROUND: alpha=0 everywhere outside the objects. No dark backdrop.
Soft shadows between objects. Rich detail. No text. No book surface.`
      }

      const clusterResults = await Promise.allSettled(
        cornerLabels.map((pos, i) => generateObject(
          apiKey,
          clusterPrompt(pos, parsedClusters ? parsedClusters[i] ?? null : null)
        ))
      )

      const objects: { label: string; imageUrl: string }[] = []
      for (let i = 0; i < clusterResults.length; i++) {
        const result = clusterResults[i]
        const label = cornerLabels[i]
        if (result.status === 'rejected') {
          console.warn(`[generate-theme-objects] Failed "${label}":`, result.reason?.message)
          continue
        }
        try {
          const filePath = `${uid}/corner-cluster-${ts}-${i}.png`
          const publicUrl = await uploadPng(supabase, result.value, filePath)
          objects.push({ label, imageUrl: publicUrl })
        } catch (uploadErr: any) {
          console.warn(`Upload failed for "${label}":`, uploadErr.message)
        }
      }

      return NextResponse.json({ objects })
    }

    // ── DEFAULT MODE: suggest + generate individual objects ─────────────────
    const rawLabels: string[] = objectNames?.length > 0
      ? objectNames
      : await (async () => {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: 'Suggest 4-6 thematic decorative objects for a book cover overlay. Respond with a JSON array of short noun phrases only.' },
                { role: 'user', content: `Cover theme: "${coverPrompt.trim()}"` },
              ],
              max_tokens: 150, temperature: 0.7,
            }),
          })
          const d = await res.json()
          const raw = d.choices?.[0]?.message?.content?.trim() ?? '[]'
          try {
            const match = raw.match(/\[[\s\S]*\]/)
            const arr = match ? JSON.parse(match[0]) : []
            return arr.filter((o: any) => typeof o === 'string').slice(0, 6)
          } catch { return [] }
        })()

    if (rawLabels.length === 0) return NextResponse.json({ error: 'Could not determine objects' }, { status: 400 })

    const expanded = await expandItemDescriptions(apiKey, rawLabels, coverPrompt.trim())
    const results = await Promise.allSettled(expanded.map(item => generateObject(apiKey, item.prompt)))

    const objects: { label: string; imageUrl: string }[] = []
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const { label } = expanded[i]
      if (result.status === 'rejected') continue
      try {
        const slug = label.replace(/\s+/g, '-').toLowerCase().slice(0, 30)
        const filePath = `${uid}/theme-obj-${ts}-${i}-${slug}.png`
        const publicUrl = await uploadPng(supabase, result.value, filePath)
        objects.push({ label, imageUrl: publicUrl })
      } catch (_) {}
    }

    return NextResponse.json({ objects })
  } catch (err: any) {
    console.error('[generate-theme-objects] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
