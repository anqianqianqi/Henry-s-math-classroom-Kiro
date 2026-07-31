'use client'

/**
 * The "Challenge Room" collection.
 *
 * Sibling of BundleCollection: the room is the scene, the bundle is the book's
 * art. A room is required before a bundle can be selected — the database
 * enforces it via ubsp_package_requires_room — so clearing the room here also
 * clears the bundle, otherwise the save would be rejected.
 */

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChallengeRoom } from '@/lib/types/challengeRoom'

export interface RoomCollectionProps {
  isAdmin: boolean
  selectedId: string | null
  /** Null clears the room; the caller must clear the bundle with it. */
  onSelect: (id: string | null) => void
}

export function RoomCollection({ isAdmin, selectedId, onSelect }: RoomCollectionProps) {
  const supabase = createClient()

  const [rooms, setRooms] = useState<ChallengeRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [manage, setManage] = useState<ChallengeRoom | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sellPrice, setSellPrice] = useState('')
  const [showSell, setShowSell] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('challenge_rooms')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
    setRooms((data ?? []) as ChallengeRoom[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const defaultRoom = rooms.find(r => r.is_default) ?? null
  const effectiveId = selectedId ?? defaultRoom?.id ?? null

  async function action(
    room: ChallengeRoom,
    kind: 'set_default' | 'make_public' | 'make_private' | 'toggle_active' | 'delete' | 'sell',
  ) {
    setWorking(true)
    setError(null)
    try {
      if (kind === 'set_default') {
        await supabase.from('challenge_rooms').update({ is_default: false }).eq('is_default', true)
        await supabase.from('challenge_rooms').update({ is_default: true }).eq('id', room.id)
      } else if (kind === 'make_public') {
        await supabase.from('challenge_rooms').update({ visibility: 'public' }).eq('id', room.id)
      } else if (kind === 'make_private') {
        await supabase.from('challenge_rooms').update({ visibility: 'admin_only' }).eq('id', room.id)
      } else if (kind === 'toggle_active') {
        await supabase.from('challenge_rooms').update({ is_active: !room.is_active }).eq('id', room.id)
      } else if (kind === 'delete') {
        if (!confirm(`Delete "${room.name}"? Students using it fall back to the flat book.`)) {
          setWorking(false)
          return
        }
        await supabase.from('challenge_rooms').delete().eq('id', room.id)
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
            title: room.name,
            description: room.description || 'Challenge room',
            cost,
            image_url: room.room_url,
            is_active: true,
            created_by: user.id,
          })
          .select('id')
          .single()
        if (itemErr || !item) { setError('Could not create the shop item.'); setWorking(false); return }
        await supabase.from('challenge_rooms').update({ shop_item_id: item.id }).eq('id', room.id)
        setShowSell(false)
        setSellPrice('')
      }
      await load()
      setManage(null)
    } catch (err: any) {
      setError(err.message || 'Action failed.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">🏛️ Challenge Room</h2>
          <p className="text-sm text-gray-500">
            Replaces the flat book with a 3D room and an animated book. Desktop only,
            and only on challenges imported from a .henryproblem file.
          </p>
        </div>
        {effectiveId && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:border-gray-300"
          >
            Use the flat book instead
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-400">Loading rooms…</div>
      ) : rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          No rooms yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map(room => {
            const selected = effectiveId === room.id
            return (
              <div
                key={room.id}
                className={`relative overflow-hidden rounded-2xl border-2 bg-white transition-all ${
                  selected ? 'border-primary-500 shadow-md' : 'border-gray-100 hover:border-gray-300'
                } ${!room.is_active ? 'opacity-60' : ''}`}
              >
                <button
                  type="button"
                  disabled={!room.is_active}
                  onClick={() => onSelect(room.id)}
                  className="block w-full text-left disabled:cursor-not-allowed"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={room.room_url} alt={room.name} className="aspect-[3/2] w-full object-cover" />
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="truncate text-sm font-semibold text-gray-900">{room.name}</span>
                    {selected && <span className="shrink-0 text-xs font-bold text-primary-600">✓ Active</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 px-3 pb-3 text-[10px]">
                    {room.is_default && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">⭐ Default</span>}
                    {room.visibility === 'public'
                      ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">👥 Public</span>
                      : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">🔒 Admin only</span>}
                    {!room.is_active && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-600">❌ Inactive</span>}
                    {room.shop_item_id && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-700">🛍️ In shop</span>}
                  </div>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => { setManage(room); setError(null); setShowSell(false); setSellPrice('') }}
                    aria-label={`Manage ${room.name}`}
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

      {manage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setManage(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
              <div>
                <div className="font-bold text-gray-900">⚙️ {manage.name}</div>
                <div className="text-xs text-gray-500">
                  🏛️ Room · {manage.visibility === 'public' ? '👥 Public' : '🔒 Admin only'}
                  {manage.is_default ? ' · ⭐ Default' : ''}
                  {!manage.is_active ? ' · ❌ Inactive' : ''}
                  {manage.shop_item_id ? ' · 🛍️ In shop' : ''}
                </div>
              </div>
              <button onClick={() => setManage(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={manage.room_url} alt={manage.name} className="aspect-[3/2] w-full object-cover" />

            <div className="space-y-2 p-4">
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

              {!manage.is_default && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Setting this as default turns the 3D room on for every student who has not
                  chosen one — a launch switch, not just a label.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => action(manage, 'set_default')} disabled={working || manage.is_default}
                  className="rounded-xl border-2 border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 disabled:opacity-50">
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
                  <input type="number" min={1} value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                    placeholder="Price in points"
                    className="flex-1 rounded-xl border-2 border-gray-200 px-3 py-2 text-sm" />
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
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
