'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HomeButton } from '@/components/ui/HomeButton'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface BookSkin {
  id: string
  name: string
  description: string | null
  skin_type: 'cover' | 'page'
  image_url: string
  is_default: boolean
}

interface UserPrefs {
  cover_skin_id: string | null
  page_skin_id: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function BookSkinsUserPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [allSkins, setAllSkins] = useState<BookSkin[]>([])
  const [prefs, setPrefs] = useState<UserPrefs>({ cover_skin_id: null, page_skin_id: null })
  const [userId, setUserId] = useState<string | null>(null)

  // ── Load skins + user prefs ─────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // Fetch all active PUBLIC skins (admin_only skins are not shown to users)
      const { data: skins } = await supabase
        .from('book_skins')
        .select('id, name, description, skin_type, image_url, is_default')
        .eq('is_active', true)
        .eq('visibility', 'public')
        .order('is_default', { ascending: false })  // default first

      // Also fetch skins the user has purchased via redemptions
      const { data: purchasedSkins } = await supabase
        .from('redemptions')
        .select('book_skin_id, book_skins:book_skin_id(id, name, description, skin_type, image_url, is_default)')
        .eq('user_id', user.id)
        .is('refunded_at', null)
        .not('book_skin_id', 'is', null)

      // Merge: public skins + purchased ones not already in the list
      const publicIds = new Set((skins ?? []).map((s: any) => s.id))
      const purchasedRows = (purchasedSkins ?? [])
        .map((r: any) => r.book_skins)
        .filter((s: any) => s && !publicIds.has(s.id))

      setAllSkins([...(skins ?? []), ...purchasedRows] as BookSkin[])

      // Fetch user's current preference (may not exist yet)
      const { data: prefRow } = await supabase
        .from('user_book_skin_preferences')
        .select('cover_skin_id, page_skin_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (prefRow) {
        setPrefs({ cover_skin_id: prefRow.cover_skin_id, page_skin_id: prefRow.page_skin_id })
      }

      setLoading(false)
    }
    load()
  }, [])

  // ── Save prefs ──────────────────────────────────────────────────────────────
  async function savePrefs() {
    if (!userId) return
    setSaving(true)
    setError(null)
    setSuccess(false)

    const { error: upsertErr } = await supabase
      .from('user_book_skin_preferences')
      .upsert({
        user_id: userId,
        cover_skin_id: prefs.cover_skin_id,
        page_skin_id: prefs.page_skin_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    setSaving(false)
    if (upsertErr) {
      setError('Failed to save: ' + upsertErr.message)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const coverSkins = allSkins.filter(s => s.skin_type === 'cover')
  const pageSkins  = allSkins.filter(s => s.skin_type === 'page')

  // The skin that will actually be shown (null = sitewide default)
  const effectiveCover = prefs.cover_skin_id ?? null
  const effectivePage  = prefs.page_skin_id  ?? null

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <HomeButton />
          <span className="text-gray-400">/</span>
          <h1 className="font-bold text-gray-900">Book &amp; Cover</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Intro */}
        <div className="text-center">
          <div className="text-5xl mb-3">📖</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Personalise Your Book</h2>
          <p className="text-sm text-gray-500">
            Choose how your challenge book looks. More skins available in the shop.
          </p>
        </div>

        {/* Admin shortcut — only visible to admins/teachers */}
        <AdminUploadBanner />

        {/* Error / success */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            ✅ Saved! Your book will use these skins next time you open a challenge.
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading your collection…</div>
        ) : (
          <>
            {/* ── Cover skin picker ── */}
            <SkinPicker
              title="📖 Book Cover"
              description="The cover you see before opening a challenge."
              skins={coverSkins}
              selectedId={effectiveCover}
              onSelect={(id) => setPrefs(p => ({ ...p, cover_skin_id: id }))}
              previewAspect={400 / 620}
              skinType="cover"
            />

            {/* ── Page skin picker ── */}
            <SkinPicker
              title="📄 Inner Page"
              description="The background of the open book pages."
              skins={pageSkins}
              selectedId={effectivePage}
              onSelect={(id) => setPrefs(p => ({ ...p, page_skin_id: id }))}
              previewAspect={400 / 620}
              skinType="page"
            />

            {/* Save button */}
            <div className="flex justify-center pt-2">
              <Button
                onClick={savePrefs}
                disabled={saving}
                isLoading={saving}
                size="lg"
                className="px-10"
              >
                {saving ? 'Saving…' : '💾 Save My Selection'}
              </Button>
            </div>

            {/* Coming soon note */}
            <Card className="bg-blue-50 border-blue-200">
              <Card.Body>
                <p className="text-sm text-blue-700 text-center">
                  🛍️ More cover and page designs will be available in the <strong>Shop</strong> to unlock with your points.
                </p>
              </Card.Body>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SkinPicker sub-component
// ─────────────────────────────────────────────────────────────────────────────
function SkinPicker({
  title,
  description,
  skins,
  selectedId,
  onSelect,
  previewAspect,
  skinType,
}: {
  title: string
  description: string
  skins: BookSkin[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  previewAspect: number  // width / height
  skinType: 'cover' | 'page'
}) {
  // Find the default skin for this type (may be null if none set)
  const defaultSkin = skins.find(s => s.is_default) ?? null

  return (
    <Card>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </Card.Header>
      <Card.Body>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">

          {/* Always show the "Default" option first */}
          <SkinOption
            label="Default"
            sublabel={defaultSkin ? defaultSkin.name : 'Built-in parchment'}
            imageUrl={defaultSkin?.image_url ?? null}
            isSelected={selectedId === null}
            onClick={() => onSelect(null)}
            aspect={previewAspect}
            badge="⭐"
            skinType={skinType}
          />

          {/* User's owned skins — for now only defaults are available */}
          {skins.filter(s => !s.is_default).map(skin => (
            <SkinOption
              key={skin.id}
              label={skin.name}
              sublabel={skin.description ?? undefined}
              imageUrl={skin.image_url}
              isSelected={selectedId === skin.id}
              onClick={() => onSelect(skin.id)}
              aspect={previewAspect}
              skinType={skinType}
            />
          ))}

          {/* Placeholder to show the shop teaser */}
          <div
            className="rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-4 cursor-pointer hover:border-amber-300 hover:bg-amber-50 transition-colors"
            style={{ aspectRatio: String(previewAspect) }}
            onClick={() => window.location.href = '/shop'}
          >
            <div className="text-2xl mb-1">🛍️</div>
            <p className="text-xs font-medium text-gray-500">More in Shop</p>
          </div>

        </div>
      </Card.Body>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual skin option card
// ─────────────────────────────────────────────────────────────────────────────
function SkinOption({
  label,
  sublabel,
  imageUrl,
  isSelected,
  onClick,
  aspect,
  badge,
  skinType,
}: {
  label: string
  sublabel?: string
  imageUrl: string | null
  isSelected: boolean
  onClick: () => void
  aspect: number
  badge?: string
  skinType: 'cover' | 'page'
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 overflow-hidden flex flex-col text-left transition-all focus:outline-none ${
        isSelected
          ? 'border-amber-500 shadow-lg shadow-amber-100'
          : 'border-gray-200 hover:border-amber-300'
      }`}
    >
      {/* Thumbnail */}
      <div
        className="relative w-full overflow-hidden bg-gray-100"
        style={{ paddingBottom: `${(1 / aspect) * 100}%` }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          /* Fallback — show the built-in default skin preview */
          <div
            className="absolute inset-0"
            style={{
              background: skinType === 'page'
                ? 'linear-gradient(to bottom, #faf6ee 0%, #f2e8d5 50%, #ede0c4 100%)'
                : 'linear-gradient(160deg, #c8b08a 0%, #b09060 35%, #9a7a48 70%, #7a5e30 100%)',
            }}
          />
        )}

        {/* Selected checkmark */}
        {isSelected && (
          <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow">
            ✓
          </div>
        )}

        {/* Badge (e.g. ⭐ for default) */}
        {badge && !isSelected && (
          <div className="absolute top-1.5 left-1.5 text-sm leading-none">
            {badge}
          </div>
        )}
      </div>

      {/* Label */}
      <div className={`px-2 py-2 text-xs font-semibold truncate ${isSelected ? 'text-amber-700 bg-amber-50' : 'text-gray-700 bg-white'}`}>
        {label}
        {sublabel && (
          <span className="block font-normal text-gray-400 truncate">{sublabel}</span>
        )}
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminUploadBanner — shown only to admins/teachers; lets them upload new skins
// with visibility control and sell-in-shop option, inline on this page.
// ─────────────────────────────────────────────────────────────────────────────
const COVER_W = 400
const COVER_H = 620
const PAGE_W  = 400
const PAGE_H  = 620

async function resizeImageToBlob(file: File, targetW: number, targetH: number): Promise<Blob> {
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
      const srcAspect = img.naturalWidth / img.naturalHeight
      const dstAspect = targetW / targetH
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
      if (srcAspect > dstAspect) { sw = img.naturalHeight * dstAspect; sx = (img.naturalWidth - sw) / 2 }
      else { sh = img.naturalWidth / dstAspect; sy = (img.naturalHeight - sh) / 2 }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')) }
    img.src = objectUrl
  })
}

function AdminUploadBanner() {
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checked, setChecked] = useState(false)
  const [open, setOpen] = useState(false)

  const [uploadType, setUploadType] = useState<'cover' | 'page'>('cover')
  const [skinName, setSkinName] = useState('')
  const [skinDesc, setSkinDesc] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<'admin_only' | 'public'>('admin_only')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [sellMode, setSellMode] = useState(false)
  const [sellPrice, setSellPrice] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecked(true); return }
      const { data: roles } = await supabase
        .from('user_roles')
        .select('roles!inner(name)')
        .eq('user_id', user.id)
        .is('class_id', null)
      const admin = (roles as any[])?.some((r: any) => r.roles?.name === 'administrator' || r.roles?.name === 'teacher')
      setIsAdmin(!!admin)
      setChecked(true)
    }
    check()
  }, [])

  if (!checked || !isAdmin) return null

  const targetW = uploadType === 'cover' ? COVER_W : PAGE_W
  const targetH = uploadType === 'cover' ? COVER_H : PAGE_H

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (!picked) return
    if (!picked.type.startsWith('image/')) { setUploadError('Please pick an image file'); return }
    if (picked.size > 20 * 1024 * 1024) { setUploadError('Image must be under 20 MB'); return }
    setUploadError(null)
    setFile(picked)
    try {
      const resized = await resizeImageToBlob(picked, targetW, targetH)
      setPreview(URL.createObjectURL(resized))
    } catch (err: any) { setUploadError('Could not resize image: ' + err.message) }
  }

  async function switchType(t: 'cover' | 'page') {
    setUploadType(t)
    if (!file) return
    const w = t === 'cover' ? COVER_W : PAGE_W
    const h = t === 'cover' ? COVER_H : PAGE_H
    try {
      const resized = await resizeImageToBlob(file, w, h)
      setPreview(URL.createObjectURL(resized))
    } catch (_) {}
  }

  async function handleUpload() {
    if (!file || !skinName.trim()) { setUploadError('Please choose an image and enter a name'); return }
    setUploadError(null); setUploadSuccess(null); setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const resizedBlob = await resizeImageToBlob(file, targetW, targetH)
      const fileName = `${uploadType}/${user.id}/${Date.now()}.png`
      const { error: uploadErr } = await supabase.storage.from('book-skins').upload(fileName, resizedBlob, { contentType: 'image/png', upsert: false })
      if (uploadErr) throw new Error('Storage upload failed: ' + uploadErr.message)
      const { data: { publicUrl } } = supabase.storage.from('book-skins').getPublicUrl(fileName)

      const { data: newSkin, error: insertErr } = await supabase
        .from('book_skins')
        .insert({ name: skinName.trim(), description: skinDesc.trim() || null, skin_type: uploadType, image_url: publicUrl, width: targetW, height: targetH, created_by: user.id, visibility })
        .select('id').single()
      if (insertErr || !newSkin) throw new Error('DB insert failed: ' + insertErr?.message)

      if (sellMode && sellPrice.trim()) {
        const price = parseInt(sellPrice.trim(), 10)
        if (!isNaN(price) && price > 0) {
          const { data: newItem, error: itemErr } = await supabase
            .from('shop_items')
            .insert({ title: skinName.trim(), description: skinDesc.trim() || `Book ${uploadType} skin`, cost: price, image_url: publicUrl, is_active: true, created_by: user.id, category: 'other', commodity_type: 'standard', draws_per_redemption: 1 })
            .select('id').single()
          if (!itemErr && newItem) {
            await supabase.from('book_skins').update({ shop_item_id: newItem.id, visibility: 'shop_only' }).eq('id', newSkin.id)
          }
        }
      }

      setUploadSuccess(`✅ "${skinName.trim()}" uploaded!`)
      setSkinName(''); setSkinDesc(''); setFile(null); setPreview(null)
      setSellMode(false); setSellPrice('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: any) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="border-amber-300 bg-amber-50">
      <Card.Body>
        <button className="w-full flex items-center justify-between text-left" onClick={() => setOpen(v => !v)}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔧</span>
            <div>
              <div className="font-bold text-amber-800 text-sm">Admin: Upload New Book Skin</div>
              <div className="text-xs text-amber-600">Set visibility, sell in shop</div>
            </div>
          </div>
          <span className="text-amber-600 font-bold text-lg">{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
                <span>{uploadError}</span>
                <button onClick={() => setUploadError(null)} className="font-bold ml-3">✕</button>
              </div>
            )}
            {uploadSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex justify-between">
                <span>{uploadSuccess}</span>
                <button onClick={() => setUploadSuccess(null)} className="font-bold ml-3">✕</button>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                {/* Type */}
                <div>
                  <label className="block text-xs font-semibold text-amber-800 mb-1">Skin Type</label>
                  <div className="flex gap-2">
                    {(['cover', 'page'] as const).map(t => (
                      <button key={t} onClick={() => switchType(t)}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold border-2 transition-colors ${uploadType === t ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'}`}>
                        {t === 'cover' ? '📖 Cover' : '📄 Page'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-amber-800 mb-1">Name *</label>
                  <input type="text" value={skinName} onChange={e => setSkinName(e.target.value)}
                    placeholder='e.g. "Treasure Map"'
                    className="w-full px-3 py-2 border-2 border-amber-200 rounded-xl text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white" />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-amber-800 mb-1">Description</label>
                  <textarea value={skinDesc} onChange={e => setSkinDesc(e.target.value)}
                    placeholder="Optional — shown in the shop" rows={2}
                    className="w-full px-3 py-2 border-2 border-amber-200 rounded-xl text-sm focus:border-amber-400 bg-white resize-none" />
                </div>

                {/* File picker */}
                <div>
                  <label className="block text-xs font-semibold text-amber-800 mb-1">Image *</label>
                  <div className="border-2 border-dashed border-amber-300 rounded-xl p-3 text-center bg-white cursor-pointer hover:bg-amber-50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFilePick} />
                    {file
                      ? <p className="text-xs text-amber-700 font-medium">{file.name}</p>
                      : <><p className="text-xl mb-0.5">📸</p><p className="text-xs text-amber-700">Click to choose (max 20 MB)</p></>}
                  </div>
                </div>

                {/* Visibility */}
                <div>
                  <label className="block text-xs font-semibold text-amber-800 mb-1">Visibility</label>
                  <div className="flex gap-2">
                    {(['admin_only', 'public'] as const).map(v => (
                      <button key={v} onClick={() => setVisibility(v)}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold border-2 transition-colors ${visibility === v ? (v === 'public' ? 'bg-green-600 text-white border-green-600' : 'bg-gray-700 text-white border-gray-700') : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                        {v === 'public' ? '👥 Public' : '🔒 Admin only'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600 mt-1">
                    {visibility === 'admin_only' ? 'Only usable as sitewide default. Not visible in user picker.' : 'Visible in user Book & Cover picker and sellable in shop.'}
                  </p>
                </div>

                {/* Sell in shop */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={sellMode} onChange={e => setSellMode(e.target.checked)} className="accent-amber-600" />
                  <span className="text-xs font-semibold text-amber-800">🛍️ Sell in Shop</span>
                </label>
                {sellMode && (
                  <div>
                    <label className="block text-xs font-semibold text-amber-800 mb-1">Price (points) *</label>
                    <input type="number" min={1} value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full px-3 py-2 border-2 border-amber-200 rounded-xl text-sm focus:border-amber-400 bg-white" />
                  </div>
                )}

                <Button onClick={handleUpload} disabled={uploading || !file || !skinName.trim()} isLoading={uploading} className="w-full">
                  {uploading ? 'Uploading…' : '⬆️ Upload Skin'}
                </Button>

                <a href="/admin/book-skins" className="block text-center text-xs text-amber-700 hover:underline mt-1">
                  → Open full admin panel (manage all skins, animated frames, set default…)
                </a>
              </div>

              {/* Preview */}
              <div className="flex flex-col items-center justify-start">
                <p className="text-xs font-medium text-amber-700 mb-2">Preview</p>
                <div className="rounded-lg overflow-hidden border-2 border-amber-200 shadow-md bg-gray-100" style={{ width: 120, height: 186 }}>
                  {preview
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">📖</div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
