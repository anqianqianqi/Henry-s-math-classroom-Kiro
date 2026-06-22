// app/api/extract-cover-objects-preview/route.ts
//
// Preview-mode object extraction — runs the same parallel image edits as
// extract-cover-objects but does NOT write to the book_skins or
// book_skin_overlays tables. Returns URLs only for the sandbox preview.
//
// POST body:
//   { coverImageUrl, coverPrompt, selectedObjects: string[] }
//
// Returns: { stripped_url: string, objects: { label, imageUrl }[] }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function editImage(apiKey: string, imageUrl: string, prompt: string): Promise<string> {
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Could not fetch image: ${imgRes.status}`)
  const imgBlob = new Blob([await imgRes.arrayBuffer()], { type: 'image/png' })
  const form = new FormData()
  form.append('model', 'gpt-image-2')
  form.append('image', imgBlob, 'cover.png')
  form.append('prompt', prompt)
  form.append('n', '1')
  form.append('size', '1024x1536')
  form.append('output_format', 'png')
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Edit failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
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

    const { coverImageUrl, coverPrompt, selectedObjects } = await request.json()
    if (!coverImageUrl || !Array.isArray(selectedObjects) || selectedObjects.length === 0) {
      return NextResponse.json({ error: 'coverImageUrl and selectedObjects required' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    const uid = session.user.id
    const ts = Date.now()
    const theme = coverPrompt?.trim() || 'thematic'

    const objectPrompts = selectedObjects.map((obj: string) => ({
      label: obj,
      prompt: `Extract only the "${obj}" from this book cover illustration. \
Render it as a single isolated 3D decorative object on a FULLY TRANSPARENT background (alpha = 0 everywhere outside the object). \
Preserve its exact artistic style, size, material, lighting and perspective as it appeared on the cover. \
The object should be centred with a small amount of padding. No other objects. No book surface. No background color.`,
    }))

    const strippedPrompt = `Remove these objects from the book cover: ${selectedObjects.map((o: string) => `"${o}"`).join(', ')}. \
Replace each removed object with the underlying book cover surface texture — match the embossed leather/cloth texture, \
color, depth and shadow of the surrounding cover area so the corners look clean and natural without the objects. \
Preserve everything else exactly: the gold ornate border frame, the center zone, the drop shadow, and the book shape. \
The transparent background outside the book must remain fully transparent. No text.`

    // Run all edits in parallel
    const results = await Promise.allSettled([
      editImage(apiKey, coverImageUrl, strippedPrompt),
      ...objectPrompts.map(({ prompt }) => editImage(apiKey, coverImageUrl, prompt)),
    ])

    const [strippedResult, ...objectResults] = results

    if (strippedResult.status === 'rejected') {
      throw new Error(`Stripped cover generation failed: ${strippedResult.reason?.message}`)
    }

    // Upload stripped cover to preview path
    const strippedBuf = Buffer.from(strippedResult.value, 'base64')
    const strippedFile = `${uid}/book-cover-preview-stripped-${ts}.png`
    const { error: strErr } = await supabase.storage
      .from('book-skins').upload(strippedFile, strippedBuf, { contentType: 'image/png', upsert: false })
    if (strErr) throw new Error('Stripped cover upload failed: ' + strErr.message)
    const { data: { publicUrl: strippedUrl } } = supabase.storage.from('book-skins').getPublicUrl(strippedFile)

    // Upload each object to preview path
    const objects: { label: string; imageUrl: string }[] = []
    for (let i = 0; i < objectResults.length; i++) {
      const result = objectResults[i]
      const { label } = objectPrompts[i]
      if (result.status === 'rejected') {
        console.warn(`[extract-preview] Failed "${label}":`, result.reason?.message)
        continue
      }
      const objBuf = Buffer.from(result.value, 'base64')
      const objFile = `${uid}/book-cover-preview-obj-${ts}-${i}-${label.replace(/\s+/g, '-')}.png`
      const { error: objErr } = await supabase.storage
        .from('book-skins').upload(objFile, objBuf, { contentType: 'image/png', upsert: false })
      if (objErr) { console.warn(`Upload failed for "${label}":`, objErr.message); continue }
      const { data: { publicUrl: objUrl } } = supabase.storage.from('book-skins').getPublicUrl(objFile)
      objects.push({ label, imageUrl: objUrl })
    }

    return NextResponse.json({ stripped_url: strippedUrl, objects })
  } catch (err: any) {
    console.error('[extract-cover-objects-preview] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
