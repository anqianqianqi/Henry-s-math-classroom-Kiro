'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HomeButton } from '@/components/ui/HomeButton'
import { CoverLayoutEditor, DEFAULT_LAYOUT, type CoverLayout } from '@/components/CoverLayoutEditor'

// ─────────────────────────────────────────────────────────────────────────────
// Target dimensions (must match MagicBookReveal proportions)
// ─────────────────────────────────────────────────────────────────────────────
const COVER_W = 400
const COVER_H = 620
const PAGE_W  = 400   // single page width — applied to each page independently
const PAGE_H  = 620

type SkinType = 'cover' | 'page'

interface BookSkin {
  id: string
  name: string
  description: string | null
  skin_type: SkinType
  image_url: string
  width: number
  height: number
  is_default: boolean
  is_active: boolean
  shop_item_id: string | null
  visibility: 'admin_only' | 'public'
  cover_layout?: {
    title?: { x: number; y: number; fontSize: number; color: string; shadow: boolean }
    prompt?: { x: number; y: number; fontSize: number; color: string; shadow: boolean }
  } | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resize: draws source image onto an offscreen canvas at target size,
// returns a Blob at JPEG quality 0.92.  Works entirely client-side.
// ─────────────────────────────────────────────────────────────────────────────
async function resizeImageToBlob(
  file: File,
  targetW: number,
  targetH: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas context unavailable')); return }

      // Cover the canvas (object-fit: cover behaviour)
      const srcAspect = img.naturalWidth / img.naturalHeight
      const dstAspect = targetW / targetH
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
      if (srcAspect > dstAspect) {
        // Source is wider — crop sides
        sw = img.naturalHeight * dstAspect
        sx = (img.naturalWidth - sw) / 2
      } else {
        // Source is taller — crop top/bottom
        sh = img.naturalWidth / dstAspect
        sy = (img.naturalHeight - sh) / 2
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')),
        'image/png'   // PNG preserves transparency — JPEG would fill it with black
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')) }
    img.src = objectUrl
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function BookSkinsAdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [skins, setSkins] = useState<BookSkin[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Upload form state
  const [uploadType, setUploadType] = useState<SkinType>('cover')
  const [skinName, setSkinName] = useState('')
  const [skinDesc, setSkinDesc] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)  // resized preview
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Cover layout editor state — only relevant when uploadType === 'cover'
  const [showLayoutEditor, setShowLayoutEditor] = useState(false)
  const [coverLayout, setCoverLayout] = useState<CoverLayout>(DEFAULT_LAYOUT)
  // Visibility — new skins default to admin_only until explicitly made public
  const [skinVisibility, setSkinVisibility] = useState<'admin_only' | 'public'>('admin_only')
  // Animated frames mode
  const [isAnimated, setIsAnimated] = useState(false)
  const [frameFiles, setFrameFiles] = useState<File[]>([])
  const [framePreviews, setFramePreviews] = useState<string[]>([])
  const framesInputRef = useRef<HTMLInputElement>(null)

  const targetW = uploadType === 'cover' ? COVER_W : PAGE_W
  const targetH = uploadType === 'cover' ? COVER_H : PAGE_H

  // ── Load skins ─────────────────────────────────────────────────────────────
  async function loadSkins() {
    setLoading(true)
    const { data, error } = await supabase
      .from('book_skins')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      setError('Failed to load skins: ' + error.message)
    } else {
      setSkins((data ?? []) as BookSkin[])
    }
    setLoading(false)
  }

  useEffect(() => {
    // Auth guard — admins/teachers only
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      loadSkins()
    })
  }, [])

  // ── File picker — auto-resize into preview ─────────────────────────────────
  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (!picked) return
    if (!picked.type.startsWith('image/')) { setError('Please pick an image file'); return }
    if (picked.size > 20 * 1024 * 1024) { setError('Image must be under 20 MB'); return }

    setError(null)
    setFile(picked)
    try {
      const resized = await resizeImageToBlob(picked, targetW, targetH)
      setPreview(URL.createObjectURL(resized))
    } catch (err: any) {
      setError('Could not resize image: ' + err.message)
    }
  }

  // Re-generate preview when type (dimensions) change and a file is already chosen
  async function repreviewForType(type: SkinType) {
    setUploadType(type)
    if (!file) return
    const w = type === 'cover' ? COVER_W : PAGE_W
    const h = type === 'cover' ? COVER_H : PAGE_H
    try {
      const resized = await resizeImageToBlob(file, w, h)
      setPreview(URL.createObjectURL(resized))
    } catch (_) {}
  }

  // ── Frame file picker ──────────────────────────────────────────────────────
  async function handleFramesPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/') && f.size <= 20 * 1024 * 1024)
    if (picked.length === 0) return
    setError(null)
    // Resize all frames and generate previews
    const resizedPreviews: string[] = []
    for (const f of picked) {
      try {
        const blob = await resizeImageToBlob(f, COVER_W, COVER_H)
        resizedPreviews.push(URL.createObjectURL(blob))
      } catch (_) {
        resizedPreviews.push(URL.createObjectURL(f))
      }
    }
    setFrameFiles(prev => [...prev, ...picked])
    setFramePreviews(prev => [...prev, ...resizedPreviews])
  }

  function removeFrame(idx: number) {
    setFrameFiles(prev => prev.filter((_, i) => i !== idx))
    setFramePreviews(prev => prev.filter((_, i) => i !== idx))
  }

  function moveFrame(idx: number, dir: -1 | 1) {
    const newFiles = [...frameFiles]
    const newPreviews = [...framePreviews]
    const swap = idx + dir
    if (swap < 0 || swap >= newFiles.length) return
    ;[newFiles[idx], newFiles[swap]] = [newFiles[swap], newFiles[idx]]
    ;[newPreviews[idx], newPreviews[swap]] = [newPreviews[swap], newPreviews[idx]]
    setFrameFiles(newFiles)
    setFramePreviews(newPreviews)
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload() {
    // Validate
    if (isAnimated && uploadType === 'cover') {
      if (frameFiles.length < 2) { setError('Please add at least 2 frames for animated mode'); return }
      if (!skinName.trim()) { setError('Please enter a name'); return }
    } else {
      if (!file || !skinName.trim()) { setError('Please choose an image and enter a name'); return }
    }
    setError(null)
    setSuccess(null)
    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // ── Animated frames mode ──
      if (isAnimated && uploadType === 'cover') {
        // Use frame 0 as the cover image_url
        const frame0 = await resizeImageToBlob(frameFiles[0], COVER_W, COVER_H)
        const f0Name = `cover/${user.id}/${Date.now()}-f0.png`
        const { error: f0Err } = await supabase.storage.from('book-skins').upload(f0Name, frame0, { contentType: 'image/png' })
        if (f0Err) throw new Error('Frame 0 upload failed: ' + f0Err.message)
        const { data: { publicUrl: f0Url } } = supabase.storage.from('book-skins').getPublicUrl(f0Name)

        const { data: newSkin, error: insertErr } = await supabase
          .from('book_skins')
          .insert({
            name: skinName.trim(),
            description: skinDesc.trim() || null,
            skin_type: 'cover',
            image_url: f0Url,
            width: COVER_W,
            height: COVER_H,
            created_by: user.id,
            visibility: skinVisibility,
            cover_layout: coverLayout,
            is_animated: true,
          })
          .select('id')
          .single()
        if (insertErr || !newSkin) throw new Error('DB insert failed: ' + insertErr?.message)

        // Upload remaining frames and insert book_skin_frames rows
        for (let i = 0; i < frameFiles.length; i++) {
          const blob = await resizeImageToBlob(frameFiles[i], COVER_W, COVER_H)
          const fName = `cover/${user.id}/${Date.now()}-frame${i}.png`
          await supabase.storage.from('book-skins').upload(fName, blob, { contentType: 'image/png' })
          const { data: { publicUrl: fUrl } } = supabase.storage.from('book-skins').getPublicUrl(fName)
          await supabase.from('book_skin_frames').insert({ skin_id: newSkin.id, sort_order: i, image_url: fUrl })
        }

        setSuccess(`✅ Animated skin "${skinName.trim()}" uploaded with ${frameFiles.length} frames!`)
        setSkinName(''); setSkinDesc(''); setFrameFiles([]); setFramePreviews([])
        setShowLayoutEditor(false); setCoverLayout(DEFAULT_LAYOUT); setSkinVisibility('admin_only')
        if (framesInputRef.current) framesInputRef.current.value = ''
        await loadSkins()
        return
      }

      // ── Single image mode (original) ──
      const resizedBlob = await resizeImageToBlob(file!, targetW, targetH)
      const fileName = `${uploadType}/${user.id}/${Date.now()}.png`
      const { error: uploadErr } = await supabase.storage.from('book-skins').upload(fileName, resizedBlob, { contentType: 'image/png', upsert: false })
      if (uploadErr) throw new Error('Storage upload failed: ' + uploadErr.message)
      const { data: { publicUrl } } = supabase.storage.from('book-skins').getPublicUrl(fileName)

      const { error: insertErr } = await supabase
        .from('book_skins')
        .insert({
          name: skinName.trim(),
          description: skinDesc.trim() || null,
          skin_type: uploadType,
          image_url: publicUrl,
          width: targetW,
          height: targetH,
          created_by: user.id,
          visibility: skinVisibility,
          ...(uploadType === 'cover' ? { cover_layout: coverLayout } : {}),
        })
      if (insertErr) throw new Error('DB insert failed: ' + insertErr.message)

      setSuccess(`✅ "${skinName.trim()}" uploaded successfully!`)
      setSkinName(''); setSkinDesc(''); setFile(null); setPreview(null)
      setShowLayoutEditor(false); setCoverLayout(DEFAULT_LAYOUT); setSkinVisibility('admin_only')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadSkins()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  // ── Set default ────────────────────────────────────────────────────────────
  async function setDefault(skin: BookSkin) {
    // Clear existing default for this type, then set the new one
    await supabase
      .from('book_skins')
      .update({ is_default: false })
      .eq('skin_type', skin.skin_type)
      .eq('is_default', true)

    const { error } = await supabase
      .from('book_skins')
      .update({ is_default: true })
      .eq('id', skin.id)

    if (error) { setError('Failed to set default: ' + error.message); return }
    setSuccess(`"${skin.name}" is now the default ${skin.skin_type}`)
    await loadSkins()
  }

  // ── Toggle active ──────────────────────────────────────────────────────────
  async function toggleActive(skin: BookSkin) {
    const { error } = await supabase
      .from('book_skins')
      .update({ is_active: !skin.is_active })
      .eq('id', skin.id)
    if (error) { setError('Failed to update: ' + error.message); return }
    await loadSkins()
  }

  // ── Toggle visibility ──────────────────────────────────────────────────────
  async function toggleVisibility(skin: BookSkin) {
    const next = skin.visibility === 'public' ? 'admin_only' : 'public'
    const { error } = await supabase
      .from('book_skins')
      .update({ visibility: next })
      .eq('id', skin.id)
    if (error) { setError('Failed to update visibility: ' + error.message); return }
    setSuccess(`"${skin.name}" is now ${next === 'public' ? 'visible to users' : 'admin only'}`)
    await loadSkins()
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function deleteSkin(skin: BookSkin) {
    if (!confirm(`Delete "${skin.name}"? This cannot be undone.`)) return
    // Extract storage path from public URL
    const url = new URL(skin.image_url)
    const pathParts = url.pathname.split('/book-skins/')
    if (pathParts[1]) {
      await supabase.storage.from('book-skins').remove([pathParts[1]])
    }
    const { error } = await supabase.from('book_skins').delete().eq('id', skin.id)
    if (error) { setError('Delete failed: ' + error.message); return }
    setSuccess(`"${skin.name}" deleted`)
    await loadSkins()
  }

  // ── Overlay editor ─────────────────────────────────────────────────────────
  const [overlayEditorSkin, setOverlayEditorSkin] = useState<BookSkin | null>(null)
  const [overlays, setOverlays] = useState<OverlayObject[]>([])
  const [overlayLoading, setOverlayLoading] = useState(false)
  const [overlaySaving, setOverlaySaving] = useState(false)

  async function openOverlayEditor(skin: BookSkin) {
    setOverlayEditorSkin(skin)
    setOverlayLoading(true)
    const { data } = await supabase
      .from('book_skin_overlays')
      .select('*')
      .eq('skin_id', skin.id)
      .order('sort_order', { ascending: true })
    setOverlays((data ?? []) as OverlayObject[])
    setOverlayLoading(false)
  }

  async function saveOverlayConfig(overlay: OverlayObject, config: OverlayConfig) {
    setOverlaySaving(true)
    await supabase
      .from('book_skin_overlays')
      .update({ overlay_config: config })
      .eq('id', overlay.id)
    setOverlays(prev => prev.map(o => o.id === overlay.id ? { ...o, overlay_config: config } : o))
    setOverlaySaving(false)
  }

  // ── Sell in shop ───────────────────────────────────────────────────────────
  const [sellingSkin, setSellingSkin] = useState<BookSkin | null>(null)
  const [sellPrice, setSellPrice] = useState('')
  const [sellSubmitting, setSellSubmitting] = useState(false)

  async function handleSellInShop() {
    if (!sellingSkin || !sellPrice.trim()) return
    const price = parseInt(sellPrice.trim(), 10)
    if (isNaN(price) || price < 1) { setError('Price must be at least 1 point'); return }

    setSellSubmitting(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create a shop_items row for this skin
      const { data: newItem, error: itemErr } = await supabase
        .from('shop_items')
        .insert({
          title: sellingSkin.name,
          description: sellingSkin.description || `Book ${sellingSkin.skin_type} skin`,
          cost: price,
          image_url: sellingSkin.image_url,
          is_active: true,
          created_by: user.id,
          category: 'other',
          commodity_type: 'standard',
          draws_per_redemption: 1,
        })
        .select('id')
        .single()

      if (itemErr || !newItem) throw new Error('Failed to create shop item: ' + itemErr?.message)

      // Link the skin to the shop item
      const { error: linkErr } = await supabase
        .from('book_skins')
        .update({ shop_item_id: newItem.id, visibility: 'shop_only' })
        .eq('id', sellingSkin.id)

      if (linkErr) throw new Error('Failed to link skin to shop: ' + linkErr.message)

      setSuccess(`"${sellingSkin.name}" is now listed in the shop for ${price} points!`)
      setSellingSkin(null)
      setSellPrice('')
      await loadSkins()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSellSubmitting(false)
    }
  }

  async function handleRemoveFromShop(skin: BookSkin) {
    if (!skin.shop_item_id) return
    if (!confirm(`Remove "${skin.name}" from the shop? The shop item will be deactivated.`)) return

    // Deactivate the shop item
    await supabase.from('shop_items').update({ is_active: false }).eq('id', skin.shop_item_id)
    // Unlink from skin, revert to admin_only
    await supabase.from('book_skins').update({ shop_item_id: null, visibility: 'admin_only' }).eq('id', skin.id)
    setSuccess(`"${skin.name}" removed from shop`)
    await loadSkins()
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const coverSkins = skins.filter(s => s.skin_type === 'cover')
  const pageSkins  = skins.filter(s => s.skin_type === 'page')

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <HomeButton />
          <span className="text-gray-400">/</span>
          <h1 className="font-bold text-gray-900">Book Skins</h1>
          <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Admin only</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Error / success banners */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 font-bold">✕</button>
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-4 font-bold">✕</button>
          </div>
        )}

        {/* ── Upload new skin ── */}
        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <span>🖼️</span> Upload New Book Skin
            </Card.Title>
          </Card.Header>
          <Card.Body>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: form */}
              <div className="space-y-4">
                {/* Type picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Skin Type</label>
                  <div className="flex gap-2">
                    {(['cover', 'page'] as SkinType[]).map(t => (
                      <button
                        key={t}
                        onClick={() => repreviewForType(t)}
                        className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold border-2 transition-colors ${
                          uploadType === t
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                        }`}
                      >
                        {t === 'cover' ? '📖 Cover' : '📄 Page'}
                        <span className="block text-xs font-normal opacity-75 mt-0.5">
                          {t === 'cover' ? `${COVER_W}×${COVER_H}px` : `${PAGE_W}×${PAGE_H}px`}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Images will be auto-resized to fit. Both cover and page use <strong>400×620px</strong> (2:3 portrait). The page image is applied to each page individually — upload one page design and it shows on both left and right.
                  </p>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={skinName}
                    onChange={e => setSkinName(e.target.value)}
                    placeholder='e.g. "Treasure Map", "Ancient Parchment"'
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                  <textarea
                    value={skinDesc}
                    onChange={e => setSkinDesc(e.target.value)}
                    placeholder="Shown in the shop when selling this skin..."
                    rows={2}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors resize-none"
                  />
                </div>

                {/* File picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image *</label>
                  <div
                    className="border-2 border-dashed border-amber-300 rounded-xl p-4 text-center bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFilePick}
                    />
                    {file ? (
                      <p className="text-sm text-amber-700 font-medium">{file.name}</p>
                    ) : (
                      <>
                        <p className="text-2xl mb-1">📸</p>
                        <p className="text-sm text-amber-700 font-medium">Click to choose image</p>
                        <p className="text-xs text-gray-500">
                          {uploadType === 'cover'
                            ? 'Recommended: 800×1200px (2:3 portrait) · Max 20 MB'
                            : 'Recommended: 800×1200px (2:3 portrait) · Applied to each page · Max 20 MB'}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Visibility */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                  <div className="flex gap-2">
                    {(['admin_only', 'public'] as const).map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setSkinVisibility(v)}
                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                          skinVisibility === v
                            ? v === 'public'
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-gray-700 text-white border-gray-700'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {v === 'public' ? '👥 Public (users can see)' : '🔒 Admin only'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {skinVisibility === 'admin_only'
                      ? 'Only usable as sitewide default. Not visible in user picker.'
                      : 'Visible in user Book & Cover picker (and sellable in shop).'}
                  </p>
                </div>

                {/* Animated mode toggle — cover only */}
                {uploadType === 'cover' && (
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        className={`relative w-11 h-6 rounded-full transition-colors ${isAnimated ? 'bg-amber-500' : 'bg-gray-200'}`}
                        onClick={() => { setIsAnimated(v => !v); setFrameFiles([]); setFramePreviews([]) }}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isAnimated ? 'translate-x-5' : ''}`}/>
                      </div>
                      <span className="text-sm font-medium text-gray-700">🎞️ Animated cover (frame sequence)</span>
                    </label>
                    {isAnimated && (
                      <p className="text-xs text-gray-500 mt-1">
                        Upload frames in order. Frame 1 = closed cover. Last frame = fully opened. Played at ~10fps when user clicks.
                      </p>
                    )}
                  </div>
                )}

                {/* Frame uploader */}
                {isAnimated && uploadType === 'cover' ? (
                  <div className="space-y-3">
                    <div
                      className="border-2 border-dashed border-amber-300 rounded-xl p-4 text-center bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors"
                      onClick={() => framesInputRef.current?.click()}
                    >
                      <input
                        ref={framesInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFramesPick}
                      />
                      <p className="text-2xl mb-1">🎞️</p>
                      <p className="text-sm text-amber-700 font-medium">Click to add frames</p>
                      <p className="text-xs text-gray-500">Select multiple images — drag to reorder below</p>
                    </div>
                    {framePreviews.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-600">{framePreviews.length} frames — first frame is the static cover:</p>
                        <div className="grid grid-cols-4 gap-2">
                          {framePreviews.map((src, idx) => (
                            <div key={idx} className="relative rounded-lg overflow-hidden border border-amber-200 bg-gray-50">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt={`Frame ${idx + 1}`} className="w-full h-auto object-contain" />
                              <div className="absolute top-0 left-0 bg-amber-600 text-white text-xs px-1 rounded-br">{idx + 1}</div>
                              <div className="flex justify-between px-1 py-0.5 bg-white/80">
                                <button onClick={() => moveFrame(idx, -1)} disabled={idx === 0} className="text-gray-500 hover:text-gray-700 disabled:opacity-30 text-xs">◀</button>
                                <button onClick={() => removeFrame(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                                <button onClick={() => moveFrame(idx, 1)} disabled={idx === framePreviews.length - 1} className="text-gray-500 hover:text-gray-700 disabled:opacity-30 text-xs">▶</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                <Button
                  onClick={handleUpload}
                  disabled={uploading || (isAnimated ? frameFiles.length < 2 : !file) || !skinName.trim()}
                  isLoading={uploading}
                  className="w-full"
                >
                  {uploading ? 'Uploading & resizing…' : isAnimated ? `⬆️ Upload ${frameFiles.length} Frames` : '⬆️ Upload Skin'}
                </Button>

                {/* Layout editor — cover only, shown after image is selected */}
                {uploadType === 'cover' && preview && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setShowLayoutEditor(v => !v)}
                      className="w-full py-2 px-4 text-sm font-medium rounded-xl border-2 border-dashed border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                    >
                      🎨 {showLayoutEditor ? 'Hide' : 'Customise'} Title &amp; Prompt Layout
                    </button>
                  </div>
                )}
              </div>

              {/* Right: live preview at correct aspect ratio */}
              <div className="flex flex-col items-center">
                <p className="text-sm font-medium text-gray-600 mb-2">Preview ({targetW}×{targetH}px)</p>
                <div
                  className="rounded-lg overflow-hidden border-2 border-amber-200 shadow-md"
                  style={{
                    width: uploadType === 'cover' ? 160 : 280,
                    height: uploadType === 'cover' ? 248 : 217,
                    background: preview
                      ? undefined
                      : uploadType === 'page'
                      ? 'linear-gradient(to bottom, #faf6ee 0%, #f2e8d5 50%, #ede0c4 100%)'
                      : 'linear-gradient(160deg, #c8b08a 0%, #b09060 35%, #9a7a48 70%, #7a5e30 100%)',
                  }}
                >
                  {preview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  )}
                  {!preview && (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                      No image selected
                    </div>
                  )}
                </div>
                {preview && (
                  <p className="text-xs text-green-600 mt-2">
                    ✅ Resized to {targetW}×{targetH}px
                  </p>
                )}
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* ── Cover layout editor (shown when cover image is selected and toggle is on) ── */}
        {uploadType === 'cover' && preview && showLayoutEditor && (
          <Card>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <span>🎨</span> Customise Title &amp; Prompt Layout
              </Card.Title>
              <p className="text-xs text-gray-500 mt-0.5">
                Drag the labels to reposition. These settings are saved with the skin and applied automatically.
              </p>
            </Card.Header>
            <Card.Body>
              <CoverLayoutEditor
                imageUrl={preview}
                layout={coverLayout}
                onChange={setCoverLayout}
              />
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
                ✅ Layout will be saved with the skin. When uploaded, both title position and "Open the Book" position are bundled together.
              </div>
            </Card.Body>
          </Card>
        )}

        {/* ── Existing skins ── */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading skins…</div>
        ) : (
          <>
            <SkinGrid
              title="📖 Cover Skins"
              subtitle={`${COVER_W}×${COVER_H}px — used as the book cover background`}
              skins={coverSkins}
              onSetDefault={setDefault}
              onToggleActive={toggleActive}
              onToggleVisibility={toggleVisibility}
              onSellInShop={(skin) => { setSellingSkin(skin); setSellPrice('') }}
              onRemoveFromShop={handleRemoveFromShop}
              onDelete={deleteSkin}
              onEditOverlays={(skin) => openOverlayEditor(skin)}
              previewW={160}
              previewH={248}
            />
            <SkinGrid
              title="📄 Page Skins"
              subtitle={`${PAGE_W}×${PAGE_H}px — applied to each open page (left and right use the same image)`}
              skins={pageSkins}
              onSetDefault={setDefault}
              onToggleActive={toggleActive}
              onToggleVisibility={toggleVisibility}
              onSellInShop={(skin) => { setSellingSkin(skin); setSellPrice('') }}
              onRemoveFromShop={handleRemoveFromShop}
              onDelete={deleteSkin}
              previewW={280}
              previewH={217}
            />
          </>
        )}

        {/* ── How to sell in shop ── */}
        <Card className="bg-blue-50 border-blue-200">
          <Card.Body>
            <h3 className="font-semibold text-blue-800 mb-2">💡 How to sell a skin in the shop</h3>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Upload the skin here and note its name.</li>
              <li>Go to <strong>Admin → Shop</strong> and create a new shop item (commodity type: <em>standard</em>).</li>
              <li>In the shop item description, note which skin it unlocks.</li>
              <li>When a student redeems it, update their profile with the <code>book_skin_id</code>
              (future: automated via redemption webhook).</li>
            </ol>
          </Card.Body>
        </Card>

      </main>

      {/* ── Price modal ── */}
      {sellingSkin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">🛍️ Sell in Shop</h2>
            <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '2/3' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sellingSkin.image_url} alt={sellingSkin.name}
                className="w-full h-full object-cover" />
            </div>
            <p className="text-sm text-gray-700">
              List <strong>{sellingSkin.name}</strong> in the shop. Students can buy it with their points.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (points) *
              </label>
              <input
                type="number"
                min={1}
                value={sellPrice}
                onChange={e => setSellPrice(e.target.value)}
                placeholder="e.g. 100"
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSellInShop() }}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSellInShop}
                disabled={sellSubmitting || !sellPrice.trim()}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {sellSubmitting ? 'Listing…' : '✅ List in Shop'}
              </button>
              <button
                onClick={() => { setSellingSkin(null); setSellPrice('') }}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlay Editor Modal ── */}
      {overlayEditorSkin && (
        <OverlayEditorModal
          skin={overlayEditorSkin}
          overlays={overlays}
          loading={overlayLoading}
          saving={overlaySaving}
          onSave={saveOverlayConfig}
          onClose={() => setOverlayEditorSkin(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SkinGrid sub-component
// ─────────────────────────────────────────────────────────────────────────────
function SkinGrid({
  title,
  subtitle,
  skins,
  onSetDefault,
  onToggleActive,
  onToggleVisibility,
  onSellInShop,
  onRemoveFromShop,
  onDelete,
  onEditOverlays,
  previewW,
  previewH,
}: {
  title: string
  subtitle: string
  skins: BookSkin[]
  onSetDefault: (s: BookSkin) => void
  onToggleActive: (s: BookSkin) => void
  onToggleVisibility: (s: BookSkin) => void
  onSellInShop: (s: BookSkin) => void
  onRemoveFromShop: (s: BookSkin) => void
  onDelete: (s: BookSkin) => void
  onEditOverlays?: (s: BookSkin) => void
  previewW: number
  previewH: number
}) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </Card.Header>
      <Card.Body>
        {skins.length === 0 ? (
          <p className="text-gray-500 text-sm italic text-center py-6">No skins uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {skins.map(skin => (
              <div
                key={skin.id}
                className={`rounded-xl border-2 overflow-hidden flex flex-col transition-all ${
                  skin.is_default
                    ? 'border-amber-400 shadow-md'
                    : skin.is_active
                    ? 'border-gray-200 hover:border-amber-200'
                    : 'border-gray-100 opacity-50'
                }`}
              >
                {/* Thumbnail */}
                <div
                  className="relative overflow-hidden bg-gray-100 flex-shrink-0"
                  style={{ width: '100%', paddingBottom: `${(previewH / previewW) * 100}%` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={skin.image_url}
                    alt={skin.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />

                  {/* Title overlay — shown for cover skins that have layout data */}
                  {skin.skin_type === 'cover' && (
                    <>
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left: `${skin.cover_layout?.title?.x ?? 50}%`,
                          top: `${skin.cover_layout?.title?.y ?? 22}%`,
                          transform: 'translate(-50%, -50%)',
                          textAlign: 'center',
                          width: '90%',
                          maxWidth: '90%',
                        }}
                      >
                        <span
                          style={{
                            fontSize: Math.max(7, Math.round((skin.cover_layout?.title?.fontSize ?? 20) * previewW / 400)),
                            color: skin.cover_layout?.title?.color ?? '#2d1a00',
                            fontFamily: '"Georgia", serif',
                            fontWeight: 'bold',
                            textShadow: skin.cover_layout?.title?.shadow !== false
                              ? '0 1px 3px rgba(255,255,255,0.5), 0 0 8px rgba(0,0,0,0.4)'
                              : undefined,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Title
                        </span>
                      </div>
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left: `${skin.cover_layout?.prompt?.x ?? 50}%`,
                          top: `${skin.cover_layout?.prompt?.y ?? 82}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: Math.max(6, Math.round((skin.cover_layout?.prompt?.fontSize ?? 14) * previewW / 400)),
                            color: skin.cover_layout?.prompt?.color ?? 'rgba(240,215,140,0.95)',
                            fontFamily: '"Georgia", serif',
                            fontWeight: 'bold',
                            background: 'rgba(40,25,5,0.65)',
                            padding: '1px 5px',
                            borderRadius: '999px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Open the Book
                        </span>
                      </div>
                    </>
                  )}
                  {skin.is_default && (
                    <div className="absolute top-1 right-1 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                      Default
                    </div>
                  )}
                  {!skin.is_active && (
                    <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center">
                      <span className="text-white text-xs font-semibold bg-gray-800/80 px-2 py-1 rounded">Inactive</span>
                    </div>
                  )}
                </div>

                {/* Info & actions */}
                <div className="p-2 bg-white flex-1 flex flex-col gap-1">
                  <p className="text-xs font-semibold text-gray-800 truncate">{skin.name}</p>
                  {skin.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">{skin.description}</p>
                  )}
                  {/* Visibility badge */}
                  <span className={`text-xs font-medium inline-flex items-center gap-1 ${
                    skin.visibility === 'public' ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {skin.visibility === 'public' ? '👥 Public' : '🔒 Admin only'}
                  </span>
                  {skin.shop_item_id && (
                    <span className="text-xs text-blue-600 font-medium">🛒 In shop</span>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {!skin.is_default && (
                      <button
                        onClick={() => onSetDefault(skin)}
                        className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        Set default
                      </button>
                    )}
                    <button
                      onClick={() => onToggleVisibility(skin)}
                      className={`text-xs px-2 py-1 border rounded-lg transition-colors ${
                        skin.visibility === 'public'
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {skin.visibility === 'public' ? '🔒 Make private' : '👥 Make public'}
                    </button>
                    <button
                      onClick={() => onToggleActive(skin)}
                      className={`text-xs px-2 py-1 border rounded-lg transition-colors ${
                        skin.is_active
                          ? 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                      }`}
                    >
                      {skin.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    {/* Shop listing */}
                    {skin.shop_item_id ? (
                      <button
                        onClick={() => onRemoveFromShop(skin)}
                        className="text-xs px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                      >
                        🛒 Remove from shop
                      </button>
                    ) : (
                      <button
                        onClick={() => onSellInShop(skin)}
                        className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        🛍️ Sell in shop
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(skin)}
                      className="text-xs px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                    {/* Overlay animation editor — cover skins with has_overlays */}
                    {skin.skin_type === 'cover' && (skin as any).has_overlays && onEditOverlays && (
                      <button
                        onClick={() => onEditOverlays(skin)}
                        className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors w-full"
                      >
                        ✨ Animate Overlays
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay animation types
// ─────────────────────────────────────────────────────────────────────────────
type OverlayAnimation = 'none' | 'float' | 'pulse' | 'rotate' | 'shimmer' | 'bounce'

interface OverlayConfig {
  x: number           // % of cover width, 0–100
  y: number           // % of cover height, 0–100
  scale: number       // 0.3–2.0
  animation: OverlayAnimation
}

interface OverlayObject {
  id: string
  skin_id: string
  label: string
  image_url: string
  sort_order: number
  overlay_config: OverlayConfig | null
}

const DEFAULT_OVERLAY_CONFIG: OverlayConfig = { x: 15, y: 15, scale: 1.0, animation: 'float' }

const ANIMATION_OPTIONS: { value: OverlayAnimation; label: string; description: string }[] = [
  { value: 'none',    label: '⏸ None',    description: 'Static — no movement' },
  { value: 'float',   label: '🌊 Float',   description: 'Gentle up-down bobbing' },
  { value: 'pulse',   label: '💗 Pulse',   description: 'Slow scale in/out breathing' },
  { value: 'rotate',  label: '🔄 Rotate',  description: 'Continuous slow rotation' },
  { value: 'shimmer', label: '✨ Shimmer', description: 'Opacity glow fade in/out' },
  { value: 'bounce',  label: '🏀 Bounce',  description: 'Playful spring bounce' },
]

const OVERLAY_KEYFRAMES = `
@keyframes ov-float   { 0%,100%{transform:translateY(0)}    50%{transform:translateY(-8px)} }
@keyframes ov-pulse   { 0%,100%{transform:scale(1)}         50%{transform:scale(1.12)} }
@keyframes ov-rotate  { from{transform:rotate(0deg)}        to{transform:rotate(360deg)} }
@keyframes ov-shimmer { 0%,100%{opacity:1}                  50%{opacity:0.45} }
@keyframes ov-bounce  { 0%,100%{transform:translateY(0)}    40%{transform:translateY(-14px)} 60%{transform:translateY(-6px)} }
`

const ANIMATION_CSS: Record<OverlayAnimation, string> = {
  none:    '',
  float:   'ov-float 3s ease-in-out infinite',
  pulse:   'ov-pulse 2.5s ease-in-out infinite',
  rotate:  'ov-rotate 8s linear infinite',
  shimmer: 'ov-shimmer 2s ease-in-out infinite',
  bounce:  'ov-bounce 1.8s ease-in-out infinite',
}

// ─────────────────────────────────────────────────────────────────────────────
// OverlayEditorModal
// ─────────────────────────────────────────────────────────────────────────────
function OverlayEditorModal({
  skin,
  overlays,
  loading,
  saving,
  onSave,
  onClose,
}: {
  skin: BookSkin
  overlays: OverlayObject[]
  loading: boolean
  saving: boolean
  onSave: (overlay: OverlayObject, config: OverlayConfig) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string | null>(overlays[0]?.id ?? null)
  const [configs, setConfigs] = useState<Record<string, OverlayConfig>>(() => {
    const init: Record<string, OverlayConfig> = {}
    for (const o of overlays) init[o.id] = o.overlay_config ?? { ...DEFAULT_OVERLAY_CONFIG }
    return init
  })
  const previewRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  const selectedOverlay = overlays.find(o => o.id === selected)
  const cfg = selected ? (configs[selected] ?? DEFAULT_OVERLAY_CONFIG) : null

  function updateCfg(id: string, patch: Partial<OverlayConfig>) {
    setConfigs(prev => ({ ...prev, [id]: { ...(prev[id] ?? DEFAULT_OVERLAY_CONFIG), ...patch } }))
  }

  function handlePreviewMouseDown(e: React.MouseEvent, id: string) {
    e.preventDefault()
    const rect = previewRef.current?.getBoundingClientRect()
    if (!rect) return
    const c = configs[id] ?? DEFAULT_OVERLAY_CONFIG
    dragging.current = { id, startX: e.clientX, startY: e.clientY, origX: c.x, origY: c.y }
    setSelected(id)
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !previewRef.current) return
      const r = previewRef.current.getBoundingClientRect()
      const dx = ((ev.clientX - dragging.current.startX) / r.width) * 100
      const dy = ((ev.clientY - dragging.current.startY) / r.height) * 100
      updateCfg(id, {
        x: Math.max(0, Math.min(100, dragging.current.origX + dx)),
        y: Math.max(0, Math.min(100, dragging.current.origY + dy)),
      })
    }
    const onUp = () => {
      dragging.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function handlePreviewTouchStart(e: React.TouchEvent, id: string) {
    const rect = previewRef.current?.getBoundingClientRect()
    if (!rect) return
    const touch = e.touches[0]
    const c = configs[id] ?? DEFAULT_OVERLAY_CONFIG
    dragging.current = { id, startX: touch.clientX, startY: touch.clientY, origX: c.x, origY: c.y }
    setSelected(id)
    const onMove = (ev: TouchEvent) => {
      ev.preventDefault()
      if (!dragging.current || !previewRef.current) return
      const r = previewRef.current.getBoundingClientRect()
      const t = ev.touches[0]
      const dx = ((t.clientX - dragging.current.startX) / r.width) * 100
      const dy = ((t.clientY - dragging.current.startY) / r.height) * 100
      updateCfg(id, {
        x: Math.max(0, Math.min(100, dragging.current.origX + dx)),
        y: Math.max(0, Math.min(100, dragging.current.origY + dy)),
      })
    }
    const onEnd = () => {
      dragging.current = null
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <style>{OVERLAY_KEYFRAMES}</style>
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <div className="font-bold text-gray-900">✨ Animate Overlays — {skin.name}</div>
            <div className="text-xs text-gray-400 mt-0.5">Drag objects on the preview to position · pick animation · save</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light">×</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 py-16">Loading overlays…</div>
        ) : overlays.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 py-16 px-6 text-center">
            <div>
              <div className="text-4xl mb-3">😶</div>
              <p className="text-sm">No overlay objects found for this skin.</p>
              <p className="text-xs text-gray-400 mt-1">
                Overlay objects are created when saving an AI-generated cover with &quot;Extract corner objects&quot; enabled.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Left — cover preview with draggable overlays */}
            <div className="md:w-[280px] shrink-0 p-4 flex flex-col items-center gap-3 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200">
              <p className="text-xs font-semibold text-gray-500 self-start">Drag to position</p>
              <div
                ref={previewRef}
                className="relative rounded-xl overflow-hidden border-2 border-amber-200 shadow"
                style={{ width: 200, height: 310, userSelect: 'none' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={skin.image_url} alt={skin.name} className="w-full h-full object-cover" draggable={false} />
                {overlays.map(o => {
                  const c = configs[o.id] ?? DEFAULT_OVERLAY_CONFIG
                  const isSelected = selected === o.id
                  const OVERLAY_SIZE = Math.round(60 * c.scale)
                  return (
                    <div
                      key={o.id}
                      onMouseDown={e => handlePreviewMouseDown(e, o.id)}
                      onTouchStart={e => handlePreviewTouchStart(e, o.id)}
                      style={{
                        position: 'absolute',
                        left: `${c.x}%`,
                        top: `${c.y}%`,
                        transform: 'translate(-50%, -50%)',
                        width: OVERLAY_SIZE,
                        height: OVERLAY_SIZE,
                        cursor: 'grab',
                        zIndex: isSelected ? 10 : 5,
                        outline: isSelected ? '2px solid #a855f7' : undefined,
                        borderRadius: 4,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={o.image_url}
                        alt={o.label}
                        style={{
                          width: '100%', height: '100%',
                          objectFit: 'contain',
                          animation: c.animation !== 'none' ? ANIMATION_CSS[c.animation] : undefined,
                          pointerEvents: 'none',
                        }}
                        draggable={false}
                      />
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-400 text-center">Purple outline = selected object</p>
            </div>

            {/* Right — controls */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {/* Object picker */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Objects ({overlays.length})</p>
                <div className="flex flex-wrap gap-2">
                  {overlays.map(o => (
                    <button key={o.id} onClick={() => setSelected(o.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border-2 transition-colors ${
                        selected === o.id ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={o.image_url} alt={o.label} className="w-6 h-6 object-contain" />
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedOverlay && cfg && (
                <div className="space-y-4 border border-gray-100 rounded-xl p-4">
                  <p className="text-sm font-bold text-gray-800 capitalize">{selectedOverlay.label}</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">X <span className="font-normal text-gray-400">({Math.round(cfg.x)}%)</span></label>
                      <input type="range" min={0} max={100} step={1} value={cfg.x}
                        onChange={e => updateCfg(selectedOverlay.id, { x: Number(e.target.value) })}
                        className="w-full accent-purple-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Y <span className="font-normal text-gray-400">({Math.round(cfg.y)}%)</span></label>
                      <input type="range" min={0} max={100} step={1} value={cfg.y}
                        onChange={e => updateCfg(selectedOverlay.id, { y: Number(e.target.value) })}
                        className="w-full accent-purple-600" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Scale <span className="font-normal text-gray-400">({cfg.scale.toFixed(1)}×)</span></label>
                    <input type="range" min={0.3} max={2.0} step={0.1} value={cfg.scale}
                      onChange={e => updateCfg(selectedOverlay.id, { scale: Number(e.target.value) })}
                      className="w-full accent-purple-600" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Animation</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ANIMATION_OPTIONS.map(opt => (
                        <button key={opt.value} onClick={() => updateCfg(selectedOverlay.id, { animation: opt.value })}
                          className={`px-2 py-2 rounded-xl text-xs font-semibold border-2 text-left transition-colors ${
                            cfg.animation === opt.value ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          }`}>
                          <div>{opt.label}</div>
                          <div className="text-[10px] font-normal text-gray-400 mt-0.5">{opt.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={saving}
                    onClick={() => onSave(selectedOverlay, configs[selectedOverlay.id] ?? DEFAULT_OVERLAY_CONFIG)}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold rounded-xl text-sm"
                  >
                    {saving ? '⏳ Saving…' : `💾 Save "${selectedOverlay.label}"`}
                  </button>
                </div>
              )}

              {overlays.length > 1 && (
                <button
                  disabled={saving}
                  onClick={async () => {
                    for (const o of overlays) await onSave(o, configs[o.id] ?? DEFAULT_OVERLAY_CONFIG)
                  }}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold rounded-xl text-sm"
                >
                  {saving ? '⏳ Saving…' : `💾 Save All ${overlays.length} Objects`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
