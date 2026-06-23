// app/api/enrich-cluster-items/route.ts
//
// Single GPT-4o call (~3-5s) that parses ALL 4 corner clusters from the prompt
// and returns enriched image generation prompts for every item (up to 12 total).
//
// POST body: { coverPrompt: string }
// Returns:
//   {
//     clusters: Array<{
//       clusterIndex: number
//       corner: string
//       items: { label: string; prompt: string }[]
//     }>
//   }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30  // GPT-4o text call only — always fast

const CORNER_NAMES = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

function parseAllClusters(coverPrompt: string): { corner: string; items: string[] }[] {
  const matches = coverPrompt.match(/\[([^\]]+)\]/g) ?? []
  return matches.slice(0, 4).map((m, i) => {
    const inner = m.replace(/^\[|\]$/g, '').trim()
    const items = inner.split(/\s*\+\s*/).map(s => s.trim()).filter(Boolean).slice(0, 3)
    return { corner: CORNER_NAMES[i], items }
  })
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

    const { coverPrompt } = await request.json()
    if (!coverPrompt?.trim()) return NextResponse.json({ error: 'coverPrompt required' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    const parsed = parseAllClusters(coverPrompt.trim())
    if (parsed.length === 0 || parsed.every(c => c.items.length === 0)) {
      return NextResponse.json({ error: 'No cluster items found in prompt. Use format: corner clusters: [item1 + item2 + item3] [...]' }, { status: 400 })
    }

    // Build the item list for GPT-4o — flat list with cluster labels
    const allItems: { corner: string; item: string }[] = []
    for (const cluster of parsed) {
      for (const item of cluster.items) {
        allItems.push({ corner: cluster.corner, item })
      }
    }

    const itemList = allItems.map((x, i) => `${i + 1}. [${x.corner}] ${x.item}`).join('\n')

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You write concise image generation prompts for isolated 3D decorative props that will be placed on a themed hardcover book cover. Each prop is a single object — museum-quality, photorealistic, on a fully transparent background.

RULES (apply to every object):
1. PRESERVE NATURAL MATERIAL — brass stays golden-brown, iron stays dark grey, glass stays clear, wood stays warm brown, copper stays reddish-orange. Never change what the object is made of.
2. APPLY THEMATIC SURFACE TREATMENT based on the full cover theme:
   - Stormy/electric → rain-streaked surfaces, condensation beads on glass, electric-blue rim highlight, teal ambient reflection on metal
   - Volcanic/fire → soot-darkened top surfaces, ember-orange underside glow, heat-cracked enamel, faint magma shimmer on edges
   - Underwater/ocean → barnacle-crusted edges, verdigris tint on bronze/copper, bioluminescent green speckle, kelp-stained textures
   - Arctic/frost → rime frost crystals on edges, cold-blue rim light, breath-fogged glass, ice needle deposits on metal
   - Magic/fantasy → faint etched runes glowing amber/cyan, iridescent pearlescent sheen at seams, drifting mana-dust particles
   - Steampunk/clockwork → copper-green verdigris patina, oil-stain rings on brass, riveted seams, gear-tooth engraving
   - Ancient/parchment → ochre-stained cloth/leather, worn gilding on edges, patinated bronze clasps, cracked wax seals
3. LIGHTING: warm directional light from slightly above-left; one soft drop shadow beneath the object
4. COMPOSITION: object centred, filling 62-70% of frame, generous transparent padding all sides
5. BACKGROUND: fully transparent RGBA (alpha=0 outside object); only the shadow touches the "floor"
6. RENDER: photorealistic real-world object with full natural colour — NOT a sculpture, statuette, or monochrome cast. Show the actual materials: brass dials, glass faces, leather straps, iron frames, wood grain, fabric colour. Depth comes from lighting, not material transformation.
7. NO text, no book surface, no other objects in frame
8. Max 110 words per prompt

Output ONLY a valid JSON array, one entry per item in the SAME ORDER as input:
[{"label":"short name","prompt":"full image gen prompt"},...]`,
          },
          {
            role: 'user',
            content: `Full book cover theme:\n"${coverPrompt.trim()}"\n\nWrite enriched prompts for all ${allItems.length} objects:\n${itemList}`,
          },
        ],
        max_tokens: 2400,
        temperature: 0.4,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: `GPT-4o failed (${res.status}): ${errText.slice(0, 200)}` }, { status: 500 })
    }

    const data = await res.json()
    const raw: string = data.choices?.[0]?.message?.content?.trim() ?? '[]'

    let enriched: { label: string; prompt: string }[] = []
    try {
      const match = raw.match(/\[[\s\S]*\]/)
      const arr: any[] = match ? JSON.parse(match[0]) : []
      enriched = arr
        .filter((o: any) => o.label && o.prompt)
        .map((o: any) => ({ label: String(o.label).trim(), prompt: String(o.prompt).trim() }))
    } catch { /* fallback below */ }

    // Fallback: build basic prompts if GPT-4o parse failed
    if (enriched.length < allItems.length) {
      const themeHint = coverPrompt.split(',')[0].trim()
      enriched = allItems.map(({ item }) => ({
        label: item,
        prompt: `Isolated 3D prop: "${item}". Natural materials shaped by the theme "${themeHint}". Warm directional light from above-left. Object centred, 65% of frame. Fully transparent RGBA background, one soft drop shadow. Photorealistic, no text, no other objects.`,
      }))
    }

    // Reassemble into per-cluster groups matching the original cluster order
    const clusters = parsed.map((cluster, clusterIdx) => {
      const startIdx = parsed.slice(0, clusterIdx).reduce((acc, c) => acc + c.items.length, 0)
      const clusterEnriched = enriched.slice(startIdx, startIdx + cluster.items.length)
      return {
        clusterIndex: clusterIdx,
        corner: cluster.corner,
        items: clusterEnriched,
      }
    })

    return NextResponse.json({ clusters })
  } catch (err: any) {
    console.error('[enrich-cluster-items] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
