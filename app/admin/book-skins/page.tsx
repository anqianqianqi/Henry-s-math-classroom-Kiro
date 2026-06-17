'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HomeButton } from '@/components/ui/HomeButton'

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

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!file || !skinName.trim()) {
      setError('Please choose an image and enter a name')
      return
    }
    setError(null)
    setSuccess(null)
    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Resize to exact target dimensions
      const resizedBlob = await resizeImageToBlob(file, targetW, targetH)

      // Upload to Supabase storage
      const fileName = `${uploadType}/${user.id}/${Date.now()}.png`
      const { error: uploadErr } = await supabase.storage
        .from('book-skins')
        .upload(fileName, resizedBlob, { contentType: 'image/png', upsert: false })
      if (uploadErr) throw new Error('Storage upload failed: ' + uploadErr.message)

      const { data: { publicUrl } } = supabase.storage
        .from('book-skins')
        .getPublicUrl(fileName)

      // Insert into book_skins table
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
        })
      if (insertErr) throw new Error('DB insert failed: ' + insertErr.message)

      setSuccess(`✅ "${skinName.trim()}" uploaded successfully!`)
      setSkinName('')
      setSkinDesc('')
      setFile(null)
      setPreview(null)
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

                <Button
                  onClick={handleUpload}
                  disabled={uploading || !file || !skinName.trim()}
                  isLoading={uploading}
                  className="w-full"
                >
                  {uploading ? 'Uploading & resizing…' : '⬆️ Upload Skin'}
                </Button>
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
              onDelete={deleteSkin}
              previewW={160}
              previewH={248}
            />
            <SkinGrid
              title="📄 Page Skins"
              subtitle={`${PAGE_W}×${PAGE_H}px — applied to each open page (left and right use the same image)`}
              skins={pageSkins}
              onSetDefault={setDefault}
              onToggleActive={toggleActive}
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
  onDelete,
  previewW,
  previewH,
}: {
  title: string
  subtitle: string
  skins: BookSkin[]
  onSetDefault: (s: BookSkin) => void
  onToggleActive: (s: BookSkin) => void
  onDelete: (s: BookSkin) => void
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
                      onClick={() => onToggleActive(skin)}
                      className={`text-xs px-2 py-1 border rounded-lg transition-colors ${
                        skin.is_active
                          ? 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                      }`}
                    >
                      {skin.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => onDelete(skin)}
                      className="text-xs px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
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
