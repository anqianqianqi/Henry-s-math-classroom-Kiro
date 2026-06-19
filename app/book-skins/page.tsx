'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HomeButton } from '@/components/ui/HomeButton'
import { CoverLayoutEditor, DEFAULT_LAYOUT, type CoverLayout } from '@/components/CoverLayoutEditor'

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
  is_active?: boolean
  visibility?: string | null
  shop_item_id?: string | null
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
  const [isAdmin, setIsAdmin] = useState(false)

  // Admin: manage modal
  const [actionSkin, setActionSkin] = useState<BookSkin | null>(null)
  const [actionWorking, setActionWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [sellPrice, setSellPrice] = useState('')
  const [showSellInput, setShowSellInput] = useState(false)

  // ── Load skins + user prefs ─────────────────────────────────────────────────
  async function loadSkins(uid: string, adminRole: boolean) {
    if (adminRole) {
      // Admins see ALL skins (including inactive/admin-only)
      const { data: skins } = await supabase
        .from('book_skins')
        .select('*')
        .order('created_at', { ascending: false })
      setAllSkins((skins ?? []) as BookSkin[])
    } else {
      const { data: skins } = await supabase
        .from('book_skins')
        .select('id, name, description, skin_type, image_url, is_default, is_active, visibility, shop_item_id')
        .eq('is_active', true)
        .eq('visibility', 'public')
        .order('is_default', { ascending: false })

      const { data: purchasedSkins } = await supabase
        .from('redemptions')
        .select('book_skin_id, book_skins:book_skin_id(id, name, description, skin_type, image_url, is_default, is_active, visibility, shop_item_id)')
        .eq('user_id', uid)
        .is('refunded_at', null)
        .not('book_skin_id', 'is', null)

      const publicIds = new Set((skins ?? []).map((s: any) => s.id))
      const purchasedRows = (purchasedSkins ?? [])
        .map((r: any) => r.book_skins)
        .filter((s: any) => s && !publicIds.has(s.id))
      setAllSkins([...(skins ?? []), ...purchasedRows] as BookSkin[])
    }
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: roles } = await supabase
        .from('user_roles').select('roles!inner(name)').eq('user_id', user.id).is('class_id', null)
      const admin = (roles as any[])?.some((r: any) => r.roles?.name === 'administrator' || r.roles?.name === 'teacher')
      setIsAdmin(!!admin)

      await loadSkins(user.id, !!admin)

      const { data: prefRow } = await supabase
        .from('user_book_skin_preferences')
        .select('cover_skin_id, page_skin_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (prefRow) setPrefs({ cover_skin_id: prefRow.cover_skin_id, page_skin_id: prefRow.page_skin_id })

      setLoading(false)
    }
    load()
  }, [])

  // ── Admin skin actions ──────────────────────────────────────────────────────
  async function adminSkinAction(skin: BookSkin, action: 'set_default' | 'make_public' | 'make_private' | 'toggle_active' | 'delete' | 'sell') {
    setActionWorking(true); setActionError(null)
    try {
      if (action === 'set_default') {
        await supabase.from('book_skins').update({ is_default: false }).eq('skin_type', skin.skin_type).eq('is_default', true)
        await supabase.from('book_skins').update({ is_default: true }).eq('id', skin.id)
      } else if (action === 'make_public') {
        await supabase.from('book_skins').update({ visibility: 'public' }).eq('id', skin.id)
      } else if (action === 'make_private') {
        await supabase.from('book_skins').update({ visibility: 'admin_only' }).eq('id', skin.id)
      } else if (action === 'toggle_active') {
        await supabase.from('book_skins').update({ is_active: !skin.is_active }).eq('id', skin.id)
      } else if (action === 'delete') {
        if (!confirm(`Delete "${skin.name}"? This cannot be undone.`)) { setActionWorking(false); return }
        await supabase.from('book_skins').delete().eq('id', skin.id)
        setActionSkin(null)
      } else if (action === 'sell') {
        const price = parseInt(sellPrice, 10)
        if (isNaN(price) || price < 1) { setActionError('Enter a valid price.'); setActionWorking(false); return }
        const { data: newItem, error: itemErr } = await supabase.from('shop_items').insert({
          title: skin.name, description: skin.description || `Book ${skin.skin_type} skin`, cost: price,
          image_url: skin.image_url, is_active: true, created_by: userId,
          category: 'other', commodity_type: 'standard', draws_per_redemption: 1,
        }).select('id').single()
        if (itemErr || !newItem) throw new Error('Shop item creation failed')
        await supabase.from('book_skins').update({ shop_item_id: newItem.id, visibility: 'public' }).eq('id', skin.id)
        setShowSellInput(false); setSellPrice('')
      }
      await loadSkins(userId!, isAdmin)
      if (action !== 'delete') {
        const { data: fresh } = await supabase.from('book_skins').select('*').eq('id', skin.id).single()
        if (fresh) setActionSkin(fresh as BookSkin)
      }
    } catch (err: any) { setActionError(err.message) }
    finally { setActionWorking(false) }
  }

  // ── Save prefs — called automatically on skin selection ────────────────────
  async function savePrefs(newPrefs?: UserPrefs) {
    if (!userId) return
    const toSave = newPrefs ?? prefs
    setSaving(true)
    setError(null)
    setSuccess(false)

    const { error: upsertErr } = await supabase
      .from('user_book_skin_preferences')
      .upsert({
        user_id: userId,
        cover_skin_id: toSave.cover_skin_id,
        page_skin_id: toSave.page_skin_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    setSaving(false)
    if (upsertErr) {
      setError('Failed to save: ' + upsertErr.message)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 1500)
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
        <AdminUploadBanner onSaved={() => loadSkins(userId!, isAdmin)} />

        {/* Error / success */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">
            ✅ Saved!
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
              onSelect={(id) => {
                const newPrefs = { ...prefs, cover_skin_id: id }
                setPrefs(newPrefs)
                savePrefs(newPrefs)
              }}
              previewAspect={400 / 620}
              skinType="cover"
              isAdmin={isAdmin}
              onManage={(skin) => { setActionSkin(skin); setActionError(null); setShowSellInput(false); setSellPrice('') }}
            />

            {/* ── Page skin picker ── */}
            <SkinPicker
              title="📄 Inner Page"
              description="The background of the open book pages."
              skins={pageSkins}
              selectedId={effectivePage}
              onSelect={(id) => {
                const newPrefs = { ...prefs, page_skin_id: id }
                setPrefs(newPrefs)
                savePrefs(newPrefs)
              }}
              previewAspect={400 / 620}
              skinType="page"
              isAdmin={isAdmin}
              onManage={(skin) => { setActionSkin(skin); setActionError(null); setShowSellInput(false); setSellPrice('') }}
            />

            {/* Auto-save indicator */}
            {saving && (
              <div className="fixed bottom-6 right-6 bg-amber-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">
                Saving…
              </div>
            )}

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

      {/* ── Admin Manage modal ─────────────────────────────────────────────── */}
      {actionSkin && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => !actionWorking && setActionSkin(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <div className="font-bold text-gray-900">⚙️ {actionSkin.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {actionSkin.skin_type === 'cover' ? '📖 Cover' : '📄 Page'} ·{' '}
                  {actionSkin.visibility === 'public' ? '👥 Public' : '🔒 Admin only'}
                  {actionSkin.is_default ? ' · ⭐ Default' : ''}
                  {!actionSkin.is_active ? ' · ❌ Inactive' : ''}
                  {actionSkin.shop_item_id ? ' · 🛍️ In shop' : ''}
                </div>
              </div>
              <button onClick={() => !actionWorking && setActionSkin(null)} className="text-gray-400 hover:text-gray-600 text-2xl font-light">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {actionError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{actionError}</div>}
              <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-100" style={{ width: '100%', aspectRatio: '400/620' }}>
                {actionSkin.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={actionSkin.image_url} alt={actionSkin.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">📖</div>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => adminSkinAction(actionSkin, 'set_default')} disabled={actionWorking || !!actionSkin.is_default}
                  className="py-2 px-3 rounded-xl text-sm font-semibold border-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition-colors">
                  {actionSkin.is_default ? '⭐ Is Default' : 'Set default'}
                </button>
                {actionSkin.visibility === 'public'
                  ? <button onClick={() => adminSkinAction(actionSkin, 'make_private')} disabled={actionWorking}
                      className="py-2 px-3 rounded-xl text-sm font-semibold border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">🔒 Make private</button>
                  : <button onClick={() => adminSkinAction(actionSkin, 'make_public')} disabled={actionWorking}
                      className="py-2 px-3 rounded-xl text-sm font-semibold border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">👥 Make public</button>}
                <button onClick={() => adminSkinAction(actionSkin, 'toggle_active')} disabled={actionWorking}
                  className="py-2 px-3 rounded-xl text-sm font-semibold border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  {actionSkin.is_active ? 'Deactivate' : 'Activate'}
                </button>
                {!actionSkin.shop_item_id
                  ? <button onClick={() => setShowSellInput(v => !v)} disabled={actionWorking}
                      className="py-2 px-3 rounded-xl text-sm font-semibold border-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition-colors">🛍️ Sell in shop</button>
                  : <button onClick={async () => {
                      if (!confirm('Remove from shop?')) return
                      setActionWorking(true)
                      await supabase.from('shop_items').update({ is_active: false }).eq('id', actionSkin.shop_item_id!)
                      await supabase.from('book_skins').update({ shop_item_id: null }).eq('id', actionSkin.id)
                      await loadSkins(userId!, isAdmin)
                      const { data: fresh } = await supabase.from('book_skins').select('*').eq('id', actionSkin.id).single()
                      if (fresh) setActionSkin(fresh as BookSkin)
                      setActionWorking(false)
                    }} disabled={actionWorking}
                      className="py-2 px-3 rounded-xl text-sm font-semibold border-2 border-gray-200 bg-white text-gray-500 disabled:opacity-40 transition-colors">🛍️ In shop ✓</button>}
                <button onClick={() => adminSkinAction(actionSkin, 'delete')} disabled={actionWorking}
                  className="py-2 px-3 rounded-xl text-sm font-semibold border-2 border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors col-span-2">🗑️ Delete</button>
              </div>
              {showSellInput && (
                <div className="flex gap-2">
                  <input type="number" min={1} value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                    placeholder="Price (points)" className="flex-1 px-3 py-2 border-2 border-amber-200 rounded-xl text-sm bg-white" />
                  <button onClick={() => adminSkinAction(actionSkin, 'sell')} disabled={actionWorking || !sellPrice}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-semibold rounded-xl text-sm">
                    {actionWorking ? '⏳' : 'List'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
  isAdmin,
  onManage,
}: {
  title: string
  description: string
  skins: BookSkin[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  previewAspect: number
  skinType: 'cover' | 'page'
  isAdmin?: boolean
  onManage?: (skin: BookSkin) => void
}) {
  const defaultSkin = skins.find(s => s.is_default) ?? null

  return (
    <Card>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </Card.Header>
      <Card.Body>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <SkinOption
            label="Default"
            sublabel={defaultSkin ? defaultSkin.name : 'Built-in parchment'}
            imageUrl={defaultSkin?.image_url ?? null}
            isSelected={selectedId === null}
            onClick={() => onSelect(null)}
            aspect={previewAspect}
            badge={selectedId !== null ? '⭐' : undefined}
            skinType={skinType}
          />
          {skins.filter(s => !s.is_default).map(skin => (
            <div key={skin.id} className="relative">
              <SkinOption
                label={skin.name}
                sublabel={skin.description ?? undefined}
                imageUrl={skin.image_url}
                isSelected={selectedId === skin.id}
                onClick={() => !(skin.is_active === false) && onSelect(skin.id)}
                aspect={previewAspect}
                skinType={skinType}
                isInactive={skin.is_active === false}
                isPrivate={skin.visibility === 'admin_only' && isAdmin}
              />
              {isAdmin && onManage && (
                <button
                  onClick={e => { e.stopPropagation(); onManage(skin) }}
                  className="absolute top-1 right-1 z-10 text-xs bg-amber-500/90 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded-md font-semibold shadow"
                  title="Manage this skin"
                >⚙️</button>
              )}
            </div>
          ))}
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
  isInactive,
  isPrivate,
}: {
  label: string
  sublabel?: string
  imageUrl: string | null
  isSelected: boolean
  onClick: () => void
  aspect: number
  badge?: string
  skinType: 'cover' | 'page'
  isInactive?: boolean
  isPrivate?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 overflow-hidden flex flex-col text-left transition-all focus:outline-none w-full ${
        isInactive ? 'opacity-50 cursor-not-allowed' :
        isSelected ? 'border-amber-500 shadow-lg shadow-amber-100' : 'border-gray-200 hover:border-amber-300'
      }`}
    >
      <div className="relative w-full overflow-hidden bg-gray-100" style={{ paddingBottom: `${(1 / aspect) * 100}%` }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{
            background: skinType === 'page'
              ? 'linear-gradient(to bottom, #faf6ee 0%, #f2e8d5 50%, #ede0c4 100%)'
              : 'linear-gradient(160deg, #c8b08a 0%, #b09060 35%, #9a7a48 70%, #7a5e30 100%)',
          }} />
        )}
        {isSelected && (
          <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow">✓</div>
        )}
        {badge && !isSelected && (
          <div className="absolute top-1.5 left-1.5 text-sm leading-none">{badge}</div>
        )}
        {isInactive && <div className="absolute inset-0 bg-gray-900/30 flex items-center justify-center"><span className="text-white text-xs font-bold bg-gray-800/60 px-1.5 py-0.5 rounded">Inactive</span></div>}
        {isPrivate && !isInactive && <div className="absolute bottom-1 left-1 text-xs bg-gray-800/60 text-white px-1.5 py-0.5 rounded">🔒</div>}
      </div>
      <div className={`px-2 py-2 text-xs font-semibold truncate ${isSelected ? 'text-amber-700 bg-amber-50' : 'text-gray-700 bg-white'}`}>
        <div className="flex items-center justify-between gap-1">
          <span className="truncate">{label}</span>
          {isSelected && <span className="shrink-0 text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">✓ Active</span>}
        </div>
        {sublabel && <span className="block font-normal text-gray-400 truncate">{sublabel}</span>}
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

function AdminUploadBanner({ onSaved }: { onSaved?: () => void }) {
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

  // ── AI generation tab state ────────────────────────────────────────────────
  const [adminTab, setAdminTab] = useState<'upload' | 'generate'>('upload')
  // sandbox = { imageUrl, prompt, iteration }
  const [genPrompt, setGenPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [sandbox, setSandbox] = useState<{ imageUrl: string; prompt: string; iteration: number } | null>(null)
  const [refinePrompt, setRefinePrompt] = useState('')
  const [genSaveOpen, setGenSaveOpen] = useState(false)
  const [genSaveName, setGenSaveName] = useState('')
  const [genSaveDesc, setGenSaveDesc] = useState('')
  const [genSaveVisibility, setGenSaveVisibility] = useState<'admin_only' | 'public'>('admin_only')
  const [genSaving, setGenSaving] = useState(false)
  const [genSaveError, setGenSaveError] = useState<string | null>(null)
  const [genCoverLayout, setGenCoverLayout] = useState<CoverLayout>(DEFAULT_LAYOUT)
  const [showGenLayoutEditor, setShowGenLayoutEditor] = useState(false)

  async function handleGenerate() {
    if (!genPrompt.trim()) { setGenError('Enter a description.'); return }
    setGenError(null); setGenerating(true)
    try {
      const res = await fetch('/api/preview-book-skin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: genPrompt.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setSandbox({ imageUrl: data.image_url, prompt: data.prompt, iteration: 1 })
      setRefinePrompt('')
    } catch (err: any) { setGenError(err.message) }
    finally { setGenerating(false) }
  }

  async function handleRefine() {
    if (!sandbox || !refinePrompt.trim()) return
    setGenError(null); setGenerating(true)
    try {
      const res = await fetch('/api/preview-book-skin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: sandbox.prompt, sourceImageUrl: sandbox.imageUrl, changePrompt: refinePrompt.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setSandbox({ imageUrl: data.image_url, prompt: data.prompt, iteration: sandbox.iteration + 1 })
      setRefinePrompt('')
    } catch (err: any) { setGenError(err.message) }
    finally { setGenerating(false) }
  }

  async function handleGenSave() {
    if (!sandbox || !genSaveName.trim()) { setGenSaveError('Enter a name.'); return }
    setGenSaveError(null); setGenSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      // Fetch the preview image and re-upload to book-skins bucket under permanent path
      const imgRes = await fetch(sandbox.imageUrl)
      const imgBlob = await imgRes.blob()
      const fileName = `cover/${user.id}/${Date.now()}.png`
      const { error: uploadErr } = await supabase.storage.from('book-skins').upload(fileName, imgBlob, { contentType: 'image/png', upsert: false })
      if (uploadErr) throw new Error('Upload failed: ' + uploadErr.message)
      const { data: { publicUrl } } = supabase.storage.from('book-skins').getPublicUrl(fileName)
      const { error: insertErr } = await supabase.from('book_skins').insert({
        name: genSaveName.trim(), description: genSaveDesc.trim() || null,
        skin_type: 'cover', image_url: publicUrl,
        width: COVER_W, height: COVER_H,
        created_by: user.id, visibility: genSaveVisibility,
        cover_layout: genCoverLayout,
      })
      if (insertErr) throw new Error(insertErr.message)
      setGenSaveOpen(false); setGenSaveName(''); setGenSaveDesc('')
      setSandbox(null); setGenPrompt(''); setRefinePrompt('')
      setGenCoverLayout(DEFAULT_LAYOUT); setShowGenLayoutEditor(false)
      setUploadSuccess('✅ Book cover saved!')
      onSaved?.()
    } catch (err: any) { setGenSaveError(err.message) }
    finally { setGenSaving(false) }
  }

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
      onSaved?.()
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
              <div className="font-bold text-amber-800 text-sm">Admin: New Book Skin</div>
              <div className="text-xs text-amber-600">Upload image or Generate with AI</div>
            </div>
          </div>
          <span className="text-amber-600 font-bold text-lg">{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            {/* Tab switcher */}
            <div className="flex gap-2">
              <button onClick={() => setAdminTab('upload')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border-2 transition-colors ${adminTab === 'upload' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'}`}>
                ⬆️ Upload Image
              </button>
              <button onClick={() => setAdminTab('generate')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border-2 transition-colors ${adminTab === 'generate' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'}`}>
                ✨ Generate with AI
              </button>
            </div>

            {/* Shared banners */}
            {uploadError && adminTab === 'upload' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
                <span>{uploadError}</span>
                <button onClick={() => setUploadError(null)} className="font-bold ml-3">✕</button>
              </div>
            )}
            {genError && adminTab === 'generate' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
                <span>{genError}</span>
                <button onClick={() => setGenError(null)} className="font-bold ml-3">✕</button>
              </div>
            )}
            {uploadSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex justify-between">
                <span>{uploadSuccess}</span>
                <button onClick={() => setUploadSuccess(null)} className="font-bold ml-3">✕</button>
              </div>
            )}

            {/* ── Upload tab ─────────────────────────────────────────────────── */}
            {adminTab === 'upload' && (
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
            )} {/* end adminTab === 'upload' */}

            {/* ── Generate with AI tab ────────────────────────────────────── */}
            {adminTab === 'generate' && (
              <div className="space-y-4">
                <p className="text-xs text-amber-700">
                  💡 AI generates a front-facing book cover (no angle, transparent background) with 3D sculptural corner ornaments, ornate border, and clear center space for the title and button.
                </p>

                {!sandbox ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-amber-800 mb-1">Describe the cover theme *</label>
                      <textarea value={genPrompt} onChange={e => setGenPrompt(e.target.value)}
                        placeholder="e.g. space exploration with planets, rockets and stars; deep navy background with gold accents"
                        rows={3} className="w-full px-3 py-2 border-2 border-amber-200 rounded-xl text-sm focus:border-amber-400 bg-white resize-none" />
                    </div>
                    {/* Quick examples + randomize */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-amber-600 font-medium">Examples:</span>
                        <button
                          onClick={() => {
                            const themes = [
                              'space exploration — globe, rocket, telescope as gold 3D ornaments',
                              'enchanted forest — crystal mushrooms, owl, compass as bronze ornaments',
                              'deep ocean — coral, anchor, submarine periscope as silver ornaments',
                              'ancient Egypt — scarab, pyramid, ankh as gilded 3D ornaments',
                              'steampunk — clockwork gears, goggles, airship as brass ornaments',
                              'cherry blossom — lantern, koi fish, fan as jade and gold ornaments',
                              'arctic — polar bear, snowflake, aurora borealis as crystal ornaments',
                              'pirate — compass, treasure chest, ship wheel as aged bronze ornaments',
                              'medieval knight — sword, shield, castle as silver relief ornaments',
                              'wizard — crystal ball, potions, wand as gem-encrusted ornaments',
                              'underwater — starfish, seahorse, shell as pearl and gold ornaments',
                              'volcano — dragon, lava gem, obsidian crystal as molten gold ornaments',
                            ]
                            const covers = [
                              'deep navy blue leather cover',
                              'dark emerald green cloth cover',
                              'burgundy leather with gold tooling',
                              'midnight black cover with silver edge',
                              'deep purple velvet-look cover',
                              'dark brown worn leather cover',
                            ]
                            const borders = [
                              'thin ornate gold filigree border',
                              'gilded geometric corner frame',
                              'engraved gold vine border',
                              'raised gold relief border pattern',
                            ]
                            const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
                            setGenPrompt(`A physical hardcover book, ${pick(covers)}, ${pick(borders)}, with ${pick(themes)} in the four corners`)
                          }}
                          className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors border border-amber-600"
                        >
                          🎲 Randomize
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'Deep navy leather book, gold border, space exploration — globe, rocket, telescope as gold 3D corner ornaments',
                          'Dark emerald cloth book, engraved border, enchanted forest — owl, mushroom, crystal as bronze corner ornaments',
                          'Burgundy leather book, gilded frame, ancient Egypt — scarab, ankh, pyramid as gold corner ornaments',
                          'Midnight black book, silver frame, steampunk — gears, airship, compass as brass 3D corner pieces',
                          'Deep purple book, ornate gold border, wizard — crystal ball, wand, potion as gem-encrusted corners',
                          'Dark brown leather, gold vines border, pirate adventure — compass, chest, wheel as aged bronze corners',
                        ].map(ex => (
                          <button key={ex} onClick={() => setGenPrompt(ex)}
                            className="text-[11px] px-2.5 py-1 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium transition-colors text-left leading-snug border border-amber-200">
                            {ex.length > 52 ? ex.slice(0, 52) + '…' : ex}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={handleGenerate} disabled={generating || !genPrompt.trim()}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-semibold rounded-xl text-sm transition-colors">
                      {generating ? '⏳ Generating… (~15s)' : '✨ Generate Cover'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-700">Iteration #{sandbox.iteration}</span>
                      <button onClick={() => { setSandbox(null); setGenPrompt(''); setRefinePrompt('') }}
                        className="text-xs text-gray-400 hover:text-gray-600">✕ Start over</button>
                    </div>

                    {/* Preview */}
                    <div className="flex justify-center">
                      <div className="rounded-xl overflow-hidden border-2 border-amber-200 shadow-lg" style={{ width: 160, height: 248 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sandbox.imageUrl} alt="Generated cover" className="w-full h-full object-cover" />
                      </div>
                    </div>

                    {/* Layout editor toggle */}
                    <button
                      type="button"
                      onClick={() => setShowGenLayoutEditor(v => !v)}
                      className="w-full py-2 px-3 text-xs font-semibold rounded-xl border-2 border-dashed border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                    >
                      🎨 {showGenLayoutEditor ? 'Hide' : 'Customise'} Title &amp; Prompt Layout
                    </button>

                    {/* Layout editor */}
                    {showGenLayoutEditor && (
                      <CoverLayoutEditor
                        imageUrl={sandbox.imageUrl}
                        layout={genCoverLayout}
                        onChange={setGenCoverLayout}
                      />
                    )}

                    {/* Refine */}
                    <div>
                      <label className="block text-xs font-semibold text-amber-800 mb-1">What to change?</label>
                      <div className="flex gap-2">
                        <input type="text" value={refinePrompt} onChange={e => setRefinePrompt(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && !generating && refinePrompt.trim() && handleRefine()}
                          placeholder="e.g. make the background darker, add more stars"
                          className="flex-1 px-3 py-2 border-2 border-amber-200 rounded-xl text-sm focus:border-amber-400 bg-white" />
                        <button onClick={handleRefine} disabled={generating || !refinePrompt.trim()}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-semibold rounded-xl text-sm whitespace-nowrap">
                          {generating ? '⏳' : '✨ Refine'}
                        </button>
                      </div>
                    </div>

                    {/* Save */}
                    {!genSaveOpen ? (
                      <button onClick={() => { setGenSaveName(''); setGenSaveDesc(''); setGenSaveError(null); setGenSaveOpen(true) }}
                        className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm">
                        💾 Save to Collection
                      </button>
                    ) : (
                      <div className="space-y-3 border border-amber-200 rounded-xl p-3 bg-white">
                        {genSaveError && <p className="text-xs text-red-600">{genSaveError}</p>}
                        <div>
                          <label className="block text-xs font-semibold text-amber-800 mb-1">Name *</label>
                          <input type="text" value={genSaveName} onChange={e => setGenSaveName(e.target.value)}
                            placeholder='e.g. "Space Explorer"'
                            className="w-full px-3 py-2 border-2 border-amber-200 rounded-xl text-sm bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-amber-800 mb-1">Description</label>
                          <input type="text" value={genSaveDesc} onChange={e => setGenSaveDesc(e.target.value)}
                            placeholder="Optional"
                            className="w-full px-3 py-2 border-2 border-amber-200 rounded-xl text-sm bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-amber-800 mb-1">Visibility</label>
                          <div className="flex gap-2">
                            {(['admin_only', 'public'] as const).map(v => (
                              <button key={v} onClick={() => setGenSaveVisibility(v)}
                                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold border-2 transition-colors ${genSaveVisibility === v ? (v === 'public' ? 'bg-green-600 text-white border-green-600' : 'bg-gray-700 text-white border-gray-700') : 'bg-white text-gray-600 border-gray-200'}`}>
                                {v === 'public' ? '👥 Public' : '🔒 Admin only'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setGenSaveOpen(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm">Cancel</button>
                          <button onClick={handleGenSave} disabled={genSaving || !genSaveName.trim()}
                            className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold rounded-xl text-sm">
                            {genSaving ? '⏳ Saving…' : '💾 Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )} {/* end adminTab === 'generate' */}

          </div>
        )}
      </Card.Body>
    </Card>
  )
}
