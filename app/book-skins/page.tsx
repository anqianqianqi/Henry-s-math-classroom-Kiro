'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useRef, useState } from 'react'
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
    setOverlayEditorLoading(true)
    const { data } = await supabase
      .from('book_skin_overlays')
      .select('*')
      .eq('skin_id', skin.id)
      .order('sort_order', { ascending: true })
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
              {/* Overlay animation editor — cover skins with extracted objects */}
              {actionSkin.skin_type === 'cover' && (actionSkin as any).has_overlays && (
                <button
                  onClick={() => { openOverlayEditor(actionSkin); setActionSkin(null) }}
                  className="w-full py-2 px-3 text-sm font-semibold rounded-xl border-2 border-dashed border-purple-400 text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
                >
                  ✨ Animate Overlay Objects
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
  const [sandbox, setSandbox] = useState<{
    imageUrl: string       // current cover image (may be stripped if extraction was done)
    originalUrl?: string   // the pre-extraction cover (for reference)
    prompt: string
    iteration: number
    extractedObjects?: { label: string; imageUrl: string }[]  // transparent PNG per object
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
  const [cleanCorners, setCleanCorners] = useState(false)  // false = corner clusters (default), true = clean for overlays

  // ── Overlay extraction / object generation state ─────────────────────────
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)

  async function handleGenerateWithObjects() {
    if (!genPrompt.trim()) { setGenError('Enter a description.'); return }
    setGenError(null); setGenerating(true); setCleanCorners(true)
    try {
      // Fire cover + 4 corner clusters in parallel
      const [coverRes, objectsRes] = await Promise.all([
        fetch('/api/preview-book-skin', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: genPrompt.trim(), cleanCorners: true }),
        }),
        fetch('/api/generate-theme-objects', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coverPrompt: genPrompt.trim(), mode: 'corner_clusters' }),
        }),
      ])
      const coverData = await coverRes.json()
      const objectsData = await objectsRes.json()
      if (!coverRes.ok) throw new Error(coverData.error || `Cover error ${coverRes.status}`)
      setSandbox({
        imageUrl: coverData.image_url,
        prompt: coverData.prompt,
        iteration: 1,
        extractedObjects: objectsData.objects ?? [],
      })
      setRefinePrompt('')
    } catch (err: any) { setGenError(err.message) }
    finally { setGenerating(false) }
  }

  async function handleGenerateThemeObjects() {
    if (!sandbox) return
    setExtracting(true)
    setExtractError(null)
    try {
      const res = await fetch('/api/generate-theme-objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverPrompt: genPrompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setSandbox(prev => prev ? {
        ...prev,
        extractedObjects: data.objects ?? [],
        iteration: prev.iteration + 1,
      } : prev)
    } catch (err: any) {
      setExtractError(err.message)
    } finally {
      setExtracting(false)
    }
  }

  async function handleGenerate() {
    if (!genPrompt.trim()) { setGenError('Enter a description.'); return }
    setGenError(null); setGenerating(true)
    try {
      const res = await fetch('/api/preview-book-skin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: genPrompt.trim(), cleanCorners }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
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
        body: JSON.stringify({ prompt: sandbox.prompt, sourceImageUrl: sandbox.imageUrl, changePrompt: refinePrompt.trim(), cleanCorners }),
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
      setUploadSuccess('✅ Book cover saved!')
      onSaved?.()

      // If sandbox has extracted objects (from preview extraction), save them now
      if (sandbox.extractedObjects && sandbox.extractedObjects.length > 0 && newSkin?.id) {
        setExtracting(true)
        try {
          // Upload extracted objects to permanent paths and insert overlay rows
          for (let i = 0; i < sandbox.extractedObjects.length; i++) {
            const obj = sandbox.extractedObjects[i]
            // Objects are already uploaded to preview paths — just insert the overlay rows
            await supabase.from('book_skin_overlays').insert({
              skin_id: newSkin.id,
              label: obj.label,
              image_url: obj.imageUrl,
              sort_order: i,
              overlay_config: null,
            })
          }
          await supabase.from('book_skins').update({ has_overlays: true }).eq('id', newSkin.id)
          const count = sandbox.extractedObjects.length
          setUploadSuccess(`✅ Book cover saved with ${count} animated overlay${count !== 1 ? 's' : ''}!`)
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
                        className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-xl text-sm transition-colors text-center leading-tight">
                        {generating && cleanCorners ? '⏳ Generating…' : <>✨ Generate Cover<br /><span className="text-[10px] font-normal opacity-90">+ Separate Objects</span></>}
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
                      <div className="rounded-xl overflow-hidden border-2 border-amber-200 shadow-lg" style={{ width: 280, height: 434 }}>
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

                    {/* ── Generate standalone theme objects (only when cleanCorners is on) ── */}
                    {cleanCorners && <>
                    <div className="border border-purple-200 rounded-xl p-3 bg-purple-50/40 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-purple-800">✨ Generate Theme Objects</span>
                        <div className="flex items-center gap-2">
                          {sandbox.extractedObjects && (
                            <button onClick={() => setSandbox(prev => prev ? { ...prev, extractedObjects: undefined } : prev)}
                              className="text-[10px] text-gray-400 hover:text-gray-600">✕ Clear</button>
                          )}
                          <button
                            onClick={handleGenerateThemeObjects}
                            disabled={extracting || generating}
                            className="text-xs px-2.5 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-lg transition-colors">
                            {extracting ? '⏳ Generating…' : sandbox.extractedObjects ? '↺ Regenerate' : '✨ Generate'}
                          </button>
                        </div>
                      </div>
                      {!sandbox.extractedObjects ? (
                        <p className="text-[11px] text-gray-500">
                          Generate standalone 3D objects that match the cover&apos;s theme and art style — purpose-built for animated overlays. Each object is on a transparent background.
                        </p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold text-purple-700">{sandbox.extractedObjects.length} objects generated — transparent PNGs ready for animation</p>
                        </div>
                      )}
                      {extractError && <p className="text-[11px] text-red-600">{extractError}</p>}
                    </div>

                    {/* ── Generated objects preview grid ── */}
                    {sandbox.extractedObjects && sandbox.extractedObjects.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-2 bg-white border border-purple-100 rounded-xl">
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
                    )}
                    </>} {/* end cleanCorners */}

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

                        {/* ── Generated objects summary ── */}
                        <div className="border-t border-amber-100 pt-3">
                          {sandbox.extractedObjects && sandbox.extractedObjects.length > 0 ? (
                            <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 rounded-xl px-3 py-2 border border-purple-200">
                              <span>✨</span>
                              <span><strong>{sandbox.extractedObjects.length}</strong> theme object{sandbox.extractedObjects.length !== 1 ? 's' : ''} will be saved as animated overlays</span>
                              {extracting && <span className="ml-auto animate-spin">⏳</span>}
                            </div>
                          ) : (
                            <p className="text-[11px] text-gray-400">
                              Tip: use &quot;✨ Generate Theme Objects&quot; above to add animated overlay objects.
                            </p>
                          )}
                          {extractError && <p className="text-[11px] text-red-600 mt-1">{extractError}</p>}
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => setGenSaveOpen(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm">Cancel</button>
                          <button onClick={handleGenSave} disabled={genSaving || extracting || !genSaveName.trim()}
                            className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold rounded-xl text-sm">
                            {genSaving ? '⏳ Saving…' : extracting ? '⏳ Extracting…' : '💾 Save'}
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

// ─────────────────────────────────────────────────────────────────────────────
// Overlay Animation Editor — used in the manage modal of this page
// ─────────────────────────────────────────────────────────────────────────────
type OverlayAnim = 'none' | 'float' | 'pulse' | 'rotate' | 'shimmer' | 'bounce'
interface OvConfig { x: number; y: number; scale: number; animation: OverlayAnim }
const DEFAULT_OV: OvConfig = { x: 15, y: 15, scale: 1.0, animation: 'float' }
const OV_KEYFRAMES = `
@keyframes bov-float   { 0%,100%{transform:translateY(0)}    50%{transform:translateY(-8px)} }
@keyframes bov-pulse   { 0%,100%{transform:scale(1)}         50%{transform:scale(1.12)} }
@keyframes bov-rotate  { from{transform:rotate(0deg)}        to{transform:rotate(360deg)} }
@keyframes bov-shimmer { 0%,100%{opacity:1}                  50%{opacity:0.45} }
@keyframes bov-bounce  { 0%,100%{transform:translateY(0)}    40%{transform:translateY(-14px)} 60%{transform:translateY(-6px)} }
`
const OV_CSS: Record<OverlayAnim, string> = {
  none: '', float: 'bov-float 3s ease-in-out infinite', pulse: 'bov-pulse 2.5s ease-in-out infinite',
  rotate: 'bov-rotate 8s linear infinite', shimmer: 'bov-shimmer 2s ease-in-out infinite', bounce: 'bov-bounce 1.8s ease-in-out infinite',
}
const OV_ANIMS: { value: OverlayAnim; label: string }[] = [
  { value: 'none', label: '⏸ None' }, { value: 'float', label: '🌊 Float' }, { value: 'pulse', label: '💗 Pulse' },
  { value: 'rotate', label: '🔄 Rotate' }, { value: 'shimmer', label: '✨ Shimmer' }, { value: 'bounce', label: '🏀 Bounce' },
]

function OverlayEditorInline({
  skin, overlays, loading, saving, onSave, onClose,
}: {
  skin: BookSkin; overlays: any[]; loading: boolean; saving: boolean
  onSave: (overlay: any, config: OvConfig) => void; onClose: () => void
}) {
  const [selected, setSelected] = useState<string | null>(overlays[0]?.id ?? null)
  const [configs, setConfigs] = useState<Record<string, OvConfig>>(() => {
    const init: Record<string, OvConfig> = {}
    for (const o of overlays) init[o.id] = o.overlay_config ?? { ...DEFAULT_OV }
    return init
  })
  const previewRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null)

  const sel = overlays.find(o => o.id === selected)
  const cfg = selected ? (configs[selected] ?? DEFAULT_OV) : null

  function upd(id: string, patch: Partial<OvConfig>) {
    setConfigs(prev => ({ ...prev, [id]: { ...(prev[id] ?? DEFAULT_OV), ...patch } }))
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
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <div className="font-bold text-gray-900">✨ Animate Overlays — {skin.name}</div>
            <div className="text-xs text-gray-400 mt-0.5">Drag objects on the cover preview · pick animation · save</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light">×</button>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16 text-gray-400">Loading overlays…</div>
        ) : overlays.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-16 px-6 text-center text-gray-400 text-sm">
            No overlay objects found. Extract corner objects first using the Generate tab.
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Cover preview */}
            <div className="md:w-60 shrink-0 p-4 flex flex-col items-center gap-2 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200">
              <p className="text-xs font-semibold text-gray-500 self-start">Drag to reposition</p>
              <div ref={previewRef} className="relative rounded-xl overflow-hidden border-2 border-amber-200 shadow" style={{ width: 180, height: 280, userSelect: 'none' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={skin.image_url} alt={skin.name} className="w-full h-full object-cover" draggable={false} />
                {overlays.map(o => {
                  const c = configs[o.id] ?? DEFAULT_OV
                  const sz = Math.round(54 * c.scale)
                  return (
                    <div key={o.id}
                      onMouseDown={e => { e.preventDefault(); startDrag(o.id, e.clientX, e.clientY) }}
                      onTouchStart={e => startDrag(o.id, e.touches[0].clientX, e.touches[0].clientY)}
                      style={{ position: 'absolute', left: `${c.x}%`, top: `${c.y}%`, transform: 'translate(-50%,-50%)', width: sz, height: sz, cursor: 'grab', zIndex: selected === o.id ? 10 : 5, outline: selected === o.id ? '2px solid #a855f7' : undefined, borderRadius: 4 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={o.image_url} alt={o.label} style={{ width: '100%', height: '100%', objectFit: 'contain', animation: c.animation !== 'none' ? OV_CSS[c.animation] : undefined, pointerEvents: 'none' }} draggable={false} />
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Controls */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {overlays.map(o => (
                  <button key={o.id} onClick={() => setSelected(o.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border-2 transition-colors ${selected === o.id ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.image_url} alt={o.label} className="w-5 h-5 object-contain" />{o.label}
                  </button>
                ))}
              </div>
              {sel && cfg && (
                <div className="space-y-3 border border-gray-100 rounded-xl p-3">
                  <p className="text-sm font-bold text-gray-800 capitalize">{sel.label}</p>
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
                    <input type="range" min={0.3} max={2.0} step={0.1} value={cfg.scale} onChange={e => upd(sel.id, { scale: Number(e.target.value) })} className="w-full accent-purple-600" />
                  </div>
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
                  <button disabled={saving} onClick={() => onSave(sel, configs[sel.id] ?? DEFAULT_OV)}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold rounded-xl text-sm">
                    {saving ? '⏳ Saving…' : `💾 Save "${sel.label}"`}
                  </button>
                </div>
              )}
              {overlays.length > 1 && (
                <button disabled={saving} onClick={async () => { for (const o of overlays) await onSave(o, configs[o.id] ?? DEFAULT_OV) }}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold rounded-xl text-sm">
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
