// app/api/preview-book-bundle/route.ts
//
// Generates one half of a ChallengeRoom book bundle — the cover texture or the
// matching inner page — with gpt-image-2, and uploads it to the book-skins
// bucket for preview. Does NOT insert into book_texture_packages; the admin
// generates both halves, looks at them, then saves the pair.
//
// POST body: { kind: 'cover' | 'inner', spec, sourceImageUrl?, changePrompt? }
// Returns:   { image_url, prompt }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { compileCoverPrompt, compileInnerPrompt, validateBookSpec } from '@/lib/challengeRoom/bookPrompt'
import type { BookSpec } from '@/lib/types/challengeRoom'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** 3:4 portrait — must match the page mesh, which is exactly 2.000 x 2.667. */
const PAGE_SIZE = '1536x2048'

async function callGenerations(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt,
      n: 1,
      size: PAGE_SIZE,
      output_format: 'png',
      quality: 'high',
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    console.error('[preview-book-bundle] OpenAI error:', errText.slice(0, 500))
    throw new Error(`Image generation failed: ${res.status} ${res.statusText}`)
  }
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data returned from OpenAI')
  return b64
}

async function callEdit(apiKey: string, sourceImageUrl: string, editPrompt: string): Promise<string> {
  const srcRes = await fetch(sourceImageUrl)
  if (!srcRes.ok) throw new Error('Could not read the previous texture for refinement')
  const srcBuf = Buffer.from(await srcRes.arrayBuffer())

  const form = new FormData()
  form.append('model', 'gpt-image-2')
  form.append('prompt', editPrompt)
  form.append('n', '1')
  form.append('size', PAGE_SIZE)
  form.append('image', new Blob([srcBuf], { type: 'image/png' }), 'texture.png')

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) {
    const errText = await res.text()
    console.error('[preview-book-bundle] OpenAI edit error:', errText.slice(0, 500))
    throw new Error(`Refinement failed: ${res.status} ${res.statusText}`)
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
    const kind: 'cover' | 'inner' = body.kind
    const spec = body.spec as BookSpec | undefined
    const sourceImageUrl: string | undefined = body.sourceImageUrl
    const changePrompt: string | undefined = body.changePrompt

    if (kind !== 'cover' && kind !== 'inner') {
      return NextResponse.json({ error: 'kind must be "cover" or "inner"' }, { status: 400 })
    }
    if (!spec) return NextResponse.json({ error: 'spec is required' }, { status: 400 })
    const invalid = validateBookSpec(spec)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const basePrompt = kind === 'cover' ? compileCoverPrompt(spec) : compileInnerPrompt(spec)

    let b64: string
    let accumulatedPrompt: string

    if (sourceImageUrl && changePrompt?.trim()) {
      // Restate the constraints an edit could otherwise break: the flat 3:4
      // texture, the frame inset, and — for inner pages — the blank centre the
      // challenge room prints the problem into.
      const guard = kind === 'cover'
        ? 'Preserve exactly: flat orthographic 3:4 texture with no mockup, perspective, spine or shadow; the thin frame ~2% inward; one compact cluster per corner; a large quiet empty centre. No text anywhere.'
        : 'Preserve exactly: flat orthographic 3:4 texture with no mockup, perspective, spine or shadow; the thin frame ~2% inward; only sparse accents near the frame; at least 75% of the framed interior completely blank. No text anywhere.'
      b64 = await callEdit(apiKey, sourceImageUrl, `${changePrompt.trim()}\n\n${guard}`)
      accumulatedPrompt = `${basePrompt}\n\n[Refinement] ${changePrompt.trim()}`
    } else {
      b64 = await callGenerations(apiKey, basePrompt)
      accumulatedPrompt = basePrompt
    }

    // Path must start with the user's ID to satisfy the bucket RLS policy.
    const buffer = Buffer.from(b64, 'base64')
    const fileName = `${session.user.id}/book-bundle-${kind}-${Date.now()}.png`

    const { error: uploadErr } = await supabase.storage
      .from('book-skins')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: false })

    if (uploadErr) {
      console.error('[preview-book-bundle] Storage upload error:', uploadErr)
      return NextResponse.json({ error: 'Upload failed: ' + uploadErr.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from('book-skins').getPublicUrl(fileName)

    return NextResponse.json({ image_url: publicUrl, prompt: accumulatedPrompt })
  } catch (err: any) {
    console.error('[preview-book-bundle] Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
