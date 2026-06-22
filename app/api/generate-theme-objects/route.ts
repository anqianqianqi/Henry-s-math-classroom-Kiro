// app/api/generate-theme-objects/route.ts
//
// Generates standalone thematic objects on transparent backgrounds.
// Each object matches the art style and theme of the cover prompt.
// Objects are freshly generated (not extracted from the cover) — this gives
// clean, consistent, transparent PNGs purpose-built for overlay animation.
//
// POST body:
//   { coverPrompt: string, objectNames?: string[] }
//   - coverPrompt: the original cover generation prompt (for theme/style context)
//   - objectNames: optional specific objects to generate (if omitted, GPT-4o suggests them)
//
// Returns: { objects: { label, imageUrl }[] }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ── Step 1: Ask GPT-4o to suggest thematic objects ────────────────────────
async function suggestObjects(apiKey: string, coverPrompt: string): Promise<string[]> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a creative art director designing decorative overlay objects for a book cover.
Given a cover theme description, suggest 4–6 individual 3D decorative objects that:
- Match the theme and aesthetic perfectly
- Would look great as standalone animated overlays floating on the cover
- Are specific enough to generate clearly (e.g. "glowing volcano" not just "mountain")
- Mix small objects and slightly larger focal pieces

Respond ONLY with a JSON array of short descriptive noun phrases. No explanations.
Example: ["glowing lava gem", "volcanic ash cloud", "obsidian crystal", "ember stone cluster"]`,
        },
        {
          role: 'user',
          content: `Cover theme: "${coverPrompt}"\n\nSuggest 4–6 thematic overlay objects.`,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    }),
  })
  if (!res.ok) throw new Error(`GPT-4o failed: ${res.status}`)
  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content?.trim() ?? '[]'
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    const arr = match ? JSON.parse(match[0]) : []
    return arr.filter((o: any) => typeof o === 'string').slice(0, 6)
  } catch {
    return raw.replace(/[\[\]"]/g, '').split(',').map((s: string) => s.trim()).filter(Boolean).slice(0, 6)
  }
}

// ── Step 2: Generate each object as a transparent PNG ─────────────────────
async function generateObject(apiKey: string, label: string, coverPrompt: string, customPrompt?: string): Promise<string> {
  const styleHint = coverPrompt.split(',')[0].trim()  // Use first part of prompt as style reference

  const prompt = customPrompt ?? `A single isolated 3D decorative object: "${label}".
Style: matches the aesthetic of "${styleHint}" — same color palette, lighting, material feel and artistic style.
TRANSPARENT BACKGROUND: The object must be centred on a FULLY TRANSPARENT background (alpha = 0 everywhere outside the object).
The object should be rendered in a 3D isometric-style, slightly elevated view, with soft directional lighting.
It should be rich in detail — textured surfaces, depth, slight shadow cast downward.
Size: the object should fill roughly 50–70% of the image width, well-padded on all sides.
NO other objects. NO text. NO background color or fill. ONLY the "${label}" itself.`

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',   // square — better for isolated objects
      output_format: 'png',
      quality: 'high',
    }),
  })
  if (!res.ok) throw new Error(`Object generation failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data returned')
  return b64
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

    if (mode === 'corner_clusters') {
      // Parse explicit corner cluster descriptions from the prompt if present
      // Format: "corner clusters: [cluster1] [cluster2] [cluster3] [cluster4]"
      const clusterMatches = coverPrompt.match(/\[([^\]]+)\]/g)
      const parsedClusters = clusterMatches
        ? clusterMatches.slice(0, 4).map(m => m.replace(/^\[|\]$/g, '').trim())
        : null

      const styleHint = coverPrompt.split(',')[0].trim()
      const cornerLabels = ['top-left cluster', 'top-right cluster', 'bottom-left cluster', 'bottom-right cluster']

      const clusterPrompt = (pos: string, clusterDesc: string | null) => {
        const objectDesc = clusterDesc
          ? `a group of these objects: ${clusterDesc}`
          : `a thematic group of 2-4 decorative objects matching the theme: "${styleHint}"`
        return `A corner decoration cluster for a book cover with theme: "${styleHint}".
Generate ${objectDesc}.
Position: ${pos} corner — arrange the objects as a compact dense vignette.
All objects must share the same art style, color palette, and lighting as the book theme.
FULLY TRANSPARENT BACKGROUND (alpha = 0 everywhere outside the objects).
Soft shadows between objects. No text. No book surface. No border. Only the cluster on transparent background.`
      }

      const clusterResults = await Promise.allSettled(
        cornerLabels.map((pos, i) => generateObject(
          apiKey, pos, coverPrompt.trim(),
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
        const buf = Buffer.from(result.value, 'base64')
        const filePath = `${uid}/corner-cluster-${ts}-${i}.png`
        const { error: uploadErr } = await supabase.storage
          .from('book-skins').upload(filePath, buf, { contentType: 'image/png', upsert: false })
        if (uploadErr) { console.warn(`Upload failed for "${label}":`, uploadErr.message); continue }
        const { data: { publicUrl } } = supabase.storage.from('book-skins').getPublicUrl(filePath)
        objects.push({ label, imageUrl: publicUrl })
      }
      return NextResponse.json({ objects })
    }

    // Default mode: individual standalone objects
    const labels: string[] = (objectNames?.length > 0)
      ? objectNames
      : await suggestObjects(apiKey, coverPrompt.trim())

    if (labels.length === 0) {
      return NextResponse.json({ error: 'Could not determine objects to generate' }, { status: 400 })
    }

    const results = await Promise.allSettled(
      labels.map(label => generateObject(apiKey, label, coverPrompt.trim()))
    )

    const objects: { label: string; imageUrl: string }[] = []
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const label = labels[i]
      if (result.status === 'rejected') {
        console.warn(`[generate-theme-objects] Failed "${label}":`, result.reason?.message)
        continue
      }
      const buf = Buffer.from(result.value, 'base64')
      const filePath = `${uid}/theme-obj-${ts}-${i}-${label.replace(/\s+/g, '-').toLowerCase().slice(0, 30)}.png`
      const { error: uploadErr } = await supabase.storage
        .from('book-skins').upload(filePath, buf, { contentType: 'image/png', upsert: false })
      if (uploadErr) {
        console.warn(`[generate-theme-objects] Upload failed for "${label}":`, uploadErr.message)
        continue
      }
      const { data: { publicUrl } } = supabase.storage.from('book-skins').getPublicUrl(filePath)
      objects.push({ label, imageUrl: publicUrl })
    }

    return NextResponse.json({ objects, suggestedLabels: labels })
  } catch (err: any) {
    console.error('[generate-theme-objects] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
