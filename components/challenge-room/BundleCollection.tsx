'use client'

/**
 * The "BookCover / Inner Page Bundle for Challenge Room" collection.
 *
 * Separate from the book-skin pickers because a bundle is a PAIR — the cover
 * wraps the closed book and the inner page backs both open pages — so the
 * preview shows both halves together rather than one image.
 *
 * Admins get the same actions as a book skin (default / public / deactivate /
 * sell / delete) but not Edit Title & Button Layout or Animate Overlay Objects:
 * a bundle has no title zone and no overlay objects, so those would be dead
 * buttons. Non-admins get selection only.
 */

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BookTexturePackage } from '@/lib/types/challengeRoom'

export interface BundleCollectionProps {
  isAdmin: boolean
  /** Currently selected bundle, or null to fall through to the default. */
  selectedId: string | null
  onSelect: (id: string | null) => void
  /**
   * A bundle is only meaningful with a room — the DB enforces it via
   * ubsp_package_requires_room. When false, selection is disabled and explained
   * rather than left to fail on save.
   */
  hasRoom: boolean
}

export function BundleCollection({ isAdmin, selectedId, onSelect, hasRoom }: BundleCollectionProps) {
  const supabase = createClient()

  const [bundles, setBundles] = useState<BookTexturePackage[]>([])
  const [loading, setLoading] = useState(true)
  const [manage, setManage] = useState<BookTexturePackage | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sellPrice, setSellPrice] = useState('')
  const [showSell, setShowSell] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('book_texture_packages')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
    setBundles((data ?? []) as BookTexturePackage[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const defaultBundle = bundles.find(b => b.is_default) ?? null
  const effectiveId = selectedId ?? defaultBundle?.id ?? null

  async function action(
    bundle: BookTexturePackage,
    kind: 'set_default' | 'make_public' | 'make_private' | 'toggle_active' | 'delete' | 'sell',
  ) {
    setWorking(true)
    setError(null)
    try {
      if (kind === 'set_default') {
        // Clear the old default first — a partial unique index enforces one.
        await supabase.from('book_texture_packages').update({ is_default: false }).eq('is_default', true)
        await supabase.from('book_texture_packages').update({ is_default: true }).eq('id', bundle.id)
      } else if (kind === 'make_public') {
        await supabase.from('book_texture_packages').update({ visibility: 'public' }).eq('id', bundle.id)
      } else if (kind === 'make_private') {
        await supabase.from('book_texture_packages').update({ visibility: 'admin_only' }).eq('id', bundle.id)
      } else if (kind === 'toggle_active') {
        await supabase.from('book_texture_packages').update({ is_active: !bundle.is_active }).eq('id', bundle.id)
      } else if (kind === 'delete') {
        if (!confirm(`Delete "${bundle.name}"? Students using it will fall back to the default bundle.`)) {
          setWorking(false)
          return
        }
        await supabase.from('book_texture_packages').delete().eq('id', bundle.id)
        setManage(null)
      } else if (kind === 'sell') {
        const cost = parseInt(sellPrice, 10)
        if (!Number.isFinite(cost) || cost < 1) {
          setError('Enter a price of at least 1 point.')
          setWorking(false)
          return
        }
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('Session expired.'); setWorking(false); return }
        const { data: item, error: itemErr } = await supabase
          .from('shop_items')
          .insert({
            title: bundle.name,
            description: bundle.description || 'Challenge room book bundle',
            cost,
            image_url: bundle.cover_url,
            is_active: true,
            created_by: user.id,
          })
          .select('id')
          .single()
        if (itemErr || !item) { setError('Could not create the shop item.'); setWorking(false); return }
        await supabase.from('book_texture_packages').update({ shop_item_id: item.id }).eq('id', bundle.id)
        setShowSell(false)
        setSellPrice('')
      }
      await load()
      setManage(current => (current ? bundles.find(b => b.id === current.id) ?? null : null))
    } catch (err: any) {
      setError(err.message || 'Action failed.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-gray-900">📚 Book Cover / Inner Page Bundle</h2>
        <p className="text-sm text-gray-500">
          Wraps the 3D book in the Challenge Room. The cover shows when the book is closed,
          the inner page backs both open pages.
        </p>
      </div>

      {!hasRoom && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A bundle only applies inside a Challenge Room. Choose a room first and these become selectable.
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-400">Loading bundles…</div>
      ) : bundles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          No bundles yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map(bundle => {
            const selected = effectiveId === bundle.id
            return (
              <div
                key={bundle.id}
                className={`relative overflow-hidden rounded-2xl border-2 bg-white transition-all ${
                  selected ? 'border-primary-500 shadow-md' : 'border-gray-100 hover:border-gray-300'
                } ${!bundle.is_active ? 'opacity-60' : ''}`}
              >
                <button
                  type="button"
                  disabled={!hasRoom || !bundle.is_active}
                  onClick={() => onSelect(bundle.id)}
                  className="block w-full text-left disabled:cursor-not-allowed"
                >
                  {/* Both halves together — a bundle is the pair, so previewing
                      one would not tell you what you are choosing. */}
                  <div className="grid grid-cols-2 gap-px bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bundle.cover_url} alt={`${bundle.name} cover`} className="aspect-[3/4] w-full object-cover" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bundle.inner_url} alt={`${bundle.name} inner page`} className="aspect-[3/4] w-full object-cover" />
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="truncate text-sm font-semibold text-gray-900">{bundle.name}</span>
                    {selected && <span className="shrink-0 text-xs font-bold text-primary-600">✓ Active</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 px-3 pb-3 text-[10px]">
                    {bundle.is_default && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">⭐ Default</span>}
                    {bundle.visibility === 'public'
                      ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">👥 Public</span>
                      : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">🔒 Admin only</span>}
                    {!bundle.is_active && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-600">❌ Inactive</span>}
                    {bundle.shop_item_id && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-700">🛍️ In shop</span>}
                  </div>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => { setManage(bundle); setError(null); setShowSell(false); setSellPrice('') }}
                    aria-label={`Manage ${bundle.name}`}
                    className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-sm shadow-sm backdrop-blur-sm hover:bg-white"
                  >
                    ⚙️
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Admin actions ───────────────────────────────────────────── */}
      {manage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setManage(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
              <div>
                <div className="font-bold text-gray-900">⚙️ {manage.name}</div>
                <div className="text-xs text-gray-500">
                  📚 Bundle · {manage.visibility === 'public' ? '👥 Public' : '🔒 Admin only'}
                  {manage.is_default ? ' · ⭐ Default' : ''}
                  {!manage.is_active ? ' · ❌ Inactive' : ''}
                  {manage.shop_item_id ? ' · 🛍️ In shop' : ''}
                </div>
              </div>
              <button onClick={() => setManage(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-px bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={manage.cover_url} alt="cover" className="aspect-[3/4] w-full object-cover" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={manage.inner_url} alt="inner page" className="aspect-[3/4] w-full object-cover" />
            </div>

            <div className="space-y-2 p-4">
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => action(manage, 'set_default')}
                  disabled={working || manage.is_default}
                  className="rounded-xl border-2 border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 disabled:opacity-50"
                >
                  {manage.is_default ? '⭐ Is Default' : 'Set default'}
                </button>

                {manage.visibility === 'public' ? (
                  <button onClick={() => action(manage, 'make_private')} disabled={working}
                    className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">
                    Make private
                  </button>
                ) : (
                  <button onClick={() => action(manage, 'make_public')} disabled={working}
                    className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">
                    👥 Make public
                  </button>
                )}

                <button onClick={() => action(manage, 'toggle_active')} disabled={working}
                  className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">
                  {manage.is_active ? 'Deactivate' : 'Activate'}
                </button>

                {manage.shop_item_id ? (
                  <button disabled className="rounded-xl border-2 border-purple-200 px-3 py-2 text-sm font-medium text-purple-700 opacity-70">
                    🛍️ In shop ✓
                  </button>
                ) : (
                  <button onClick={() => setShowSell(true)} disabled={working}
                    className="rounded-xl border-2 border-purple-200 px-3 py-2 text-sm font-medium text-purple-700 disabled:opacity-50">
                    🛍️ Sell in shop
                  </button>
                )}
              </div>

              {showSell && (
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    value={sellPrice}
                    onChange={e => setSellPrice(e.target.value)}
                    placeholder="Price in points"
                    className="flex-1 rounded-xl border-2 border-gray-200 px-3 py-2 text-sm"
                  />
                  <button onClick={() => action(manage, 'sell')} disabled={working}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    List
                  </button>
                </div>
              )}

              <button onClick={() => action(manage, 'delete')} disabled={working}
                className="w-full rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-50">
                🗑 Delete
              </button>

              {/* Deliberately absent: Edit Title & Button Layout and Animate
                  Overlay Objects. A bundle is a full-bleed UV texture with no
                  title zone and no overlay objects, so both would do nothing. */}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
