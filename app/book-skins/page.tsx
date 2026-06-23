'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HomeButton } from '@/components/ui/HomeButton'
import { CoverLayoutEditor, DEFAULT_LAYOUT, type CoverLayout } from '@/components/CoverLayoutEditor'
import { BookCoverLivePreview } from '@/components/BookCoverLivePreview'

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

  // Admin: layout editor for existing skins
  const [layoutEditorSkin, setLayoutEditorSkin] = useState<BookSkin | null>(null)
  const [editingLayout, setEditingLayout] = useState<CoverLayout>(DEFAULT_LAYOUT)
  const [layoutSaving, setLayoutSaving] = useState(false)

  // Admin: overlay animation editor for skins with extracted objects
  const [overlayEditorSkin, setOverlayEditorSkin] = useState<BookSkin | null>(null)
  const [overlayEditorObjects, setOverlayEditorObjects] = useState<any[]>([])
  const [overlayEditorLoading, setOverlayEditorLoading] = useState(false)
  const [overlayEditorSaving, setOverlayEditorSaving] = useState(false)

  async function openOverlayEditor(skin: BookSkin) {
    setOverlayEditorSkin(skin)
    setOverlayEditorObjects([])  // clear stale data immediately before loading
    setOverlayEditorLoading(true)
    const { data, error } = await supabase
      .from('book_skin_overlays')
      .select('*')
      .eq('skin_id', skin.id)
      .order('sort_order', { ascending: true })
    if (error) {
      console.error('[openOverlayEditor] query error:', error.message, error.details)
    }
    console.log('[openOverlayEditor] skin_id:', skin.id, '| rows returned:', data?.length ?? 0, '| error:', error?.message)
    setOverlayEditorObjects(data ?? [])
    setOverlayEditorLoading(false)
  }

  async function saveOverlayConfig(overlay: any, config: any) {
    setOverlayEditorSaving(true)
    await supabase.from('book_skin_overlays').update({ overlay_config: config }).eq('id', overlay.id)
    setOverlayEditorObjects(prev => prev.map((o: any) => o.id === overlay.id ? { ...o, overlay_config: config } : o))
    setOverlayEditorSaving(false)
  }

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

      // Fetch purchased skins two ways:
      // 1. Via book_skin_id on the redemption (set by the backfill in the API route)
      // 2. Via item_id on the redemption matching shop_item_id on book_skins (always reliable)
      const { data: purchasedByBookSkinId } = await supabase
        .from('redemptions')
        .select('book_skin_id, book_skins:book_skin_id(id, name, description, skin_type, image_url, is_default, is_active, visibility, shop_item_id)')
        .eq('user_id', uid)
        .is('refunded_at', null)
        .not('book_skin_id', 'is', null)

      // Also find skins owned via item_id → shop_item_id link (handles all past purchases where book_skin_id was never set)
      const { data: redemptionsByItemId } = await supabase
        .from('redemptions')
        .select('item_id')
        .eq('user_id', uid)
        .is('refunded_at', null)

      const redeemedItemIds = (redemptionsByItemId ?? []).map((r: any) => r.item_id)
      let purchasedByItemId: any[] = []
      if (redeemedItemIds.length > 0) {
        const { data: skinsByShopItem } = await supabase
          .from('book_skins')
          .select('id, name, description, skin_type, image_url, is_default, is_active, visibility, shop_item_id')
          .in('shop_item_id', redeemedItemIds)
          // No is_active filter — show deactivated owned skins as greyed-out
        purchasedByItemId = skinsByShopItem ?? []
      }

      const publicIds = new Set((skins ?? []).map((s: any) => s.id))
      const purchasedRows1 = (purchasedByBookSkinId ?? [])
        .map((r: any) => r.book_skins)
        .filter((s: any) => s && !publicIds.has(s.id))
      const alreadyIncluded = new Set([...Array.from(publicIds), ...purchasedRows1.map((s: any) => s.id)])
      const purchasedRows2 = purchasedByItemId.filter((s: any) => !alreadyIncluded.has(s.id))
      setAllSkins([...(skins ?? []), ...purchasedRows1, ...purchasedRows2] as BookSkin[])
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
        await supabase.from('book_skins').update({ shop_item_id: newItem.id, visibility: 'admin_only' }).eq('id', skin.id)
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

      {/* ── Layout editor modal ─────────────────────────────────────────── */}
      {layoutEditorSkin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !layoutSaving && setLayoutEditorSkin(null)}>
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <div className="font-bold text-gray-900">🎨 Edit Layout — {layoutEditorSkin.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">Drag the title and button to reposition. Adjust font size and color.</div>
              </div>
              <button onClick={() => !layoutSaving && setLayoutEditorSkin(null)} className="text-gray-400 hover:text-gray-600 text-2xl font-light">×</button>
            </div>
            <div className="px-5 py-4">
              <CoverLayoutEditor
                imageUrl={layoutEditorSkin.image_url}
                layout={editingLayout}
                onChange={setEditingLayout}
              />
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setLayoutEditorSkin(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm">
                Cancel
              </button>
              <button
                disabled={layoutSaving}
                onClick={async () => {
                  setLayoutSaving(true)
                  try {
                    await supabase.from('book_skins').update({ cover_layout: editingLayout }).eq('id', layoutEditorSkin.id)
                    await loadSkins(userId!, isAdmin)
                    setLayoutEditorSkin(null)
                  } catch (_) {}
                  setLayoutSaving(false)
                }}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-bold rounded-xl text-sm"
              >
                {layoutSaving ? '⏳ Saving…' : '💾 Save Layout'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  ? <img src={actionSkin.image_url} alt={actionSkin.name} className="w-full h-full object-contain p-2 bg-gray-50" />
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
              {/* Layout editor — cover skins only */}
              {actionSkin.skin_type === 'cover' && (
                <button
                  onClick={() => {
                    const existing = (actionSkin as any).cover_layout
                    setEditingLayout(existing ?? DEFAULT_LAYOUT)
                    setLayoutEditorSkin(actionSkin)
                    setActionSkin(null)
                  }}
                  className="w-full py-2 px-3 text-sm font-semibold rounded-xl border-2 border-dashed border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                >
                  🎨 Edit Title &amp; Button Layout
                </button>
              )}
              {/* Overlay animation editor — cover skins (always show for covers; editor handles empty state) */}
              {actionSkin.skin_type === 'cover' && (
                <button
                  onClick={() => { openOverlayEditor(actionSkin); setActionSkin(null) }}
                  className="w-full py-2 px-3 text-sm font-semibold rounded-xl border-2 border-dashed border-purple-400 text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
                >
                  ✨ Animate Overlay Objects{!(actionSkin as any).has_overlays ? ' (none yet)' : ''}
                </button>
              )}
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

      {/* ── Overlay Animation Editor Modal ── */}
      {overlayEditorSkin && (
        <OverlayEditorInline
          key={overlayEditorSkin.id}
          skin={overlayEditorSkin}
          overlays={overlayEditorObjects}
          loading={overlayEditorLoading}
          saving={overlayEditorSaving}
          onSave={saveOverlayConfig}
          onClose={() => setOverlayEditorSkin(null)}
        />
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
            skinId={defaultSkin?.id}
            coverLayout={(defaultSkin as any)?.cover_layout}
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
                skinId={skin.id}
                coverLayout={(skin as any).cover_layout}
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
// ZoomPreviewCover — used in the SkinOption zoom modal.
// Image renders in normal flow (so it sets container height), overlay objects
// and title are absolute on top. Same layout as MagicBookReveal.
// ─────────────────────────────────────────────────────────────────────────────
const ZP_KEYFRAMES = buildKeyframesCSS('zp') + `
@keyframes zp-pulse-glow { 0%,100%{opacity:1} 50%{opacity:0.7} }
@keyframes zp-wiggle      { 0%,100%{transform:rotate(-8deg)} 50%{transform:rotate(8deg)} }
`

function ZoomPreviewCover({ skinId, coverImageUrl, coverLayout, label }: {
  skinId: string; coverImageUrl: string; coverLayout?: any; label: string
}) {
  const [overlays, setOverlays] = React.useState<any[]>([])

  React.useEffect(() => {
    const supabase = createClient()
    supabase.from('book_skin_overlays').select('*').eq('skin_id', skinId)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        console.log('[ZoomPreviewCover] overlays for', skinId, ':', data?.length, error?.message)
        setOverlays(data ?? [])
      })
  }, [skinId])

  const titleLayout = coverLayout?.title
  const promptLayout = coverLayout?.prompt

  return (
    <>
      <style>{ZP_KEYFRAMES}</style>
      <div style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverImageUrl} alt={label} style={{ display: 'block', width: '100%', height: 'auto' }} draggable={false} />
        {/* Overlay objects */}
        {overlays.map(obj => {
          const cfg = obj.overlay_config
          if (!cfg) return null
          const sz = overlayWidthPct(cfg.scale ?? 1.0)
          const anim = cfg.animation && cfg.animation !== 'none' ? buildAnimCSS(cfg.animation, 'zp', cfg.speed ?? 1.0) : undefined
          const transformOrigin = getTransformOrigin(cfg.animation)
          if (cfg.animation === 'burst' && cfg.burst?.polygon?.length >= 3) {
            return (
              <OverlayBurstRenderer key={obj.id} imageUrl={obj.image_url}
                containerWidthPx={420} scale={cfg.scale ?? 1.0}
                speed={cfg.speed ?? 1.0} burst={cfg.burst}
                style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, transform: 'translate(-50%,-50%)' }} />
            )
          }
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <div key={obj.id} style={{
              position: 'absolute', left: `${cfg.x}%`, top: `${cfg.y}%`,
              width: sz, height: sz, transform: 'translate(-50%,-50%)', pointerEvents: 'none',
            }}>
              {(cfg.auraStrength ?? 0) > 0 && (
                <OverlayAuraWrapper
                  overlayImageUrl={obj.image_url}
                  coverImageUrl={coverImageUrl}
                  xPct={cfg.x} yPct={cfg.y} widthPct={sz}
                  auraStrength={cfg.auraStrength}
                  auraDistance={cfg.auraDistance ?? 20}
                  containerWidthPx={420}
                  style={{ position: 'absolute', inset: 0, transform: 'none', left: 0, top: 0, width: '100%', height: '100%' }}
                ><span /></OverlayAuraWrapper>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={obj.image_url} alt={obj.label} draggable={false}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', animation: anim, transformOrigin }} />
            </div>
          )
        })}
        {/* Title */}
        <div className="absolute text-center px-4 w-full" style={{ left: `${titleLayout?.x ?? 50}%`, top: `${titleLayout?.y ?? 22}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
          <h2 className="font-bold leading-snug" style={{ fontSize: titleLayout?.fontSize ?? 20, color: titleLayout?.color ?? '#2d1a00', fontFamily: '"Georgia","Times New Roman",serif', textShadow: (titleLayout?.shadow ?? true) ? '0 1px 8px rgba(255,255,255,0.6),0 0 16px rgba(0,0,0,0.4)' : undefined, letterSpacing: '0.04em' }}>
            Challenge Title Preview
          </h2>
        </div>
        {/* Open the Book prompt */}
        <div className="absolute flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap"
          style={{ left: `${promptLayout?.x ?? 50}%`, top: `${promptLayout?.y ?? 82}%`, transform: 'translate(-50%,-50%)',
            fontSize: promptLayout?.fontSize ?? 14, color: promptLayout?.color ?? 'rgba(240,215,140,0.97)',
            textShadow: '0 1px 4px rgba(0,0,0,0.8)', background: 'rgba(40,25,5,0.72)', border: '1px solid rgba(200,160,60,0.55)',
            backdropFilter: 'blur(6px)', animation: 'zp-pulse-glow 2.5s ease-in-out infinite', pointerEvents: 'none' }}>
          <span style={{ animation: 'zp-wiggle 2s ease-in-out infinite', display: 'inline-block' }}>📜</span>
          <span style={{ letterSpacing: '0.06em' }}>Open the Book</span>
        </div>
      </div>
    </>
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
  skinId,
  coverLayout,
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
  skinId?: string
  coverLayout?: any
}) {
  const [zoomOpen, setZoomOpen] = React.useState(false)

  return (
    <>
      <button
        onClick={onClick}
        className={`rounded-xl border-2 overflow-hidden flex flex-col text-left transition-all focus:outline-none w-full ${
          isInactive ? 'opacity-50 cursor-not-allowed' :
          isSelected ? 'border-amber-500 shadow-lg shadow-amber-100' : 'border-gray-200 hover:border-amber-300'
        }`}
      >
        <div className="relative w-full overflow-hidden bg-gray-50" style={{ paddingBottom: `${(1 / aspect) * 100}%` }}>
          {imageUrl ? (
            // Plain static image for the card thumbnail — no layout issues
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={label} className="absolute inset-0 w-full h-full object-contain p-1" />
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
          {/* Zoom icon for cover skins */}
          {skinType === 'cover' && imageUrl && (
            <button
              onClick={e => { e.stopPropagation(); setZoomOpen(true) }}
              className="absolute bottom-1 right-1 z-10 bg-black/50 hover:bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md backdrop-blur-sm transition-colors"
            >
              🔍
            </button>
          )}
          {isInactive && <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center"><span className="text-white text-xs font-bold bg-gray-800/70 px-2 py-1 rounded-lg">⚠️ Unavailable</span></div>}
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

      {/* Full-screen zoom preview with title + animations */}
      {zoomOpen && imageUrl && skinId && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setZoomOpen(false)}
        >
          <div className="relative flex flex-col items-center gap-3" style={{ maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            {/* Cover wrapper — image in normal flow sets height, overlays absolute on top */}
            <ZoomPreviewCover
              skinId={skinId}
              coverImageUrl={imageUrl}
              coverLayout={coverLayout}
              label={label}
            />
            <div className="flex items-center justify-between w-full px-1">
              <span className="text-white text-sm font-semibold drop-shadow">{label}</span>
              <button
                onClick={() => setZoomOpen(false)}
                className="text-white/70 hover:text-white text-sm px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminUploadBanner — shown only to admins/teachers; lets them upload new skins
// with visibility control and sell-in-shop option, inline on this page.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Art style presets — applied to both cover and object generation
// ─────────────────────────────────────────────────────────────────────────────
const ART_STYLES: {
  id: string
  label: string
  emoji: string
  // Appended to the cover prompt
  coverSuffix: string
  // Included in the enrich-cluster-items system prompt as a style rule
  objectStyle: string
}[] = [
  {
    id: 'realistic',
    label: 'Realistic',
    emoji: '📸',
    coverSuffix: 'rendered in a photorealistic style — rich textures, accurate materials, lifelike lighting as if photographed',
    objectStyle: 'photorealistic — accurate materials, lifelike lighting, physical depth, as if photographed in a studio',
  },
  {
    id: 'ghibli',
    label: 'Ghibli',
    emoji: '🌿',
    coverSuffix: 'in the style of Studio Ghibli — soft watercolour washes, hand-painted detail, warm nostalgic palette, painterly brushwork, gentle rounded forms',
    objectStyle: 'Studio Ghibli illustration style — soft watercolour texture, hand-painted feel, warm nostalgic colours, rounded friendly forms, painterly brushwork',
  },
  {
    id: 'futuristic',
    label: 'Futuristic',
    emoji: '🚀',
    coverSuffix: 'in a sleek futuristic sci-fi style — glowing neon accents, holographic surfaces, carbon fibre and chrome materials, crisp hard-edge design',
    objectStyle: 'futuristic sci-fi style — glowing neon edges, holographic sheen, chrome and carbon materials, crisp angular forms, cyberpunk atmosphere',
  },
  {
    id: 'minimalist',
    label: 'Minimalist',
    emoji: '◻️',
    coverSuffix: 'in a clean minimalist style — flat bold shapes, limited colour palette of 2-3 colours, strong negative space, geometric precision, no fine detail',
    objectStyle: 'minimalist flat design — bold simplified silhouette, 2-3 colour palette, geometric clean shapes, strong negative space, no fine ornament',
  },
  {
    id: 'vintage',
    label: 'Vintage',
    emoji: '🕰️',
    coverSuffix: 'in a vintage illustration style — aged paper texture, muted sepia and ochre tones, classic engraving hatching detail, antique lithograph feel',
    objectStyle: 'vintage engraving illustration style — aged paper tone, sepia and ochre palette, classic cross-hatching linework, antique woodcut feel',
  },
  {
    id: 'watercolour',
    label: 'Watercolour',
    emoji: '🎨',
    coverSuffix: 'in a loose expressive watercolour style — translucent overlapping washes, soft bleeding edges, visible brushstrokes, delicate wet-on-wet blending',
    objectStyle: 'loose watercolour illustration — translucent colour washes, soft bleeding edges, visible brushstroke texture, delicate wet-on-wet blending',
  },
]

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
  const [artStyle, setArtStyle] = useState<string>('')  // empty = no style override
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [sandbox, setSandbox] = useState<{
    imageUrl: string       // current cover image (may be stripped if extraction was done)
    originalUrl?: string   // the pre-extraction cover (for reference)
    prompt: string
    iteration: number
    extractedObjects?: { label: string; imageUrl: string; b64raw?: string }[]  // transparent PNG per object
  } | null>(null)
  const [refinePrompt, setRefinePrompt] = useState('')
  const [genSaveOpen, setGenSaveOpen] = useState(false)
  const [genSaveName, setGenSaveName] = useState('')
  const [genSaveDesc, setGenSaveDesc] = useState('')
  const [genSaveVisibility, setGenSaveVisibility] = useState<'admin_only' | 'public'>('admin_only')
  const [genSaving, setGenSaving] = useState(false)
  const [genSaveError, setGenSaveError] = useState<string | null>(null)
  const [genCoverLayout, setGenCoverLayout] = useState<CoverLayout>(DEFAULT_LAYOUT)
  const [showGenLayoutEditor, setShowGenLayoutEditor] = useState(false)
  const [cleanCorners, setCleanCorners] = useState(false)

  // ── Overlay extraction state ───────────────────────────────────────────────
  const [extractEnabled, setExtractEnabled] = useState(false)
  const [identifying, setIdentifying] = useState(false)
  const [identifiedObjects, setIdentifiedObjects] = useState<string[] | null>(null)
  const [selectedExtractObjects, setSelectedExtractObjects] = useState<Set<string>>(new Set())
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  // Per-cluster progress: 0=pending, 1=generating, 2=done, 3=error
  const [clusterProgress, setClusterProgress] = useState<(0|1|2|3)[]>([0,0,0,0])
  const [clusterErrors, setClusterErrors] = useState<(string|null)[]>([null,null,null,null])
  // Which corner clusters to generate objects for (all on by default)
  const [enabledClusters, setEnabledClusters] = useState<boolean[]>([true, true, true, true])
  // Lightbox: zoom any cover or object image
  const [zoomedImage, setZoomedImage] = useState<{ src: string; label: string } | null>(null)

  async function handleExtractObjects() {
    if (!sandbox || !identifiedObjects || selectedExtractObjects.size === 0) return
    setExtracting(true)
    setExtractError(null)
    try {
      // Upload a temporary placeholder skin to get an ID for the extraction API
      // We use a special "preview" mode — the API returns results without saving to DB
      const res = await fetch('/api/extract-cover-objects-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverImageUrl: sandbox.imageUrl,
          coverPrompt: genPrompt,
          selectedObjects: Array.from(selectedExtractObjects),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      // Update sandbox: show stripped cover + extracted object thumbnails
      setSandbox(prev => prev ? {
        ...prev,
        imageUrl: data.stripped_url,
        originalUrl: prev.originalUrl ?? prev.imageUrl,
        extractedObjects: data.objects ?? [],
        iteration: prev.iteration + 1,
      } : prev)
    } catch (err: any) {
      setExtractError(err.message)
    } finally {
      setExtracting(false)
    }
  }

  async function handleGenerateWithObjects() {
    if (!genPrompt.trim()) { setGenError('Enter a description.'); return }
    setGenError(null); setGenerating(true); setCleanCorners(enabledClusters.every(Boolean))
    const cleanPrompt = genPrompt.trim().replace(/,?\s*corner clusters:\s*\[[\s\S]*$/i, '').trim()
    const fullPrompt = genPrompt.trim()

    // Build corner annotation for the cover prompt:
    // - overlay corners: keep clean (objects will be composited as animated PNGs)
    // - baked corners: describe the cluster objects to render onto the cover surface
    const CORNER_LABELS = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
    const clusterMatches = fullPrompt.match(/\[([^\]]+)\]/g) ?? []
    const cornerNotes = CORNER_LABELS.map((corner, i) => {
      const clusterDesc = clusterMatches[i]?.replace(/^\[|\]$/g, '').trim() ?? ''
      if (enabledClusters[i]) {
        // Overlay mode: keep corner clean — objects generated separately as animated PNGs
        return `${corner}: KEEP CLEAN AND EMPTY — plain cover surface only, no objects drawn here (animated overlay objects will be composited later)`
      } else {
        // Baked mode: render cluster objects directly onto the cover surface
        return `${corner}: render decorative objects baked into the cover surface (${clusterDesc})`
      }
    }).join('; ')
    const annotatedCleanPrompt = `${styledPrompt(cleanPrompt)}. Corner instructions: [${cornerNotes}]`
    // Context selection:
    // - ALL overlay → COVER_CONTEXT_CLEAN (all corners bare, no drawn decoration)
    // - ANY baked → COVER_CONTEXT_WITH_CORNERS (some corners have drawn objects)
    // The Corner instructions in the prompt handle the per-corner detail
    const hasOverlayCorners = enabledClusters.some(Boolean)
    const allOverlay = enabledClusters.every(Boolean)

    // All-baked: send the full original prompt (same as Generate Cover) for best results
    const coverPromptToSend = allOverlay ? annotatedCleanPrompt : styledPrompt(fullPrompt.replace(/,?\s*corner clusters:\s*\[[\s\S]*$/i, '').trim() + `. Corner instructions: [${cornerNotes}]`)

    try {
      // ── Step 1: Generate cover (~15s) ──────────────────────────────────
      const coverRes = await fetch('/api/preview-book-skin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: coverPromptToSend, cleanCorners: allOverlay }),
      })
      let coverData: any
      try { coverData = await coverRes.json() } catch {
        const rawText = await coverRes.text().catch(() => '')
        throw new Error(`Cover generation failed (${coverRes.status}): ${rawText.slice(0, 200) || 'non-JSON response'}`)
      }
      if (!coverRes.ok) throw new Error(coverData?.error || `Cover error ${coverRes.status}`)
      setSandbox({ imageUrl: coverData.image_url, prompt: coverData.prompt, iteration: 1 })
      setRefinePrompt('')
      setGenerating(false)

      // ── Step 2: Enrich all 12 items in one GPT-4o call (~4s) ───────────
      setExtracting(true)
      setExtractError(null)
      setClusterProgress([0, 0, 0, 0])
      setClusterErrors([null, null, null, null])

      const enrichRes = await fetch('/api/enrich-cluster-items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverPrompt: fullPrompt, artStyle, enabledClusters }),
      })
      let enrichData: any
      try { enrichData = await enrichRes.json() } catch {
        const rawText = await enrichRes.text().catch(() => '')
        setExtractError(`Enrichment failed (${enrichRes.status}): ${rawText.slice(0, 150) || 'non-JSON response — likely a timeout, please try again'}`)
        setSandbox(prev => prev ? { ...prev, extractedObjects: [] } : prev)
        setExtracting(false)
        return
      }
      if (!enrichRes.ok) {
        setExtractError(enrichData?.error ?? 'Enrichment failed')
        setSandbox(prev => prev ? { ...prev, extractedObjects: [] } : prev)
        setExtracting(false)
        return
      }

      const clusters: { clusterIndex: number; corner: string; items: { label: string; prompt: string }[] }[] =
        enrichData.clusters ?? []
      console.log('[generateWithObjects] enrichment returned', clusters.length, 'clusters:', clusters.map(c => `${c.corner}(${c.items.length})`))
      if (clusters.length === 0) {
        setExtractError('No clusters found in prompt — use format: corner clusters: [item1 + item2 + item3] [...]')
        setSandbox(prev => prev ? { ...prev, extractedObjects: [] } : prev)
        setExtracting(false)
        return
      }

      // ── Step 3: Generate one object at a time — each pops in immediately when done ──
      // Sequential to avoid gateway timeouts from concurrent long-running requests.
      for (const cluster of clusters) {
        setClusterProgress(prev => { const n = [...prev] as (0|1|2|3)[]; n[cluster.clusterIndex] = 1; return n })

        let clusterSuccesses = 0
        const errs: string[] = []

        for (let objIdx = 0; objIdx < cluster.items.length; objIdx++) {
          const item = cluster.items[objIdx]
          try {
            const res = await fetch('/api/generate-single-object', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                label: item.label,
                prompt: item.prompt,
                clusterIndex: cluster.clusterIndex,
                objectIndex: objIdx,
              }),
            })
            let data: any
            try { data = await res.json() } catch { data = {} }
            if (!res.ok) {
              errs.push(`${item.label}: ${data?.error ?? `HTTP ${res.status}`}`)
            } else {
              // Object ready — use data URI for instant display, keep b64raw for upload at save
              setSandbox(prev => prev ? {
                ...prev,
                extractedObjects: [...(prev.extractedObjects ?? []), {
                  label: data.label,
                  imageUrl: data.b64,   // data:image/png;base64,... — displays immediately, no upload wait
                  b64raw: data.b64raw,  // raw base64 stored for Supabase upload when user saves
                }],
              } : prev)
              clusterSuccesses++
            }
          } catch (err: any) {
            errs.push(`${item.label}: ${err.message ?? 'network error'}`)
          }
        }

        if (errs.length > 0) {
          setClusterErrors(prev => { const n = [...prev]; n[cluster.clusterIndex] = errs.join('; '); return n })
        }
        setClusterProgress(prev => {
          const n = [...prev] as (0|1|2|3)[]
          n[cluster.clusterIndex] = clusterSuccesses > 0 ? 2 : 3
          return n
        })
      }

      // Ensure extractedObjects is never undefined after we finish
      setSandbox(prev => prev && prev.extractedObjects === undefined ? { ...prev, extractedObjects: [] } : prev)
    } catch (err: any) {
      setGenError(err.message)
      setGenerating(false)
    } finally {
      setExtracting(false)
    }
  }

  // Build the final prompt sent to APIs — appends the selected art style descriptor
  function styledPrompt(base: string): string {
    const style = ART_STYLES.find(s => s.id === artStyle)
    if (!style) return base
    return `${base}, ${style.coverSuffix}`
  }

  async function handleGenerate() {
    if (!genPrompt.trim()) { setGenError('Enter a description.'); return }
    setGenError(null); setGenerating(true)
    try {
      // Build the same annotated prompt as all-baked in Generate + Objects
      // so both buttons produce consistent cover generation
      const fullPrompt = genPrompt.trim()
      const cleanBase = fullPrompt.replace(/,?\s*corner clusters:\s*\[[\s\S]*$/i, '').trim()
      const CORNER_LABELS = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
      const clusterMatches = fullPrompt.match(/\[([^\]]+)\]/g) ?? []
      const cornerNotes = CORNER_LABELS.map((corner, i) => {
        const clusterDesc = clusterMatches[i]?.replace(/^\[|\]$/g, '').trim() ?? ''
        return clusterDesc
          ? `${corner}: render decorative objects baked into the cover surface (${clusterDesc})`
          : `${corner}: apply thematic border decoration`
      }).join('; ')
      const promptToSend = styledPrompt(`${cleanBase}. Corner instructions: [${cornerNotes}]`)

      const res = await fetch('/api/preview-book-skin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptToSend, cleanCorners: false }),
      })
      let data: any
      try { data = await res.json() } catch {
        throw new Error(`Cover generation failed (${res.status}) — server returned a non-JSON response. Try again.`)
      }
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`)
      setSandbox({ imageUrl: data.image_url, prompt: data.prompt, iteration: 1 })
      setRefinePrompt('')
    } catch (err: any) { setGenError(err.message) }
    finally { setGenerating(false) }
  }

  async function handleIdentifyObjects() {
    if (!sandbox) return
    setIdentifying(true)
    setExtractError(null)
    try {
      const res = await fetch('/api/identify-cover-objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: sandbox.imageUrl, coverPrompt: genPrompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      const objs: string[] = data.objects ?? []
      setIdentifiedObjects(objs)
      // Pre-select all by default
      setSelectedExtractObjects(new Set(objs))
    } catch (err: any) {
      setExtractError(err.message)
    } finally {
      setIdentifying(false)
    }
  }

  async function handleRefine() {
    if (!sandbox || !refinePrompt.trim()) return
    setGenError(null); setGenerating(true)
    try {
      const res = await fetch('/api/preview-book-skin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: sandbox.prompt, sourceImageUrl: sandbox.imageUrl, changePrompt: refinePrompt.trim() }),
      })
      let data: any
      try { data = await res.json() } catch {
        throw new Error(`Refine failed (${res.status}) — server returned a non-JSON response. Try again.`)
      }
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`)
      setSandbox({ imageUrl: data.image_url, prompt: data.prompt, iteration: sandbox.iteration + 1 })
      setRefinePrompt('')
    } catch (err: any) { setGenError(err.message) }
    finally { setGenerating(false) }
  }

  // Remove solid background from a base64 PNG.
  // Step 1: flood-fill from corners to clear connected background
  // Step 2: global near-background pass — reduces alpha of any remaining
  //         near-white pixels proportionally to how close they are to the bg colour.
  //         This catches the soft feathered halo flood-fill misses.
  async function removeBackground(b64: string): Promise<Uint8Array> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const W = img.naturalWidth, H = img.naturalHeight
        const canvas = document.createElement('canvas')
        canvas.width = W; canvas.height = H
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, W, H)
        const { data } = imageData

        // Sample background colour from corners
        const corners = [[0,0],[W-1,0],[0,H-1],[W-1,H-1]]
        const samples = corners.map(([x,y]) => {
          const i = (y*W+x)*4
          return [data[i],data[i+1],data[i+2],data[i+3]]
        })
        // If all corners are already transparent, skip processing
        const allTransparent = samples.every(s => s[3] < 30)
        if (allTransparent) {
          const binaryStr = atob(b64)
          const bytes = new Uint8Array(binaryStr.length)
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
          resolve(bytes); return
        }

        const bgR = Math.round(samples.reduce((s,c)=>s+c[0],0)/4)
        const bgG = Math.round(samples.reduce((s,c)=>s+c[1],0)/4)
        const bgB = Math.round(samples.reduce((s,c)=>s+c[2],0)/4)

        // ── Step 1: Flood-fill from corners (catches connected background) ──
        const FLOOD_TOL = 40
        const isBg = (i: number) => {
          if (data[i+3] < 30) return true
          const dr=data[i]-bgR, dg=data[i+1]-bgG, db=data[i+2]-bgB
          return Math.sqrt(dr*dr+dg*dg+db*db) < FLOOD_TOL
        }
        const visited = new Uint8Array(W*H)
        const queue: number[] = [0, W-1, (H-1)*W, (H-1)*W+W-1]
        queue.forEach(p => { visited[p]=1 })
        while (queue.length > 0) {
          const pos = queue.pop()!
          const x = pos%W, y = Math.floor(pos/W)
          const i = pos*4
          if (!isBg(i)) continue
          const dr=data[i]-bgR, dg=data[i+1]-bgG, db=data[i+2]-bgB
          const d = Math.sqrt(dr*dr+dg*dg+db*db)
          data[i+3] = d < FLOOD_TOL ? 0 : Math.min(data[i+3], Math.round((d/FLOOD_TOL)*data[i+3]))
          const ns = [x>0?pos-1:-1, x<W-1?pos+1:-1, y>0?pos-W:-1, y<H-1?pos+W:-1]
          for (const n of ns) { if (n>=0 && !visited[n]) { visited[n]=1; queue.push(n) } }
        }

        // ── Step 2: Global near-background alpha reduction ──────────────────
        // For every pixel still having alpha > 0, measure its distance from
        // the background colour. Pixels within SOFT_INNER are fully transparent;
        // pixels between SOFT_INNER and SOFT_OUTER get a proportional alpha
        // reduction blended with existing alpha; pixels beyond SOFT_OUTER are untouched.
        const SOFT_INNER = 30   // fully transparent if dist < this
        const SOFT_OUTER = 100  // no reduction if dist > this
        for (let p = 0; p < W * H; p++) {
          const i = p * 4
          if (data[i+3] === 0) continue
          const dr = data[i] - bgR, dg = data[i+1] - bgG, db = data[i+2] - bgB
          const dist = Math.sqrt(dr*dr + dg*dg + db*db)
          if (dist < SOFT_INNER) {
            data[i+3] = 0
          } else if (dist < SOFT_OUTER) {
            // Linear falloff: 0 at SOFT_INNER, full alpha at SOFT_OUTER
            const t = (dist - SOFT_INNER) / (SOFT_OUTER - SOFT_INNER)
            data[i+3] = Math.round(data[i+3] * t)
          }
        }

        ctx.putImageData(imageData, 0, 0)
        canvas.toBlob(blob => {
          if (!blob) {
            const binaryStr = atob(b64)
            const bytes = new Uint8Array(binaryStr.length)
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
            resolve(bytes); return
          }
          blob.arrayBuffer().then(ab => resolve(new Uint8Array(ab)))
        }, 'image/png')
      }
      img.onerror = () => {
        const binaryStr = atob(b64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
        resolve(bytes)
      }
      img.src = `data:image/png;base64,${b64}`
    })
  }

  async function handleGenSave() {
    if (!sandbox || !genSaveName.trim()) { setGenSaveError('Enter a name.'); return }
    setGenSaveError(null); setGenSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Post-process: auto-crop margins + flood-fill from corners to remove any
      // residual background color the AI left despite the transparent bg instruction.
      // The canvas starts transparent — only the book and its shadow get drawn.
      const FINAL_W = 480
      const FINAL_H = 700
      const SCAN_W = 1024
      const SCAN_H = 1536
      const imgEl = new Image()
      imgEl.crossOrigin = 'anonymous'
      const imgLoaded = new Promise<void>((res, rej) => {
        imgEl.onload = () => res()
        imgEl.onerror = () => rej(new Error('Image load failed'))
      })
      imgEl.src = sandbox.imageUrl
      await imgLoaded

      // Scan at full AI resolution to find crop bounds and remove background
      const scanCanvas = document.createElement('canvas')
      scanCanvas.width = SCAN_W
      scanCanvas.height = SCAN_H
      const scanCtx = scanCanvas.getContext('2d')!
      scanCtx.drawImage(imgEl, 0, 0, SCAN_W, SCAN_H)
      const imageData = scanCtx.getImageData(0, 0, SCAN_W, SCAN_H)
      const { data } = imageData

      // Sample background from corners
      const sampleCorner = (x: number, y: number) => {
        const i = (y * SCAN_W + x) * 4
        return [data[i], data[i + 1], data[i + 2], data[i + 3]]
      }
      const corners4 = [
        sampleCorner(0, 0), sampleCorner(SCAN_W - 1, 0),
        sampleCorner(0, SCAN_H - 1), sampleCorner(SCAN_W - 1, SCAN_H - 1),
      ]
      const bgR = Math.round(corners4.reduce((s, c) => s + c[0], 0) / 4)
      const bgG = Math.round(corners4.reduce((s, c) => s + c[1], 0) / 4)
      const bgB = Math.round(corners4.reduce((s, c) => s + c[2], 0) / 4)
      const bgA = Math.round(corners4.reduce((s, c) => s + c[3], 0) / 4)

      // Flood-fill from all corners to make background transparent
      // Use higher tolerance since shadows need gradual fade
      const TOL = 50
      const isBg = (i: number) => {
        if (data[i + 3] === 0) return true  // already transparent
        // If AI generated transparent background, bgA will be ~0 — use brightness check
        if (bgA < 30) {
          // AI used transparent background, just clean up near-transparent pixels
          return data[i + 3] < 30
        }
        const dr = data[i] - bgR, dg = data[i + 1] - bgG, db = data[i + 2] - bgB
        return Math.sqrt(dr * dr + dg * dg + db * db) < TOL
      }

      const visited = new Uint8Array(SCAN_W * SCAN_H)
      const queue: number[] = []
      const startPositions = [
        0, SCAN_W - 1, (SCAN_H - 1) * SCAN_W, (SCAN_H - 1) * SCAN_W + SCAN_W - 1
      ]
      for (const pos of startPositions) {
        if (!visited[pos]) { visited[pos] = 1; queue.push(pos) }
      }
      while (queue.length > 0) {
        const pos = queue.pop()!
        const x = pos % SCAN_W, y = Math.floor(pos / SCAN_W)
        const i = pos * 4
        if (!isBg(i)) continue
        // Make transparent with soft fade based on distance from background color
        const dr = data[i] - bgR, dg = data[i + 1] - bgG, db = data[i + 2] - bgB
        const d = Math.sqrt(dr * dr + dg * dg + db * db)
        const fadeAlpha = d < TOL ? Math.round((d / TOL) * data[i + 3]) : data[i + 3]
        data[i + 3] = Math.min(data[i + 3], fadeAlpha > 60 ? fadeAlpha : 0)
        const ns = [
          x > 0 ? pos - 1 : -1, x < SCAN_W - 1 ? pos + 1 : -1,
          y > 0 ? pos - SCAN_W : -1, y < SCAN_H - 1 ? pos + SCAN_W : -1,
        ]
        for (const n of ns) {
          if (n >= 0 && !visited[n]) { visited[n] = 1; queue.push(n) }
        }
      }
      scanCtx.putImageData(imageData, 0, 0)

      // Find crop bounds (first non-transparent pixels from each edge)
      let cropLeft = 0, cropRight = SCAN_W - 1, cropTop = 0, cropBottom = SCAN_H - 1
      outer1: for (let x = 0; x < SCAN_W / 2; x++) {
        for (let y = 0; y < SCAN_H; y++) {
          if (data[(y * SCAN_W + x) * 4 + 3] > 10) { cropLeft = Math.max(0, x - 4); break outer1 }
        }
      }
      outer2: for (let x = SCAN_W - 1; x > SCAN_W / 2; x--) {
        for (let y = 0; y < SCAN_H; y++) {
          if (data[(y * SCAN_W + x) * 4 + 3] > 10) { cropRight = Math.min(SCAN_W - 1, x + 4); break outer2 }
        }
      }
      outer3: for (let y = 0; y < SCAN_H / 2; y++) {
        for (let x = 0; x < SCAN_W; x++) {
          if (data[(y * SCAN_W + x) * 4 + 3] > 10) { cropTop = Math.max(0, y - 4); break outer3 }
        }
      }
      outer4: for (let y = SCAN_H - 1; y > SCAN_H / 2; y--) {
        for (let x = 0; x < SCAN_W; x++) {
          if (data[(y * SCAN_W + x) * 4 + 3] > 10) { cropBottom = Math.min(SCAN_H - 1, y + 4); break outer4 }
        }
      }

      const cropW = cropRight - cropLeft
      const cropH = cropBottom - cropTop
      const PAD = 20
      const scale = Math.min((FINAL_W - PAD * 2) / cropW, (FINAL_H - PAD * 2) / cropH)
      const drawW = Math.round(cropW * scale)
      const drawH = Math.round(cropH * scale)
      const offX = Math.round((FINAL_W - drawW) / 2)
      const offY = Math.round((FINAL_H - drawH) / 2)

      const canvas = document.createElement('canvas')
      canvas.width = FINAL_W
      canvas.height = FINAL_H
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(scanCanvas, cropLeft, cropTop, cropW, cropH, offX, offY, drawW, drawH)

      const paddedBlob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png')
      )

      const fileName = `cover/${user.id}/${Date.now()}.png`
      const { error: uploadErr } = await supabase.storage.from('book-skins').upload(fileName, paddedBlob, { contentType: 'image/png', upsert: false })
      if (uploadErr) throw new Error('Upload failed: ' + uploadErr.message)
      const { data: { publicUrl } } = supabase.storage.from('book-skins').getPublicUrl(fileName)
      const { data: newSkin, error: insertErr } = await supabase.from('book_skins').insert({
        name: genSaveName.trim(), description: genSaveDesc.trim() || null,
        skin_type: 'cover', image_url: publicUrl,
        width: FINAL_W, height: FINAL_H,
        created_by: user.id, visibility: genSaveVisibility,
        cover_layout: genCoverLayout,
      }).select('id').single()
      if (insertErr) throw new Error(insertErr.message)
      setGenSaveOpen(false); setGenSaveName(''); setGenSaveDesc('')
      setSandbox(null); setGenPrompt(''); setRefinePrompt('')
      setGenCoverLayout(DEFAULT_LAYOUT); setShowGenLayoutEditor(false)
      setIdentifiedObjects(null); setSelectedExtractObjects(new Set())
      setUploadSuccess('✅ Book cover saved!')
      onSaved?.()

      // If sandbox has extracted objects (from preview extraction), save them now
      if (sandbox.extractedObjects && sandbox.extractedObjects.length > 0 && newSkin?.id) {
        setExtracting(true)
        try {
          const { data: { user: saveUser } } = await supabase.auth.getUser()
          const uid = saveUser?.id ?? 'unknown'
          const ts = Date.now()

          // Upload all objects in parallel — Supabase storage handles concurrent uploads fine
          const uploadResults = await Promise.allSettled(
            sandbox.extractedObjects.map(async (obj, i) => {
              const rawB64 = obj.b64raw ?? (
                obj.imageUrl?.startsWith('data:image/png;base64,')
                  ? obj.imageUrl.replace('data:image/png;base64,', '')
                  : null
              )

              if (!rawB64) {
                if (obj.imageUrl?.startsWith('http')) {
                  const { error: insertErr2 } = await supabase.from('book_skin_overlays').insert({
                    skin_id: newSkin.id, label: obj.label,
                    image_url: obj.imageUrl, sort_order: i, overlay_config: null,
                  })
                  if (insertErr2) throw new Error(`DB insert failed for "${obj.label}": ${insertErr2.message}`)
                  return true
                }
                return false
              }

              // Strip background before uploading — gpt-image-2 sometimes returns solid white bg
              const bytes = await removeBackground(rawB64)

              const slug = obj.label.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 30)
              const filePath = `${uid}/overlay-${ts}-${i}-${slug}.png`
              const { error: upErr } = await supabase.storage
                .from('book-skins')
                .upload(filePath, bytes, { contentType: 'image/png', upsert: false })

              if (upErr) throw new Error(`Upload failed for "${obj.label}": ${upErr.message}`)

              const { data: { publicUrl } } = supabase.storage.from('book-skins').getPublicUrl(filePath)
              const { error: insertErr } = await supabase.from('book_skin_overlays').insert({
                skin_id: newSkin.id, label: obj.label,
                image_url: publicUrl, sort_order: i, overlay_config: null,
              })
              if (insertErr) throw new Error(`DB insert failed for "${obj.label}": ${insertErr.message}`)
              return true
            })
          )

          const savedCount = uploadResults.filter(r => r.status === 'fulfilled' && r.value === true).length
          const failedMessages = uploadResults
            .filter(r => r.status === 'rejected')
            .map(r => (r as PromiseRejectedResult).reason?.message ?? 'unknown')
          if (failedMessages.length > 0) {
            console.warn('[handleGenSave] some overlays failed:', failedMessages)
          }

          if (savedCount > 0) {
            await supabase.from('book_skins').update({ has_overlays: true }).eq('id', newSkin.id)
            const failNote = failedMessages.length > 0 ? ` (${failedMessages.length} failed: ${failedMessages[0].slice(0, 60)})` : ''
            setUploadSuccess(`✅ Book cover saved with ${savedCount} overlay${savedCount !== 1 ? 's' : ''}!${failNote}`)
          } else {
            const errNote = failedMessages.length > 0 ? ` Error: ${failedMessages[0].slice(0, 100)}` : ''
            setUploadSuccess(`✅ Book cover saved! Overlay upload failed.${errNote} Run fix-book-skin-overlays-rls.sql in Supabase.`)
          }
          onSaved?.()
        } catch (err: any) {
          console.warn('[handleGenSave] overlay insert error:', err.message)
        } finally {
          setExtracting(false)
        }
      }
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
                      <label className="block text-xs font-semibold text-amber-800 mb-1">Art Style</label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setArtStyle('')}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${artStyle === '' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'}`}
                        >
                          ✦ Default
                        </button>
                        {ART_STYLES.map(s => (
                          <button
                            key={s.id}
                            onClick={() => setArtStyle(prev => prev === s.id ? '' : s.id)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${artStyle === s.id ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'}`}
                          >
                            {s.emoji} {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
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
                            // Themed prompt database: each entry has a background + matching corner clusters
                            // Background and corners are deliberately chosen to reinforce the same theme
                            const themes = [
                              // ── Nature & Seasons ──
                              {
                                bg: 'cherry blossom garden with soft falling pink petals, light mist and gentle watercolor wash',
                                corners: '[koi fish leaping + lily pad + water ripples] [jade tea cup + steam wisps + bamboo sprig] [paper fan + silk ribbon + fallen petals] [stone lantern + moss + incense smoke]',
                              },
                              {
                                bg: 'enchanted autumn forest with amber and crimson leaves, golden light rays through canopy, soft forest floor',
                                corners: '[fox curled on leaf pile + acorns + fallen oak leaves] [red mushroom + dewdrops + tiny snail] [hedgehog + pine cones + berries] [lantern lit + autumn leaf wreath + cobweb]',
                              },
                              {
                                bg: 'arctic tundra with soft snowflake patterns, aurora shimmer and frost crystal texture',
                                corners: '[polar bear cub + snow mound + snowflake crystal] [penguin + ice block + frozen fish] [wolf footprint + pine branch + icicle shards] [aurora crystal + ice gems + frozen droplets]',
                              },
                              {
                                bg: 'tropical jungle with dense leaves, hanging vines, humid mist and dappled sunlight',
                                corners: '[toucan on branch + tropical flowers + leaves] [tree frog + exotic berries + broad leaf] [butterfly + orchid blossom + dewdrop] [coconut halves + palm seeds + vine curl]',
                              },
                              {
                                bg: 'underwater coral reef with soft bubble patterns, light caustics, bioluminescent dots and ocean blue gradients',
                                corners: '[seahorse + coral branch + bubbles] [clownfish + sea anemone + sand pebbles] [starfish + shell + kelp strand] [treasure chest ajar + gold coins + pearl]',
                              },
                              // ── Science & Exploration ──
                              {
                                bg: 'starry night sky with deep navy, soft nebula clouds, faint constellation lines and distant galaxies',
                                corners: '[globe on mahogany stand + stacked books + compass] [rocket launch + smoke cloud + fuel canisters] [telescope + unrolled star chart + magnifying glass] [moon sphere + meteor fragment + orbit ring]',
                              },
                              {
                                bg: 'science laboratory with faint circuit line patterns, blue glow and microscopic texture',
                                corners: '[silver microscope + glass slide + petri dish] [beaker with bubbling blue liquid + dropper + vials] [seedling in terracotta pot + soil + trowel] [bunsen burner + wire gauze + test tube rack]',
                              },
                              {
                                bg: 'deep ocean abyss with bioluminescent glowing dots, dark teal gradients and pressure wave ripples',
                                corners: '[diving helmet + air hose + barnacles] [submarine porthole + pressure gauge + chains] [anglerfish glowing lure + dark coral + small bones] [submarine periscope + bubbles + seaweed]',
                              },
                              {
                                bg: 'alien planet surface with purple sky, strange rock formations and twin moon silhouettes',
                                corners: '[alien crystal spire + glowing dust + meteor shards] [space suit helmet + oxygen gauge + stars] [robot explorer + gear treads + circuit sparks] [strange plant + luminous spores + rocky soil]',
                              },
                              // ── Magic & Fantasy ──
                              {
                                bg: 'ancient stone grimoire with faint rune carvings, vine patterns and aged spell residue',
                                corners: '[wizard hat + sparkle stars + spell smoke puff] [crystal wand + rune stones + smoke wisps] [cauldron bubbling + floating herbs + vapor cloud] [owl on branch + moon sliver + scroll roll]',
                              },
                              {
                                bg: 'mystical forest clearing with glowing mushrooms, firefly lights and purple moonbeam shafts',
                                corners: '[fairy door on oak stump + moss + acorn cap] [glowing potion bottle + spell components + tiny flower] [spider web with dewdrops + forest berries + fern curl] [crystal cluster + smaller gem shards + firefly]',
                              },
                              {
                                bg: 'dragon lair cavern with rough stone walls, glowing embers, smoke wisps and gold treasure glint',
                                corners: '[dragon egg + glowing cracks + ember stones] [dragon scale + bone fragment + gem shard] [gold coin stack + jeweled crown + red gem] [torch bracket + fire sparks + soot marks]',
                              },
                              {
                                bg: 'enchanted library with books glowing softly, floating dust motes and magical constellation ceiling',
                                corners: '[open book with glowing pages + quill + inkwell] [hourglass + pocket watch + sealed letter] [key on ribbon + wax seal + folded map] [candle stub + wax drips + spectacles]',
                              },
                              // ── History & Culture ──
                              {
                                bg: 'medieval parchment with faint map lines, compass rose, aged amber spots and torn edges',
                                corners: '[chess knight on stone board + dice + carved pieces] [cardinal bird on branch + wax-sealed letter + quill] [hourglass + pocket watch + ink-stained ribbon] [shield crest + sword pommel + chain mail ring]',
                              },
                              {
                                bg: 'ancient Egypt desert with hieroglyph carvings, sand dune ripples and amber torchlight glow',
                                corners: '[scarab beetle + eye of horus amulet + gold beads] [clay canopic jar + papyrus roll + reed pen] [golden ankh + lotus flower + desert sand] [pharaoh mask + cobra serpent + lapis jewel]',
                              },
                              {
                                bg: 'feudal Japan with ink wash bamboo silhouettes, koi pond reflections and misty mountain outline',
                                corners: '[katana + silk sash + cherry blossom petal] [origami crane + calligraphy brush + ink stone] [teapot + matcha bowl + bamboo whisk] [torii gate miniature + stone lantern + lotus]',
                              },
                              // ── Seasons & Weather ──
                              {
                                bg: 'volcanic landscape with dark obsidian texture, glowing lava crack veins and ash cloud wisps',
                                corners: '[volcano erupting + lava rocks + ash plume cloud] [lava gem + ember stones + glowing cracks] [fossil skull + excavation brush + sandy soil] [obsidian crystal shard + smaller shards + igneous rock]',
                              },
                              {
                                bg: 'stormy sky with subtle lightning silhouettes, rolling cloud swirls and electric blue glow',
                                corners: '[weather vane rooster + barometer + raindrops] [storm lantern lit + rope coil + compass] [lightning rod + spark fragments + rain puddle] [dark cloud with crackle + hail stones + wind whirl]',
                              },
                              {
                                bg: 'cozy winter cabin interior with wood grain texture, frost window patterns and warm amber glow',
                                corners: '[mug of hot cocoa + mini marshmallows + cinnamon stick] [knit wool mittens + pinecone + holly sprig] [gift box tied with ribbon + snowflake tag] [candle in jar + dried orange slices + star anise]',
                              },
                              // ── Everyday & Whimsy ──
                              {
                                bg: 'storybook pastel meadow with soft watercolor wildflower patterns and gentle watercolor paper grain',
                                corners: '[tabby cat with yarn ball + small open book] [strawberries + polka dot teacup + biscuit] [ladybug on oak leaf + acorn cap + berries] [four-leaf clover + dewdrops + golden beetle]',
                              },
                              {
                                bg: 'steampunk clockwork with interlocking copper gear patterns, steam pipe texture and aged brass',
                                corners: '[pocket watch open + gear cogs + mainspring] [copper steam pipe + pressure gauge + rivets] [dirigible goggles + leather strap + compass] [clockwork bird + key + gear teeth]',
                              },
                              {
                                bg: 'retro gaming arcade with pixel grid pattern, neon grid lines and scan-line overlay texture',
                                corners: '[8-bit joystick + pixel coins + power-up star] [game controller + cartridge + blinking LED] [pixel sword + shield + health heart] [trophy cup + laurel wreath + pixel confetti]',
                              },
                            ]
                            const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
                            const t = pick(themes)
                            setGenPrompt(`${t.bg}, corner clusters: ${t.corners}`)
                          }}
                          className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors border border-amber-600"
                        >
                          🎲 Randomize
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'Starry night sky with nebula clouds, corner clusters: [globe+books+compass] [rocket+smoke+canisters] [telescope+star chart+magnifier] [moon+meteor+orbit ring]',
                          'Cherry blossom garden with falling petals and mist, corner clusters: [koi+lily pad+ripples] [tea cup+steam+bamboo] [paper fan+silk ribbon+petals] [stone lantern+moss+incense]',
                          'Ancient stone with rune carvings and vine patterns, corner clusters: [wizard hat+spell smoke+stars] [crystal wand+rune stones+wisps] [cauldron+herbs+vapor] [owl+moon+scroll]',
                          'Medieval parchment with compass rose and map lines, corner clusters: [chess knight+dice+pieces] [cardinal bird+wax letter+quill] [hourglass+pocket watch+ribbon] [shield+sword pommel+chain]',
                          'Underwater coral reef with bioluminescent dots and caustics, corner clusters: [seahorse+coral+bubbles] [clownfish+anemone+pebbles] [starfish+shell+kelp] [treasure chest+coins+pearl]',
                          'Volcanic obsidian with lava crack veins and ash wisps, corner clusters: [volcano+lava rocks+ash plume] [lava gem+ember stones+cracks] [fossil skull+brush+soil] [obsidian shards+igneous rock]',
                        ].map(ex => (
                          <button key={ex} onClick={() => setGenPrompt(ex)}
                            className="text-[11px] px-2.5 py-1 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium transition-colors text-left leading-snug border border-amber-200">
                            {ex.length > 52 ? ex.slice(0, 52) + '…' : ex}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleGenerate} disabled={generating || !genPrompt.trim()}
                        className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-semibold rounded-xl text-sm transition-colors">
                        {generating && !cleanCorners ? '⏳ Generating…' : '✨ Generate Cover'}
                      </button>
                      <button onClick={handleGenerateWithObjects} disabled={generating || !genPrompt.trim()}
                        className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-xl text-sm transition-colors">
                        {generating && cleanCorners ? '⏳ Generating cover…' : extracting ? '⏳ Generating objects…' : '✨ Generate + Objects'}
                      </button>
                    </div>
                    {/* Corner cluster mode selection */}
                    <div className="border border-purple-200 rounded-xl p-2.5 bg-purple-50/40">
                      <p className="text-[11px] font-semibold text-purple-700 mb-2">Per-corner cluster mode:</p>
                      <div className="space-y-1.5">
                        {(['Top-left ↖', 'Top-right ↗', 'Bot-left ↙', 'Bot-right ↘'] as const).map((label, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-500 w-20 shrink-0">{label}</span>
                            <div className="flex gap-1 flex-1">
                              <button
                                onClick={() => setEnabledClusters(prev => { const n = [...prev]; n[i] = true; return n })}
                                className={`flex-1 py-0.5 text-[11px] font-semibold rounded-lg border transition-colors ${enabledClusters[i] ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-500 border-gray-200 hover:border-purple-400'}`}
                              >
                                🎭 Overlay
                              </button>
                              <button
                                onClick={() => setEnabledClusters(prev => { const n = [...prev]; n[i] = false; return n })}
                                className={`flex-1 py-0.5 text-[11px] font-semibold rounded-lg border transition-colors ${!enabledClusters[i] ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-500 border-gray-200 hover:border-amber-400'}`}
                              >
                                🎨 Baked
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2">
                        <strong>Overlay</strong>: corner kept clean; objects generated as animated PNGs · <strong>Baked</strong>: objects drawn onto cover surface
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-700">Iteration #{sandbox.iteration}</span>
                      <button onClick={() => { setSandbox(null); setGenPrompt(''); setRefinePrompt('') }}
                        className="text-xs text-gray-400 hover:text-gray-600">✕ Start over</button>
                    </div>

                    {/* Preview — click to zoom */}
                    <div className="flex justify-center">
                      <div
                        className="rounded-xl overflow-hidden border-2 border-amber-200 shadow-lg cursor-zoom-in"
                        style={{ width: 280, height: 434 }}
                        onClick={() => setZoomedImage({ src: sandbox.imageUrl, label: 'Cover preview' })}
                        title="Click to zoom"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sandbox.imageUrl} alt="Generated cover" className="w-full h-full object-cover" />
                      </div>
                    </div>

                    {/* Individual objects — progressive per-cluster display */}
                    {(extracting || (sandbox.extractedObjects !== undefined)) && (
                      <div className="border border-purple-200 rounded-xl p-3 bg-purple-50/40 space-y-2">
                        {/* Cluster progress indicators */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(['Top-left', 'Top-right', 'Bot-left', 'Bot-right'] as const).map((name, i) => {
                              const st = clusterProgress[i]
                              return (
                                <span key={i} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                                  st === 1 ? 'bg-purple-100 border-purple-400 text-purple-700 animate-pulse' :
                                  st === 2 ? 'bg-green-100 border-green-400 text-green-700' :
                                  st === 3 ? 'bg-red-100 border-red-400 text-red-600' :
                                  'bg-gray-100 border-gray-300 text-gray-400'
                                }`}>
                                  {st === 1 ? '⏳' : st === 2 ? '✓' : st === 3 ? '✕' : '○'} {name}
                                </span>
                              )
                            })}
                            {extracting && <span className="text-[11px] text-purple-500 ml-1 animate-pulse">generating…</span>}
                          </div>
                          {/* Per-cluster error messages */}
                          {clusterErrors.map((err, i) => err && clusterProgress[i] === 3 ? (
                            <p key={i} className="text-[11px] text-red-600 bg-red-50 rounded-lg px-2 py-1 border border-red-200">
                              {(['Top-left','Top-right','Bot-left','Bot-right'])[i]}: {err}
                            </p>
                          ) : null)}
                        </div>
                        {/* Objects grid — fills in as each cluster completes */}
                        {sandbox.extractedObjects && sandbox.extractedObjects.length > 0 && (
                          <>
                            <p className="text-xs font-semibold text-purple-700">
                              ✨ {sandbox.extractedObjects.length} object{sandbox.extractedObjects.length !== 1 ? 's' : ''} — transparent PNGs
                              {extracting ? ' (more coming…)' : ' ready'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {sandbox.extractedObjects.map((obj, idx) => (
                                <div key={idx} className="flex flex-col items-center gap-1">
                                  <div
                                    className="w-16 h-16 rounded-lg border border-purple-200 overflow-hidden flex items-center justify-center cursor-zoom-in"
                                    style={{ background: 'repeating-conic-gradient(#d1d5db 0% 25%, #fff 0% 50%) 0 0 / 12px 12px' }}
                                    onClick={() => setZoomedImage({ src: obj.imageUrl, label: obj.label })}
                                    title="Click to zoom"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={obj.imageUrl} alt={obj.label} className="w-full h-full object-contain" />
                                  </div>
                                  <span className="text-[10px] text-purple-700 font-medium text-center max-w-[64px] truncate leading-tight">
                                    {obj.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        {!extracting && sandbox.extractedObjects?.length === 0 && (
                          <p className="text-xs text-gray-400">No objects were generated. Check errors above.</p>
                        )}
                      </div>
                    )}

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

                    {/* ── Extract corner objects (refine iteration step) ── */}
                    <div className="border border-amber-200 rounded-xl p-3 bg-amber-50/50 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-amber-800">✂️ Extract Corner Objects</span>
                        <div className="flex items-center gap-2">
                          {identifiedObjects && (
                            <button onClick={() => { setIdentifiedObjects(null); setSelectedExtractObjects(new Set()) }}
                              className="text-[10px] text-gray-400 hover:text-gray-600">↺ Re-identify</button>
                          )}
                          {!identifiedObjects ? (
                            <button onClick={handleIdentifyObjects} disabled={identifying || generating}
                              className="text-xs px-2.5 py-1 bg-amber-100 hover:bg-amber-200 disabled:bg-amber-50 text-amber-800 font-semibold rounded-lg border border-amber-300 transition-colors">
                              {identifying ? '🔍 Identifying…' : '🔍 Identify'}
                            </button>
                          ) : (
                            <button onClick={handleExtractObjects}
                              disabled={extracting || generating || selectedExtractObjects.size === 0}
                              className="text-xs px-2.5 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-lg transition-colors">
                              {extracting ? '⏳ Extracting…' : `✂️ Extract${selectedExtractObjects.size > 0 ? ` (${selectedExtractObjects.size})` : ''}`}
                            </button>
                          )}
                        </div>
                      </div>
                      {!identifiedObjects && !sandbox.extractedObjects && (
                        <p className="text-[11px] text-gray-500">
                          Identify the objects in the corner clusters, pick which to extract, then preview the stripped cover + each object as a transparent PNG.
                        </p>
                      )}
                      {identifiedObjects && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-amber-700">Select objects ({selectedExtractObjects.size}/{identifiedObjects.length}):</p>
                          <div className="flex flex-wrap gap-1.5">
                            {identifiedObjects.map(obj => {
                              const selected = selectedExtractObjects.has(obj)
                              return (
                                <button key={obj} onClick={() => {
                                  const next = new Set(selectedExtractObjects)
                                  if (selected) next.delete(obj); else next.add(obj)
                                  setSelectedExtractObjects(next)
                                }}
                                  className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-colors ${selected ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-400'}`}>
                                  {selected ? '✓ ' : ''}{obj}
                                </button>
                              )
                            })}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setSelectedExtractObjects(new Set(identifiedObjects))} className="text-[10px] text-amber-600 hover:underline">Select all</button>
                            <button onClick={() => setSelectedExtractObjects(new Set())} className="text-[10px] text-gray-400 hover:underline">Clear</button>
                          </div>
                        </div>
                      )}
                      {extractError && <p className="text-[11px] text-red-600">{extractError}</p>}
                    </div>

                    {/* ── Extracted objects preview grid ── */}
                    {sandbox.extractedObjects && sandbox.extractedObjects.length > 0 && (
                      <div className="border border-purple-200 rounded-xl p-3 bg-purple-50/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-purple-700">✨ {sandbox.extractedObjects.length} individual object{sandbox.extractedObjects.length !== 1 ? 's' : ''}</p>
                          {sandbox.originalUrl && (
                            <button onClick={() => setSandbox(prev => prev ? { ...prev, imageUrl: prev.originalUrl!, originalUrl: undefined, extractedObjects: undefined } : prev)}
                              className="text-[10px] text-gray-400 hover:text-gray-600">↺ Revert cover</button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {sandbox.extractedObjects.map((obj, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-1">
                              <div className="w-14 h-14 rounded-lg border border-purple-200 overflow-hidden flex items-center justify-center"
                                style={{ background: 'repeating-conic-gradient(#d1d5db 0% 25%, #fff 0% 50%) 0 0 / 12px 12px' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={obj.imageUrl} alt={obj.label} className="w-full h-full object-contain" />
                              </div>
                              <span className="text-[10px] text-purple-700 font-medium text-center max-w-[56px] truncate">{obj.label}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400">These will be saved as animated overlays alongside the stripped cover.</p>
                      </div>
                    )}

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

                        {/* ── Extract overlay objects (summary from refine step) ── */}
                        <div className="border-t border-amber-100 pt-3">
                          {identifiedObjects && selectedExtractObjects.size > 0 ? (
                            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 border border-amber-200">
                              <span>✂️</span>
                              <span><strong>{selectedExtractObjects.size}</strong> corner object{selectedExtractObjects.size !== 1 ? 's' : ''} will be extracted after saving</span>
                              {extracting && <span className="ml-auto animate-spin">⏳</span>}
                            </div>
                          ) : (
                            <p className="text-[11px] text-gray-400">
                              Tip: use "✨ Generate + Objects" to generate animated overlay objects alongside the cover.
                            </p>
                          )}
                          {extractError && <p className="text-[11px] text-red-600 mt-1">{extractError}</p>}
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => setGenSaveOpen(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm">Cancel</button>
                          <button onClick={handleGenSave} disabled={genSaving || extracting || !genSaveName.trim()}
                            className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold rounded-xl text-sm">
                            {genSaving ? '⏳ Saving…' : extracting ? '⏳ Uploading objects…' : '💾 Save'}
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

      {/* Lightbox — click any cover or object thumbnail to zoom */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-2xl w-full flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <div
              className="rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: 'repeating-conic-gradient(#374151 0% 25%, #1f2937 0% 50%) 0 0 / 20px 20px', maxHeight: '80vh' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomedImage.src}
                alt={zoomedImage.label}
                className="max-w-full max-h-[78vh] object-contain"
                style={{ display: 'block' }}
              />
            </div>
            <div className="flex items-center justify-between w-full px-1">
              <span className="text-white text-sm font-semibold drop-shadow">{zoomedImage.label}</span>
              <button
                onClick={() => setZoomedImage(null)}
                className="text-white/70 hover:text-white text-sm px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay Animation Editor — used in the manage modal of this page
// ─────────────────────────────────────────────────────────────────────────────
import { buildKeyframesCSS, buildAnimCSS, getTransformOrigin, OV_ANIM_OPTIONS, overlayWidthPct } from '@/lib/overlayAnimations'
import { BurstPolygonEditor } from '@/components/BurstPolygonEditor'
import type { BurstConfig } from '@/components/OverlayBurstRenderer'
import { OverlayBurstRenderer } from '@/components/OverlayBurstRenderer'
import { OverlayAuraWrapper } from '@/components/OverlayAuraWrapper'
type OverlayAnim = 'none' | 'float' | 'pulse' | 'rotate' | 'shimmer' | 'bounce' | 'sway' | 'flicker' | 'bling' | 'burst'
interface OvConfig { x: number; y: number; scale: number; animation: OverlayAnim; speed: number; burst?: BurstConfig; auraStrength?: number; auraDistance?: number }
const DEFAULT_OV: OvConfig = { x: 15, y: 15, scale: 1.0, animation: 'float', speed: 1.0, auraStrength: 0, auraDistance: 20 }
const DEFAULT_BURST: BurstConfig = {
  polygon: [],
  center: { x: 50, y: 50 },
  particles: 8,
  radius: 15,
}
const OV_KEYFRAMES = buildKeyframesCSS('bov')
const OV_CSS_FN = (anim: OverlayAnim, speed: number) => buildAnimCSS(anim, 'bov', speed)
const OV_ANIMS = OV_ANIM_OPTIONS

function OverlayEditorInline({
  skin, overlays, loading, saving, onSave, onClose,
}: {
  skin: BookSkin; overlays: any[]; loading: boolean; saving: boolean
  onSave: (overlay: any, config: OvConfig) => void; onClose: () => void
}) {
  const supabase = (typeof window !== 'undefined' ? require('@/lib/supabase/client').createClient() : null)
  // localOverlays: mutable copy — grows on duplicate, shrinks on delete
  const [localOverlays, setLocalOverlays] = useState<any[]>(() => overlays)
  const [selected, setSelected] = useState<string | null>(overlays[0]?.id ?? null)
  const [configs, setConfigs] = useState<Record<string, OvConfig>>(() => {
    const init: Record<string, OvConfig> = {}
    for (const o of overlays) init[o.id] = o.overlay_config ?? { ...DEFAULT_OV }
    return init
  })

  // Sync when parent loads data asynchronously (overlays prop updates after mount)
  useEffect(() => {
    if (overlays.length > 0) {
      setLocalOverlays(overlays)
      setSelected(prev => {
        // Keep current selection if it exists in new overlays, else pick first
        if (overlays.find(o => o.id === prev)) return prev
        return overlays[0]?.id ?? null
      })
      setConfigs(prev => {
        const next = { ...prev }
        for (const o of overlays) {
          if (!next[o.id]) next[o.id] = o.overlay_config ?? { ...DEFAULT_OV }
        }
        return next
      })
      setZOrder(prev => {
        // Preserve existing order, add any new IDs at the end
        const existingIds = new Set(prev)
        const newIds = overlays.map(o => o.id).filter(id => !existingIds.has(id))
        return [...prev.filter(id => overlays.find(o => o.id === id)), ...newIds]
      })
    }
  }, [overlays])
  // zOrder: array of overlay IDs from bottom (index 0) to top (last index)
  const [zOrder, setZOrder] = useState<string[]>(() => overlays.map(o => o.id))
  const [mutating, setMutating] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null)

  const sel = localOverlays.find(o => o.id === selected)
  const cfg = selected ? (configs[selected] ?? DEFAULT_OV) : null

  function upd(id: string, patch: Partial<OvConfig>) {
    setConfigs(prev => ({ ...prev, [id]: { ...(prev[id] ?? DEFAULT_OV), ...patch } }))
  }

  function moveLayer(id: string, direction: 'front' | 'back' | 'forward' | 'backward') {
    setZOrder(prev => {
      const idx = prev.indexOf(id)
      if (idx === -1) return prev
      const next = [...prev]
      if (direction === 'back' || direction === 'backward') {
        if (idx === 0) return prev
        const swapIdx = direction === 'back' ? 0 : idx - 1
        next.splice(idx, 1)
        next.splice(swapIdx, 0, id)
      } else {
        if (idx === prev.length - 1) return prev
        const swapIdx = direction === 'front' ? prev.length - 1 : idx + 1
        next.splice(idx, 1)
        next.splice(swapIdx, 0, id)
      }
      return next
    })
  }

  async function duplicateOverlay(o: any) {
    if (!supabase) return
    setMutating(true)
    try {
      const srcCfg = configs[o.id] ?? DEFAULT_OV
      // Insert into DB with a slight position offset so it's visibly separate
      const { data: newRow, error } = await supabase.from('book_skin_overlays').insert({
        skin_id: o.skin_id,
        label: o.label + ' (copy)',
        image_url: o.image_url,
        sort_order: localOverlays.length,
        overlay_config: { ...srcCfg, x: Math.min(100, srcCfg.x + 5), y: Math.min(100, srcCfg.y + 5) },
      }).select('*').single()
      if (error || !newRow) throw new Error(error?.message ?? 'Insert failed')
      const newCfg: OvConfig = newRow.overlay_config ?? { ...srcCfg, x: Math.min(100, srcCfg.x + 5), y: Math.min(100, srcCfg.y + 5) }
      setLocalOverlays(prev => [...prev, newRow])
      setConfigs(prev => ({ ...prev, [newRow.id]: newCfg }))
      setZOrder(prev => [...prev, newRow.id])
      setSelected(newRow.id)
    } catch (err: any) {
      console.error('[duplicateOverlay]', err.message)
    } finally {
      setMutating(false)
    }
  }

  async function deleteOverlay(id: string) {
    if (!supabase) return
    if (!confirm('Remove this overlay object?')) return
    setMutating(true)
    try {
      await supabase.from('book_skin_overlays').delete().eq('id', id)
      setLocalOverlays(prev => prev.filter(o => o.id !== id))
      setZOrder(prev => prev.filter(z => z !== id))
      setConfigs(prev => { const n = { ...prev }; delete n[id]; return n })
      setSelected(prev => {
        if (prev !== id) return prev
        const remaining = localOverlays.filter(o => o.id !== id)
        return remaining[0]?.id ?? null
      })
    } catch (err: any) {
      console.error('[deleteOverlay]', err.message)
    } finally {
      setMutating(false)
    }
  }

  function startDrag(id: string, cx: number, cy: number) {
    const c = configs[id] ?? DEFAULT_OV
    dragging.current = { id, sx: cx, sy: cy, ox: c.x, oy: c.y }
    setSelected(id)
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragging.current || !previewRef.current) return
      const r = previewRef.current.getBoundingClientRect()
      const x = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
      const y = 'touches' in ev ? ev.touches[0].clientY : ev.clientY
      upd(id, {
        x: Math.max(0, Math.min(100, dragging.current.ox + ((x - dragging.current.sx) / r.width) * 100)),
        y: Math.max(0, Math.min(100, dragging.current.oy + ((y - dragging.current.sy) / r.height) * 100)),
      })
    }
    const onEnd = () => {
      dragging.current = null
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd)
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onMove, { passive: false }); window.addEventListener('touchend', onEnd)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <style>{OV_KEYFRAMES}</style>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <div className="font-bold text-gray-900">✨ Animate Overlays — {skin.name}</div>
            <div className="text-xs text-gray-400 mt-0.5">Drag objects on the cover preview · pick animation · save</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light">×</button>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16 text-gray-400">Loading overlays…</div>
        ) : localOverlays.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-16 px-6 text-center text-gray-400 text-sm">
            No overlay objects found. Extract corner objects first using the Generate tab.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Cover preview — full width, matches challenge page rendering */}
            <div className="shrink-0 flex flex-col gap-2 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-500 px-4 pt-3">Drag objects to reposition</p>
              <div ref={previewRef} className="relative w-full overflow-hidden" style={{ userSelect: 'none', background: '#1a1a1a' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={skin.image_url} alt={skin.name} className="w-full h-auto block" draggable={false} />
                {localOverlays.map(o => {
                  const c = configs[o.id] ?? DEFAULT_OV
                  const sz = overlayWidthPct(c.scale)
                  const speed = c.speed ?? 1.0
                  const zIdx = zOrder.indexOf(o.id)  // position in zOrder = actual z-index

                  // Burst: show canvas renderer in editor too
                  if (c.animation === 'burst' && c.burst?.polygon && c.burst.polygon.length >= 3) {
                    return (
                      <div key={o.id}
                        onMouseDown={e => { e.preventDefault(); startDrag(o.id, e.clientX, e.clientY) }}
                        onTouchStart={e => startDrag(o.id, e.touches[0].clientX, e.touches[0].clientY)}
                        style={{ position: 'absolute', left: `${c.x}%`, top: `${c.y}%`, transform: 'translate(-50%,-50%)', zIndex: zIdx + 2, outline: selected === o.id ? '2px solid #a855f7' : undefined, borderRadius: 4, cursor: 'grab' }}>
                        <OverlayBurstRenderer imageUrl={o.image_url}
                          containerWidthPx={previewRef.current?.offsetWidth ?? 480}
                          scale={c.scale} speed={speed} burst={c.burst} />
                      </div>
                    )
                  }
                  return (
                    <div key={o.id}
                      onMouseDown={e => { e.preventDefault(); startDrag(o.id, e.clientX, e.clientY) }}
                      onTouchStart={e => startDrag(o.id, e.touches[0].clientX, e.touches[0].clientY)}
                      style={{ position: 'absolute', left: `${c.x}%`, top: `${c.y}%`, transform: 'translate(-50%,-50%)', width: sz, height: sz, cursor: 'grab', zIndex: zIdx + 2, outline: selected === o.id ? '2px solid #a855f7' : undefined, borderRadius: 4 }}>
                      {/* Aura canvas — drawn before the image */}
                      {(c.auraStrength ?? 0) > 0 && (
                        <OverlayAuraWrapper
                          overlayImageUrl={o.image_url}
                          coverImageUrl={skin.image_url}
                          xPct={c.x} yPct={c.y}
                          widthPct={sz}
                          auraStrength={c.auraStrength}
                          auraDistance={c.auraDistance ?? 20}
                          containerWidthPx={previewRef.current?.offsetWidth ?? 480}
                          style={{ position: 'absolute', inset: 0, transform: 'none', left: 0, top: 0, width: '100%', height: '100%' }}
                        ><span /></OverlayAuraWrapper>
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={o.image_url} alt={o.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', animation: c.animation !== 'none' ? OV_CSS_FN(c.animation, speed) : undefined, transformOrigin: getTransformOrigin(c.animation), pointerEvents: 'none', ...overlayEdgeFadeStyle(c.edgeFade) }} draggable={false} />
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Controls — below the preview */}
            <div className="flex-1 p-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {localOverlays.map(o => (
                  <button key={o.id} onClick={() => setSelected(o.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border-2 transition-colors ${selected === o.id ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.image_url} alt={o.label} className="w-5 h-5 object-contain" />{o.label}
                  </button>
                ))}
              </div>
              {sel && cfg && (
                <div className="space-y-3 border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-800 capitalize">{sel.label}</p>
                    {overlays.length > 1 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400 mr-1">Layer:</span>
                        <button onClick={() => moveLayer(sel.id, 'back')} title="Send to back"
                          className="text-[11px] px-1.5 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 font-bold" disabled={zOrder.indexOf(sel.id) === 0}>⬇⬇</button>
                        <button onClick={() => moveLayer(sel.id, 'backward')} title="Move back one"
                          className="text-[11px] px-1.5 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 font-bold" disabled={zOrder.indexOf(sel.id) === 0}>⬇</button>
                        <button onClick={() => moveLayer(sel.id, 'forward')} title="Move forward one"
                          className="text-[11px] px-1.5 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 font-bold" disabled={zOrder.indexOf(sel.id) === zOrder.length - 1}>⬆</button>
                        <button onClick={() => moveLayer(sel.id, 'front')} title="Bring to front"
                          className="text-[11px] px-1.5 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 font-bold" disabled={zOrder.indexOf(sel.id) === zOrder.length - 1}>⬆⬆</button>
                        <span className="text-[10px] text-gray-400 ml-1">{zOrder.indexOf(sel.id) + 1}/{zOrder.length}</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">X ({Math.round(cfg.x)}%)</label>
                      <input type="range" min={0} max={100} step={1} value={cfg.x} onChange={e => upd(sel.id, { x: Number(e.target.value) })} className="w-full accent-purple-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Y ({Math.round(cfg.y)}%)</label>
                      <input type="range" min={0} max={100} step={1} value={cfg.y} onChange={e => upd(sel.id, { y: Number(e.target.value) })} className="w-full accent-purple-600" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Scale ({cfg.scale.toFixed(1)}×)</label>
                    <input type="range" min={0.3} max={4.0} step={0.1} value={cfg.scale} onChange={e => upd(sel.id, { scale: Number(e.target.value) })} className="w-full accent-purple-600" />
                  </div>

                  {/* ── Boundary aura — darkens cover pixels at object boundary ── */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      🌑 Boundary aura ({Math.round((cfg.auraStrength ?? 0) * 100)}%)
                      <span className="ml-1 font-normal text-gray-400">
                        {(cfg.auraStrength ?? 0) === 0 ? 'off' : (cfg.auraStrength ?? 0) < 0.3 ? 'subtle' : (cfg.auraStrength ?? 0) < 0.6 ? 'medium' : 'strong'}
                      </span>
                    </label>
                    <input type="range" min={0} max={0.8} step={0.05} value={cfg.auraStrength ?? 0}
                      onChange={e => upd(sel.id, { auraStrength: Number(e.target.value) })}
                      className="w-full accent-amber-600" />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                      <span>0% off</span><span>40% medium</span><span>80% strong</span>
                    </div>
                  </div>
                  {(cfg.auraStrength ?? 0) > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Aura distance ({cfg.auraDistance ?? 20}px)
                      </label>
                      <input type="range" min={4} max={40} step={2} value={cfg.auraDistance ?? 20}
                        onChange={e => upd(sel.id, { auraDistance: Number(e.target.value) })}
                        className="w-full accent-amber-500" />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                        <span>4px tight</span><span>20px medium</span><span>40px wide</span>
                      </div>
                    </div>
                  )}

                  {/* ── Animation ── */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Animation</label>
                    <div className="flex flex-wrap gap-1.5">
                      {OV_ANIMS.map(opt => (
                        <button key={opt.value} onClick={() => upd(sel.id, { animation: opt.value })}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${cfg.animation === opt.value ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {cfg.animation !== 'none' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Speed ({(cfg.speed ?? 1.0).toFixed(1)}×)
                        <span className="ml-1 font-normal text-gray-400">
                          {(cfg.speed ?? 1.0) < 0.8 ? '🐢 slow' : (cfg.speed ?? 1.0) > 1.5 ? '⚡ fast' : ''}
                        </span>
                      </label>
                      <input type="range" min={0.25} max={3.0} step={0.25} value={cfg.speed ?? 1.0}
                        onChange={e => upd(sel.id, { speed: Number(e.target.value) })}
                        className="w-full accent-purple-600" />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                        <span>0.25× slow</span><span>1× normal</span><span>3× fast</span>
                      </div>
                    </div>
                  )}
                  {/* Burst polygon editor — shown when animation='burst' */}
                  {cfg.animation === 'burst' && (
                    <BurstPolygonEditor
                      imageUrl={sel.image_url}
                      burst={cfg.burst ?? DEFAULT_BURST}
                      onChange={b => upd(sel.id, { burst: b })}
                    />
                  )}
                  <button disabled={saving} onClick={() => onSave(sel, configs[sel.id] ?? DEFAULT_OV)}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold rounded-xl text-sm">
                    {saving ? '⏳ Saving…' : `💾 Save "${sel.label}"`}
                  </button>
                  <div className="flex gap-2 pt-1">
                    <button disabled={mutating} onClick={() => duplicateOverlay(sel)}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors">
                      {mutating ? '⏳' : '⧉ Duplicate'}
                    </button>
                    <button disabled={mutating || localOverlays.length <= 1} onClick={() => deleteOverlay(sel.id)}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-xl border-2 border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors">
                      {mutating ? '⏳' : '🗑 Delete'}
                    </button>
                  </div>
                </div>
              )}
              {localOverlays.length >= 1 && (
                <button disabled={saving} onClick={async () => {
                  for (const o of localOverlays) await onSave(o, configs[o.id] ?? DEFAULT_OV)
                  // Persist z-order as sort_order on each overlay
                  const supabaseClient = (await import('@/lib/supabase/client')).createClient()
                  for (let i = 0; i < zOrder.length; i++) {
                    await supabaseClient.from('book_skin_overlays').update({ sort_order: i }).eq('id', zOrder[i])
                  }
                  onClose()
                }}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold rounded-xl text-sm">
                  {saving ? '⏳ Saving…' : `✨ Save Animation & Close`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
