// app/api/extract-cover-objects/route.ts
//
// Takes a generated book cover + a list of selected object names, then:
//  1. In parallel: generates one transparent-bg PNG per selected object
//  2. Also generates a "stripped" cover with all selected objects removed
//  3. Uploads all to book-skins bucket, saves to DB (book_skin_overlays + updates book_skins)
//
// POST body:
//   {
//     skinId: string,          // existing book_skins row to update
//     coverImageUrl: string,   // the current cover preview image
//     coverPrompt: string,     // original generation prompt (for context)
//     selectedObjects: string[], // object names to extract
//   }
//
// Returns: { stripped_url: string, overlays: { label, image_url }[] }

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120  // long-running: N+1 parallel image edits

async function editImage(apiKey: string, imageUrl: string, prompt: string): Promise<string> {
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Could not fetch image: ${imgRes.status}`)
  const imgBlob = new Blob([await imgRes.arrayBuffer()], { type: 'image/png' })

  const form = new FormData()
  form.append('model', 'gpt-image-1')
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

    const { skinId, coverImageUrl, coverPrompt, selectedObjects } = await request.json()

    if (!skinId || !coverImageUrl || !Array.isArray(selectedObjects) || selectedObjects.length === 0) {
      return NextResponse.json({ error: 'skinId, coverImageUrl, and selectedObjects required' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    const uid = session.user.id
    const ts = Date.now()
    const theme = coverPrompt?.trim() || 'thematic'

    // Build prompts
    const objectExtractPrompts = selectedObjects.map((obj: string) => ({
      label: obj,
      prompt: `Extract only the "${obj}" from this book cover illustration. \
Render it as a single isolated 3D decorative object on a FULLY TRANSPARENT background (alpha = 0 everywhere outside the object). \
Preserve its exact artistic style, size, material, lighting and perspective as it appeared on the cover. \
The object should be centred with a small amount of padding. \
No other objects. No book surface. No background color or fill. Only the "${obj}" itself.`,
    }))

    const strippedPrompt = `Remove these objects from the book cover: ${selectedObjects.map(o => `"${o}"`).join(', ')}. \
Replace each removed object with the underlying book cover surface texture — match the embossed leather/cloth texture, \
color, depth and shadow of the surrounding cover area so the corners look clean and natural without the objects. \
Preserve everything else exactly: the gold ornate border frame, the center zone, the drop shadow, and the book shape. \
The transparent background outside the book must remain fully transparent. No text.`

    // Fire all N+1 image edits in parallel
    const allPromises: Promise<string>[] = [
      editImage(apiKey, coverImageUrl, strippedPrompt),
      ...objectExtractPrompts.map(({ prompt }) => editImage(apiKey, coverImageUrl, prompt)),
    ]

    const results = await Promise.allSettled(allPromises)

    const [strippedResult, ...objectResults] = results

    if (strippedResult.status === 'rejected') {
      throw new Error(`Stripped cover generation failed: ${strippedResult.reason?.message}`)
    }

    // Upload stripped cover
    const strippedBuf = Buffer.from(strippedResult.value, 'base64')
    const strippedFile = `cover/${uid}/${ts}-stripped.png`
    const { error: strippedUploadErr } = await supabase.storage
      .from('book-skins')
      .upload(strippedFile, strippedBuf, { contentType: 'image/png', upsert: false })
    if (strippedUploadErr) throw new Error('Stripped cover upload failed: ' + strippedUploadErr.message)
    const { data: { publicUrl: strippedUrl } } = supabase.storage.from('book-skins').getPublicUrl(strippedFile)

    // Update book_skins.image_url to the stripped cover and mark has_overlays
    const { error: skinUpdateErr } = await supabase
      .from('book_skins')
      .update({ image_url: strippedUrl, has_overlays: true })
      .eq('id', skinId)
    if (skinUpdateErr) throw new Error('Failed to update skin: ' + skinUpdateErr.message)

    // Upload each successfully extracted object and insert overlay rows
    const overlays: { label: string; image_url: string }[] = []
    for (let i = 0; i < objectResults.length; i++) {
      const result = objectResults[i]
      const { label } = objectExtractPrompts[i]

      if (result.status === 'rejected') {
        console.warn(`[extract-cover-objects] Failed to extract "${label}":`, result.reason?.message)
        continue  // skip failed extractions — don't fail the whole request
      }

      const objBuf = Buffer.from(result.value, 'base64')
      const objFile = `overlays/${uid}/${ts}-${label.replace(/\s+/g, '-').toLowerCase()}.png`
      const { error: objUploadErr } = await supabase.storage
        .from('book-skins')
        .upload(objFile, objBuf, { contentType: 'image/png', upsert: false })
      if (objUploadErr) {
        console.warn(`[extract-cover-objects] Upload failed for "${label}":`, objUploadErr.message)
        continue
      }

      const { data: { publicUrl: objUrl } } = supabase.storage.from('book-skins').getPublicUrl(objFile)

      const { error: insertErr } = await supabase.from('book_skin_overlays').insert({
        skin_id: skinId,
        label,
        image_url: objUrl,
        sort_order: i,
        overlay_config: null,  // admin configures this later in the animation editor
      })
      if (insertErr) {
        console.warn(`[extract-cover-objects] DB insert failed for "${label}":`, insertErr.message)
        continue
      }

      overlays.push({ label, image_url: objUrl })
    }

    return NextResponse.json({
      stripped_url: strippedUrl,
      overlays,
      message: `Extracted ${overlays.length} of ${selectedObjects.length} objects.`,
    })

  } catch (err: any) {
    console.error('[extract-cover-objects] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
