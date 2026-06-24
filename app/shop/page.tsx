'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { HomeButton } from '@/components/ui/HomeButton'
import dynamicImport from 'next/dynamic'
import {
  computeSpendableBalance,
  isRedeemDisabled,
  sortRedemptionsByRecent,
} from '@/lib/utils/shop'
import type { ShopItem, Redemption } from '@/lib/types/shop'

const AnimatedRoomLayer = dynamicImport(() => import('@/components/pet-room/AnimatedRoomLayer'), { ssr: false })

// ── ShopCoverZoom — simple reliable zoom preview for book cover skins ─────────
// Image in normal flow sets height; overlays + title absolute on top.
import { buildKeyframesCSS, buildAnimCSS, getTransformOrigin, overlayWidthPct } from '@/lib/overlayAnimations'
import { OverlayBurstRenderer } from '@/components/OverlayBurstRenderer'
const SHOP_ZP_KEYFRAMES = buildKeyframesCSS('szp') + `
@keyframes szp-pulse-glow { 0%,100%{opacity:1} 50%{opacity:0.7} }
`
function ShopCoverZoom({ skin }: { skin: BookSkinItem }) {
  const [overlays, setOverlays] = useState<any[]>([])
  const tl = (skin as any).cover_layout?.title
  const pl = (skin as any).cover_layout?.prompt

  // Inject keyframes into document head (reliable across modal portals)
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('szp-keyframes')) return
    const el = document.createElement('style')
    el.id = 'szp-keyframes'
    el.textContent = SHOP_ZP_KEYFRAMES
    document.head.appendChild(el)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('book_skin_overlays').select('*').eq('skin_id', skin.id)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        console.log('[ShopCoverZoom] overlays for', skin.id, ':', data?.length, error?.message)
        setOverlays(data ?? [])
      })
  }, [skin.id])

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={skin.image_url} alt={skin.name} style={{ display: 'block', width: '100%', height: 'auto' }} draggable={false} />
        {overlays.map(obj => {
          const cfg = obj.overlay_config
          if (!cfg) return null
          const sz = overlayWidthPct(cfg.scale ?? 1.0)
          const anim = cfg.animation && cfg.animation !== 'none' ? buildAnimCSS(cfg.animation, 'szp', cfg.speed ?? 1.0) : undefined
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
            <div
              key={obj.id}
              style={{
                position: 'absolute', left: `${cfg.x}%`, top: `${cfg.y}%`,
                transform: 'translate(-50%,-50%)', width: sz, height: sz,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={obj.image_url} alt={obj.label} draggable={false}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', animation: anim, transformOrigin }} />
            </div>
          )
        })}
        <div className="absolute text-center px-4 w-full" style={{ left: `${tl?.x ?? 50}%`, top: `${tl?.y ?? 22}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
          <h2 className="font-bold leading-snug" style={{ fontSize: tl?.fontSize ?? 20, color: tl?.color ?? '#2d1a00', fontFamily: '"Georgia","Times New Roman",serif', textShadow: (tl?.shadow ?? true) ? '0 1px 8px rgba(255,255,255,0.6),0 0 16px rgba(0,0,0,0.4)' : undefined, letterSpacing: '0.04em' }}>
            Challenge Title Preview
          </h2>
        </div>
        <div className="absolute flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap"
          style={{ left: `${pl?.x ?? 50}%`, top: `${pl?.y ?? 82}%`, transform: 'translate(-50%,-50%)',
            fontSize: pl?.fontSize ?? 14, color: pl?.color ?? 'rgba(240,215,140,0.97)',
            textShadow: '0 1px 4px rgba(0,0,0,0.8)', background: 'rgba(40,25,5,0.72)', border: '1px solid rgba(200,160,60,0.55)',
            backdropFilter: 'blur(6px)', pointerEvents: 'none' }}>
          <span>📜</span><span style={{ letterSpacing: '0.06em' }}>Open the Book</span>
        </div>
    </div>
  )
}

interface ShopItemWithCount extends ShopItem {
  redemption_count: number
  blindbox_remaining?: number
}

interface RedemptionWithTitle extends Redemption {
  item_title: string
  item_commodity_type?: string
  blindbox_image_url?: string | null
  blindbox_image_urls?: string[]
  refunded_at?: string | null
}

interface PetRoomBg {
  id: string
  name: string
  description: string | null
  image_url: string
  animation_zones: any[]
  shop_item_id: string
  shopItem?: ShopItemWithCount
}

interface BookSkinItem {
  id: string
  name: string
  description: string | null
  image_url: string
  skin_type: 'cover' | 'page'
  shop_item_id: string
  shopItem?: ShopItemWithCount
}

// ── Book Cover Browse Modal ───────────────────────────────────────────────────
function BookCoverBrowseModal({
  skins,
  ownedItemIds,
  balance,
  redeeming,
  redeemErrors,
  onRedeem,
  onClose,
}: {
  skins: BookSkinItem[]
  ownedItemIds: Set<string>
  balance: number
  redeeming: string | null
  redeemErrors: Record<string, string>
  onRedeem: (item: any) => void
  onClose: () => void
}) {
  const [previewSkin, setPreviewSkin] = useState<BookSkinItem | null>(null)

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div>
              <div className="font-bold text-gray-900 text-lg">📖 Book Covers</div>
              <div className="text-xs text-gray-400 mt-0.5">Click an image to zoom preview · Buy to unlock</div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light">×</button>
          </div>
          <div className="overflow-y-auto p-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {skins.map(skin => {
                const si = skin.shopItem
                if (!si) return null
                const isOwned = ownedItemIds.has(si.id)
                const canAfford = balance >= si.cost
                return (
                  <div key={skin.id} className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100 hover:border-amber-300 transition-colors flex flex-col">
                    {/* Portrait thumbnail — click to open full live preview */}
                    <div className="relative group cursor-pointer" style={{ aspectRatio: '400/620' }}
                      onClick={() => setPreviewSkin(skin)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={skin.image_url} alt={skin.name}
                        className="absolute inset-0 w-full h-full object-contain" />
                      <div className="absolute inset-0 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">🔍 Preview</span>
                      </div>
                      {isOwned && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <span className="bg-green-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">✓ Owned</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2 flex flex-col flex-1">
                      <p className="font-semibold text-gray-900 text-xs truncate">{skin.name}</p>
                      <div className="flex items-center justify-between gap-1 mt-1">
                        <span className="text-primary-600 font-bold text-xs">{si.cost}<span className="text-gray-400 font-normal ml-0.5">pts</span></span>
                        <button
                          disabled={isOwned || !canAfford || redeeming === si.id}
                          onClick={() => onRedeem(si)}
                          className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                            isOwned || !canAfford || redeeming === si.id
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-amber-600 text-white hover:bg-amber-700'
                          }`}
                        >
                          {redeeming === si.id ? '…' : isOwned ? '✓' : !canAfford ? '×' : 'Buy'}
                        </button>
                      </div>
                      {redeemErrors[si.id] && <p className="text-red-500 text-[10px] mt-0.5">{redeemErrors[si.id]}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen zoom preview — full live preview with title + animations */}
      {previewSkin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={() => setPreviewSkin(null)}>
          <div className="relative flex flex-col items-center gap-3" style={{ maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <ShopCoverZoom skin={previewSkin} />
            <button onClick={() => setPreviewSkin(null)}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white text-sm font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
              ✕
            </button>
            <div className="flex items-center justify-between w-full px-1">
              <span className="text-white text-sm font-semibold drop-shadow">{previewSkin.name} — {previewSkin.shopItem?.cost} pts</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Animated Room Preview Modal ───────────────────────────────────────────────
function RoomPreviewModal({ bg, onClose }: { bg: PetRoomBg; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bg.image_url} alt={bg.name} className="w-full block" draggable={false} />
        {bg.animation_zones?.length > 0 && (
          <AnimatedRoomLayer imageUrl={bg.image_url} zones={bg.animation_zones} />
        )}
        <button onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white text-sm font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
          ✕ Close
        </button>
        <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl text-sm font-semibold">
          {bg.name}
        </div>
      </div>
    </div>
  )
}

// ── Room Browse Modal ─────────────────────────────────────────────────────────
// Single entry point: browse all available rooms, click image to preview animated,
// click Buy to purchase that specific room.
function RoomBrowseModal({
  rooms,
  ownedItemIds,
  balance,
  redeeming,
  redeemErrors,
  onRedeem,
  onClose,
}: {
  rooms: PetRoomBg[]
  ownedItemIds: Set<string>
  balance: number
  redeeming: string | null
  redeemErrors: Record<string, string>
  onRedeem: (item: any) => void
  onClose: () => void
}) {
  const [previewBg, setPreviewBg] = useState<PetRoomBg | null>(null)

  return (
    <>
      {/* Browse modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div>
              <div className="font-bold text-gray-900 text-lg">🏠 Room Backgrounds</div>
              <div className="text-xs text-gray-400 mt-0.5">Click an image to preview with animations · Buy to unlock</div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light">×</button>
          </div>
          <div className="overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-4">
              {rooms.map(bg => {
                const si = bg.shopItem
                if (!si) return null
                const isOwned = ownedItemIds.has(si.id)
                const canAfford = balance >= si.cost
                return (
                  <div key={bg.id} className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100 hover:border-primary-300 transition-colors">
                    {/* Image — click to animate preview */}
                    <div className="relative w-full aspect-video group overflow-hidden cursor-pointer"
                      onClick={() => setPreviewBg(bg)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={bg.image_url} alt={bg.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                        <span className="bg-black/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full">🔍 Preview</span>
                      </div>
                      {isOwned && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <span className="bg-green-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">✓ Owned</span>
                        </div>
                      )}
                      {bg.animation_zones?.length > 0 && (
                        <div className="absolute top-1.5 left-1.5 bg-black/50 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">✨</div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-gray-900 text-sm truncate">{bg.name}</p>
                      {bg.description && <p className="text-gray-400 text-xs line-clamp-1 mb-2">{bg.description}</p>}
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-primary-600 font-bold">{si.cost}<span className="text-gray-400 font-normal text-xs ml-0.5">pts</span></span>
                        <button
                          disabled={isOwned || !canAfford || redeeming === si.id}
                          onClick={() => onRedeem(si)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                            isOwned || !canAfford || redeeming === si.id
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-primary-600 text-white hover:bg-primary-700'
                          }`}
                        >
                          {redeeming === si.id ? '…' : isOwned ? '✓ Owned' : !canAfford ? 'Too costly' : 'Buy'}
                        </button>
                      </div>
                      {redeemErrors[si.id] && <p className="text-red-500 text-xs mt-1">{redeemErrors[si.id]}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Animated full-screen preview — on top of the browse modal */}
      {previewBg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={() => setPreviewBg(null)}>
          <div className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewBg.image_url} alt={previewBg.name} className="w-full block" draggable={false} />
            {previewBg.animation_zones?.length > 0 && (
              <AnimatedRoomLayer imageUrl={previewBg.image_url} zones={previewBg.animation_zones} />
            )}
            <button onClick={() => setPreviewBg(null)}
              className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white text-sm font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
              ✕ Close preview
            </button>
            <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl text-sm font-semibold">
              {previewBg.name}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Blind Box Reveal Modal ────────────────────────────────────────────────────
function BlindBoxReveal({
  imageUrls,
  itemTitle,
  onClose,
  isPhysical = false,
}: {
  imageUrls: string[]
  itemTitle: string
  onClose: () => void
  isPhysical?: boolean
}) {
  const [phase, setPhase] = useState<'shake' | 'open' | 'reveal'>('shake')
  const multiple = imageUrls.length > 1

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('open'), 800)
    const t2 = setTimeout(() => setPhase('reveal'), 1600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center">
        <p className="text-sm font-semibold text-primary-500 uppercase tracking-widest mb-4">
          🎁 {itemTitle}
        </p>

        {/* Box animation — shown while not yet revealed */}
        {phase !== 'reveal' && (
          <div className="relative mx-auto mb-6" style={{ width: 200, height: 200 }}>
            <div
              className="absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-accent-blue shadow-lg"
              style={{
                animation: phase === 'shake'
                  ? 'wiggle 0.15s ease-in-out 4'
                  : 'scaleUp 0.4s ease-out forwards',
              }}
            >
              <span className="text-7xl select-none">🎁</span>
            </div>
          </div>
        )}

        {phase === 'reveal' ? (
          <>
            <p className="text-xl font-bold text-gray-900 mb-1">
              {multiple ? `${imageUrls.length} prizes unlocked! 🎉` : 'You got it! 🎉'}
            </p>
            {isPhysical ? (
              <>
                <p className="text-sm text-gray-500 mb-3">Here&apos;s a preview of your physical prize{multiple ? 's' : ''}!</p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-left">
                  <p className="text-amber-800 text-sm font-semibold mb-1">📬 How to pick up your item</p>
                  <p className="text-amber-700 text-xs leading-relaxed">
                    This is a physical item — please <strong>ping Henry</strong> to arrange pickup or delivery!
                  </p>
                </div>
              </>
            ) : (
              <span />
            )}

            {/* Modern image gallery */}
            <div className={`grid gap-2 mb-5 ${imageUrls.length === 1 ? 'grid-cols-1' : imageUrls.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {imageUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="group relative block aspect-square rounded-2xl overflow-hidden shadow-md ring-1 ring-black/5 hover:ring-2 hover:ring-primary-400 transition-all">
                  <img src={url} alt={`Prize ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </a>
              ))}
            </div>

            <div className="flex gap-2">
              {!isPhysical && (
                <a
                  href={imageUrls[0]}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    imageUrls.slice(1).forEach((url, i) => {
                      setTimeout(() => {
                        const a = document.createElement('a')
                        a.href = url; a.download = ''; a.target = '_blank'
                        document.body.appendChild(a); a.click(); document.body.removeChild(a)
                      }, (i + 1) * 300)
                    })
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-semibold py-3 rounded-2xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-sm"
                >
                  ↓ {multiple ? `Download All (${imageUrls.length})` : 'Download'}
                </a>
              )}
              <button
                onClick={onClose}
                className="flex-1 bg-gray-100 text-gray-600 text-sm font-semibold py-3 rounded-2xl hover:bg-gray-200 transition-colors"
              >
                {isPhysical ? 'Got it!' : 'Close'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-gray-500 text-sm animate-pulse">
            {phase === 'shake' ? 'Shaking the box…' : 'Opening…'}
          </p>
        )}
      </div>

      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-8deg) scale(1.05); }
          75% { transform: rotate(8deg) scale(1.05); }
        }
        @keyframes scaleUp {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

// ── Blind Box View Modal (revisit already-claimed prize) ─────────────────────
function BlindBoxView({
  imageUrls,
  itemTitle,
  onClose,
  isPhysical = false,
}: {
  imageUrls: string[]
  itemTitle: string
  onClose: () => void
  isPhysical?: boolean
}) {
  const multiple = imageUrls.length > 1
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center">
        <p className="text-xs font-semibold text-primary-500 uppercase tracking-widest mb-1">
          {isPhysical ? '📦' : '🎁'} {itemTitle}
        </p>
        <p className="text-lg font-bold text-gray-900 mb-1">
          {multiple ? `Your ${imageUrls.length} prizes` : 'Your prize'}
        </p>

        {/* Modern image gallery */}
        <div className={`grid gap-2 mb-5 ${imageUrls.length === 1 ? 'grid-cols-1' : imageUrls.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {imageUrls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              className="group relative block aspect-square rounded-2xl overflow-hidden shadow-md ring-1 ring-black/5 hover:ring-2 hover:ring-primary-400 transition-all">
              <img src={url} alt={`Prize ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            </a>
          ))}
        </div>

        {isPhysical && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-left">
            <p className="text-amber-800 text-sm font-semibold mb-1">📬 Physical item</p>
            <p className="text-amber-700 text-xs leading-relaxed">
              Please <strong>ping Henry</strong> to arrange pickup or delivery!
            </p>
          </div>
        )}

        <div className="flex gap-2">
          {!isPhysical && (
            <a
              href={imageUrls[0]}
              download
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                imageUrls.slice(1).forEach((url, i) => {
                  setTimeout(() => {
                    const a = document.createElement('a')
                    a.href = url; a.download = ''; a.target = '_blank'
                    document.body.appendChild(a); a.click(); document.body.removeChild(a)
                  }, (i + 1) * 300)
                })
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-semibold py-3 rounded-2xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-sm"
            >
              ↓ {multiple ? `Download All (${imageUrls.length})` : 'Download'}
            </a>
          )}
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-600 text-sm font-semibold py-3 rounded-2xl hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}


function PhysicalConfirm({ itemTitle, onClose }: { itemTitle: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center">
        <div className="text-6xl mb-4">📦</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Redeemed!</h3>
        <p className="text-gray-600 text-sm mb-3">
          You&apos;ve successfully redeemed <strong>{itemTitle}</strong>.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-left">
          <p className="text-amber-800 text-sm font-semibold mb-1">📬 How to pick up your item</p>
          <p className="text-amber-700 text-xs leading-relaxed">
            This is a physical item — there&apos;s nothing to download. Please <strong>ping Henry</strong> to arrange pickup or delivery of your prize!
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full bg-primary-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-700 transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  )
}

// ── Food queued confirmation ──────────────────────────────────────────────────
function FoodConfirm({ itemTitle, onClose }: { itemTitle: string; onClose: () => void }) {
  // Extract the leading emoji from the item title for the modal icon
  const emojiMatch = itemTitle.match(/^\p{Emoji}/u)
  const icon = emojiMatch ? emojiMatch[0] : '🍖'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Added to food queue!</h3>
        <p className="text-gray-600 text-sm mb-6">
          <strong>{itemTitle}</strong> is waiting for your pet. Head to your pet page to feed it and earn XP!
        </p>
        <button
          onClick={onClose}
          className="w-full bg-orange-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-orange-600 transition-colors"
        >
          Got it! 🐾
        </button>
      </div>
    </div>
  )
}

// ── Collapsible Details ───────────────────────────────────────────────────────
function ItemDetails({ details }: { details: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 w-full text-left"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        Details
      </button>
      {open && (
        <p className="mt-1.5 text-xs text-gray-600 leading-relaxed whitespace-pre-line">
          {details}
        </p>
      )}
    </div>
  )
}

// ── Category badge ────────────────────────────────────────────────────────────
function CategoryBadge({ category }: { category: string }) {
  if (category === 'food') return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-orange-100 text-amber-700 px-1.5 py-0.5 rounded-full">
      🍖 Food
    </span>
  )
  if (category === 'accessory') return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
      🎩 Accessory
    </span>
  )
  if (category === 'pet') return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
      🐾 New Pet
    </span>
  )
  return null
}

// ── Commodity type badge ──────────────────────────────────────────────────────
function CommodityBadge({ type }: { type: string }) {
  if (type === 'blindbox') return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
      🎁 Blind Box
    </span>
  )
  if (type === 'physical') return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
      📦 Physical
    </span>
  )
  if (type === 'physical_blindbox') return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-gradient-to-r from-purple-100 to-amber-100 text-purple-700 px-1.5 py-0.5 rounded-full">
      🎁📦 Physical Blind Box
    </span>
  )
  return null
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ShopPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [items, setItems] = useState<ShopItemWithCount[]>([])
  const [redemptions, setRedemptions] = useState<RedemptionWithTitle[]>([])
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [redeemErrors, setRedeemErrors] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'all' | 'rewards'>('rewards')
  // Set of shop_item IDs the user already owns (book skins + pet rooms) — disables re-purchase
  const [ownedItemIds, setOwnedItemIds] = useState<Set<string>>(new Set())

  // Room backgrounds cluster
  const [roomBgs, setRoomBgs] = useState<PetRoomBg[]>([])
  const [showRoomBrowse, setShowRoomBrowse] = useState(false)

  // Book covers cluster
  const [bookSkins, setBookSkins] = useState<BookSkinItem[]>([])
  const [showBookBrowse, setShowBookBrowse] = useState(false)

  // Modals
  const [blindboxReveal, setBlindboxReveal] = useState<{ imageUrls: string[]; itemTitle: string; isPhysical?: boolean } | null>(null)
  const [blindboxView, setBlindboxView] = useState<{ imageUrls: string[]; itemTitle: string; isPhysical?: boolean } | null>(null)
  const [physicalConfirm, setPhysicalConfirm] = useState<{ itemTitle: string } | null>(null)
  const [foodConfirm, setFoodConfirm] = useState<{ itemTitle: string } | null>(null)

  const loadData = useCallback(async (userId: string) => {
    // Balance: read directly from student_wallets — the RPC keeps it in sync on every purchase
    let newBalance = 0
    const { data: walletData } = await supabase
      .from('student_wallets')
      .select('spendable_balance')
      .eq('user_id', userId)
      .single()
    newBalance = walletData?.spendable_balance ?? 0
    setBalance(newBalance)

    // Shop items — show all active items (food/accessory/pet shown to students too now)
    const { data: shopItems, error: itemsError } = await supabase
      .from('shop_items')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (itemsError) { setError('Failed to load shop items'); return }

    // Fetch pet room backgrounds available in the shop
    try {
      const { data: bgRows } = await supabase
        .from('pet_room_backgrounds')
        .select('id, name, description, image_url, animation_zones, shop_item_id')
        .eq('is_active', true)
        .not('shop_item_id', 'is', null)
        .order('created_at', { ascending: false })

      if (bgRows && shopItems) {
        const shopItemMap: Record<string, any> = {}
        for (const si of shopItems) shopItemMap[si.id] = si
        const bgs: PetRoomBg[] = bgRows
          .filter(bg => shopItemMap[bg.shop_item_id!])
          .map(bg => ({ ...bg, animation_zones: bg.animation_zones ?? [], shopItem: shopItemMap[bg.shop_item_id!] }))
        setRoomBgs(bgs)
      }
    } catch (_) {}

    // Fetch book skins available in the shop
    try {
      const { data: skinRows } = await supabase
        .from('book_skins')
        .select('id, name, description, image_url, skin_type, shop_item_id, cover_layout, has_overlays')
        .eq('is_active', true)
        .eq('skin_type', 'cover')
        .not('shop_item_id', 'is', null)
        .order('created_at', { ascending: false })

      if (skinRows && shopItems) {
        const shopItemMap: Record<string, any> = {}
        for (const si of shopItems) shopItemMap[si.id] = si
        const skins: BookSkinItem[] = skinRows
          .filter((s: any) => shopItemMap[s.shop_item_id!])
          .map((s: any) => ({ ...s, shopItem: shopItemMap[s.shop_item_id!] }))
        setBookSkins(skins)
      }
    } catch (_) {}

    // Redemption counts
    const { data: redemptionCounts } = await supabase.from('redemptions').select('item_id')
    const countMap: Record<string, number> = {}
    for (const r of redemptionCounts ?? []) {
      countMap[r.item_id] = (countMap[r.item_id] ?? 0) + 1
    }

    // Blind box remaining counts — use the RPC which handles both set-based and legacy modes
    const allBlindboxIds = (shopItems ?? [])
      .filter((i: any) => i.commodity_type === 'blindbox' || i.commodity_type === 'physical_blindbox')
      .map((i: any) => i.id)

    const remainingMap: Record<string, number> = {}

    // Digital blindbox: per-student remaining = total sets - student's own active (non-refunded) draws
    // Use redemptions.set_id as the source of truth (requires add-set-id-to-redemptions.sql migration).
    // Falls back to blindbox_claims if set_id column doesn't exist yet.
    const digitalBlindboxIds = (shopItems ?? [])
      .filter((i: any) => i.commodity_type === 'blindbox')
      .map((i: any) => i.id)

    if (digitalBlindboxIds.length > 0) {
      const { data: sets } = await supabase
        .from('blindbox_sets')
        .select('item_id')
        .in('item_id', digitalBlindboxIds)

      // Count total sets per item
      const totalSetsMap: Record<string, number> = {}
      for (const s of sets ?? []) {
        totalSetsMap[s.item_id] = (totalSetsMap[s.item_id] ?? 0) + 1
      }

      // Count active (non-refunded) draws from redemptions where set_id IS NOT NULL
      // This is the single source of truth — matches exactly what the student's history shows.
      const { data: myRedemptions, error: redemptionsErr } = await supabase
        .from('redemptions')
        .select('item_id, set_id, refunded_at')
        .eq('user_id', userId)
        .in('item_id', digitalBlindboxIds)
        .filter('set_id', 'not.is', null)

      const myClaimedMap: Record<string, number> = {}

      if (!redemptionsErr && myRedemptions) {
        // Use redemptions: count only non-refunded rows
        for (const r of myRedemptions) {
          if (!r.refunded_at) {
            myClaimedMap[r.item_id] = (myClaimedMap[r.item_id] ?? 0) + 1
          }
        }
      } else {
        // Fallback: set_id column not yet added — count blindbox_claims instead
        const { data: myClaims } = await supabase
          .from('blindbox_claims')
          .select('item_id')
          .eq('student_id', userId)
          .in('item_id', digitalBlindboxIds)
          .filter('set_id', 'not.is', null)

        for (const r of myClaims ?? []) {
          myClaimedMap[r.item_id] = (myClaimedMap[r.item_id] ?? 0) + 1
        }
      }

      for (const itemId of digitalBlindboxIds) {
        const totalSets = totalSetsMap[itemId] ?? 0
        const claimed = myClaimedMap[itemId] ?? 0
        remainingMap[itemId] = Math.max(0, totalSets - claimed)
      }
    }

    // Physical blindbox: read inventory directly from blindbox_sets (same as admin)
    const physicalBlindboxIds = (shopItems ?? [])
      .filter((i: any) => i.commodity_type === 'physical_blindbox')
      .map((i: any) => i.id)

    if (physicalBlindboxIds.length > 0) {
      const { data: sets } = await supabase
        .from('blindbox_sets')
        .select('item_id, quantity')
        .in('item_id', physicalBlindboxIds)

      for (const itemId of physicalBlindboxIds) {
        const itemSets = (sets ?? []).filter((s: any) => s.item_id === itemId)
        const total = itemSets.reduce((sum: number, s: any) => sum + (s.quantity ?? 0), 0)
        remainingMap[itemId] = total
      }
    }

    setItems(
      (shopItems ?? []).map((item: ShopItem) => ({
        ...item,
        redemption_count: countMap[item.id] ?? 0,
        // For blindbox items: use remaining from map, default to 999 if not set (shows as available)
        blindbox_remaining: (item.commodity_type === 'blindbox' || item.commodity_type === 'physical_blindbox')
          ? (remainingMap[item.id] ?? 999)
          : undefined,
      }))
    )

    // ── Owned items (book skins + pet rooms) — disable re-purchase in shop ──
    // Build a set of shop_item IDs this user already owns via redemptions.
    // Strategy: check both book_skin_id/pet_room_background_id columns AND
    // direct item_id match against book_skins/pet_room_backgrounds shop_item_id
    // (handles purchases made before the backfill columns were set).
    try {
      const { data: allUserRedemptions } = await supabase
        .from('redemptions')
        .select('item_id, book_skin_id, pet_room_background_id')
        .eq('user_id', userId)
        .is('refunded_at', null)

      const owned = new Set<string>()

      // Method 1: via backfilled columns
      for (const r of allUserRedemptions ?? []) {
        if (r.book_skin_id || r.pet_room_background_id) {
          owned.add(r.item_id)
        }
      }

      // Method 2: check if any redeemed item_id matches a book skin or pet room's shop_item_id
      const redeemedIds = (allUserRedemptions ?? []).map(r => r.item_id)
      if (redeemedIds.length > 0) {
        const [{ data: bySkinShopId }, { data: byRoomShopId }] = await Promise.all([
          supabase.from('book_skins').select('shop_item_id').in('shop_item_id', redeemedIds).not('shop_item_id', 'is', null),
          supabase.from('pet_room_backgrounds').select('shop_item_id').in('shop_item_id', redeemedIds).not('shop_item_id', 'is', null),
        ])
        for (const r of [...(bySkinShopId ?? []), ...(byRoomShopId ?? [])]) {
          if (r.shop_item_id) owned.add(r.shop_item_id)
        }
      }

      setOwnedItemIds(owned)
    } catch (_) {
      // Non-fatal — ownership check failure just shows the buy button normally
    }

    // Redemption history — fetched via server route so item titles resolve
    // even when items have been deactivated (bypasses student RLS on shop_items)
    const redemptionsRes = await fetch('/api/shop/redemptions')
    if (redemptionsRes.ok) {
      const redemptionsData = await redemptionsRes.json()
      setRedemptions(redemptionsData.redemptions ?? [])
    }
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      await loadData(user.id)
      setLoading(false)
    }
    init()
  }, [router, supabase, loadData])

  async function handleRedeem(item: ShopItemWithCount) {
    setRedeeming(item.id)
    setRedeemErrors((prev) => ({ ...prev, [item.id]: '' }))

    try {
      const res = await fetch('/api/shop/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'Item is out of stock' || data.error?.includes('out of stock') || data.error?.includes('out_of_stock')) {
          // Reload so the sold-out overlay appears — no need for a separate error message
          const { data: { user } } = await supabase.auth.getUser()
          if (user) await loadData(user.id)
          // Clear any stale error for this item
          setRedeemErrors((prev) => ({ ...prev, [item.id]: '' }))
        } else {
          const msg =
            data.error === 'Insufficient balance' ? 'Not enough points' :
            data.error === 'You have already redeemed this item' ? 'You already have this item' :
            'Something went wrong, please try again'
          setRedeemErrors((prev) => ({ ...prev, [item.id]: msg }))
        }
      } else {
        // Refresh data
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await loadData(user.id)

        // Store XP gained in sessionStorage so the pet page can show the +N XP animation
        if (typeof data.xp_gained === 'number' && data.xp_gained > 0) {
          sessionStorage.setItem('pet_xp_gained', String(data.xp_gained))
        }

        // Show food purchase confirmation
        if (data.pending === true) {
          setFoodConfirm({ itemTitle: item.title })
          return
        }

        // Show appropriate modal
        if (data.commodity_type === 'blindbox' && (data.image_urls?.length || data.image_url)) {
          const urls: string[] = data.image_urls?.length ? data.image_urls : [data.image_url]
          setBlindboxReveal({ imageUrls: urls, itemTitle: item.title })
        } else if (data.commodity_type === 'physical_blindbox' && (data.image_urls?.length || data.image_url)) {
          const urls: string[] = data.image_urls?.length ? data.image_urls : [data.image_url]
          setBlindboxReveal({ imageUrls: urls, itemTitle: item.title, isPhysical: true })
        } else if (data.commodity_type === 'physical') {
          setPhysicalConfirm({ itemTitle: item.title })
        }
      }
    } catch {
      setRedeemErrors((prev) => ({ ...prev, [item.id]: 'Something went wrong, please try again' }))
    } finally {
      setRedeeming(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🛍️</div>
          <p className="text-gray-600">Loading shop...</p>
        </div>
      </div>
    )
  }

  const sortedRedemptions = sortRedemptionsByRecent(redemptions)

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Modals */}
      {showRoomBrowse && roomBgs.length > 0 && (
        <RoomBrowseModal
          rooms={roomBgs}
          ownedItemIds={ownedItemIds}
          balance={balance}
          redeeming={redeeming}
          redeemErrors={redeemErrors}
          onRedeem={handleRedeem}
          onClose={() => setShowRoomBrowse(false)}
        />
      )}
      {showBookBrowse && bookSkins.length > 0 && (
        <BookCoverBrowseModal
          skins={bookSkins}
          ownedItemIds={ownedItemIds}
          balance={balance}
          redeeming={redeeming}
          redeemErrors={redeemErrors}
          onRedeem={handleRedeem}
          onClose={() => setShowBookBrowse(false)}
        />
      )}
      {blindboxReveal && (
        <BlindBoxReveal
          imageUrls={blindboxReveal.imageUrls}
          itemTitle={blindboxReveal.itemTitle}
          isPhysical={blindboxReveal.isPhysical}
          onClose={() => setBlindboxReveal(null)}
        />
      )}
      {blindboxView && (
        <BlindBoxView
          imageUrls={blindboxView.imageUrls}
          itemTitle={blindboxView.itemTitle}
          isPhysical={blindboxView.isPhysical}
          onClose={() => setBlindboxView(null)}
        />
      )}
      {physicalConfirm && (
        <PhysicalConfirm
          itemTitle={physicalConfirm.itemTitle}
          onClose={() => setPhysicalConfirm(null)}
        />
      )}
      {foodConfirm && (
        <FoodConfirm
          itemTitle={foodConfirm.itemTitle}
          onClose={() => setFoodConfirm(null)}
        />
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center gap-3">
          <HomeButton noSlash />
          <h1 className="text-xl font-bold text-gray-900">Points Shop</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        {/* Balance */}
        <div className="mb-8 bg-gradient-to-br from-primary-500 to-accent-blue rounded-3xl px-6 py-6 text-white shadow-lg">
          <p className="text-white/80 text-sm font-medium uppercase tracking-wide mb-1">Your Spendable Balance</p>
          <p className="text-5xl font-bold">{balance}</p>
          <p className="text-white/70 text-sm mt-1">points available to spend</p>
        </div>

        {/* Items Grid */}
        <h2 className="text-xl font-bold text-gray-900 mb-3">Available Rewards</h2>

        {/* Category tabs — pet categories hidden until pet feature launches on main */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {([
            { key: 'all',     label: '🛍️ All' },
            { key: 'rewards', label: '🎁 Rewards' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                activeTab === key
                  ? key === 'rewards' ? 'border-purple-400 bg-purple-50 text-purple-700'
                  : 'border-primary-400 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="mb-8 text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🛍️</div>
            <p className="text-lg font-medium text-gray-500">No rewards available yet.</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : (() => {
          const roomBgItemIds = new Set(roomBgs.map(bg => bg.shop_item_id))
          const bookSkinItemIds = new Set(bookSkins.map(s => s.shop_item_id))
          const filteredItems = items.filter(item => {
            // Exclude room background and book skin items — they appear in dedicated cluster cards
            if (roomBgItemIds.has(item.id)) return false
            if (bookSkinItemIds.has(item.id)) return false
            if (activeTab === 'all') return true
            // 'rewards' = everything (pet categories already excluded at query level)
            return true
          })
          return filteredItems.length === 0 ? (
            <div className="mb-8 text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">🎁</div>
              <p className="text-sm font-medium text-gray-500">No items in this category yet.</p>
            </div>
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 mb-10">
            {/* ── Room Backgrounds entry card ── */}
            {roomBgs.length > 0 && (
              <div
                className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer flex flex-col"
                onClick={() => setShowRoomBrowse(true)}
              >
                <div className="relative w-full aspect-square bg-gray-50 overflow-hidden">
                  {/* Mosaic of first 4 room thumbnails */}
                  <div className="grid grid-cols-2 w-full h-full">
                    {roomBgs.slice(0, 4).map((bg, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={bg.image_url} alt={bg.name} className="w-full h-full object-cover" />
                    ))}
                    {roomBgs.length < 4 && Array.from({ length: 4 - roomBgs.length }).map((_, i) => (
                      <div key={i} className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200" />
                    ))}
                  </div>
                  <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-sm font-bold">Browse Rooms</span>
                    <span className="text-white/80 text-xs mt-0.5">{roomBgs.length} available</span>
                  </div>
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-primary-700 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
                    🏠 {roomBgs.length} rooms
                  </div>
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Room Backgrounds</h3>
                  <p className="text-gray-500 text-xs line-clamp-2 mb-auto">Unlock a themed room for your pet. Tap to browse all styles.</p>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                    <span className="text-primary-600 font-bold text-sm">
                      from {Math.min(...roomBgs.map(bg => bg.shopItem?.cost ?? 999))}
                      <span className="text-gray-400 font-normal text-xs ml-0.5">pts</span>
                    </span>
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-600 text-white group-hover:bg-primary-700 transition-colors">
                      Browse
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* ── Book Covers entry card ── */}
            {bookSkins.length > 0 && (
              <div
                className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:border-amber-200 transition-all cursor-pointer flex flex-col"
                onClick={() => setShowBookBrowse(true)}
              >
                <div className="relative w-full aspect-square bg-amber-50 overflow-hidden">
                  {/* Mosaic of first 4 book cover thumbnails (portrait ratio scaled to fit) */}
                  <div className="grid grid-cols-2 w-full h-full">
                    {bookSkins.slice(0, 4).map((s, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={s.image_url} alt={s.name} className="w-full h-full object-cover" />
                    ))}
                    {bookSkins.length < 4 && Array.from({ length: 4 - bookSkins.length }).map((_, i) => (
                      <div key={i} className="w-full h-full bg-gradient-to-br from-amber-100 to-amber-200" />
                    ))}
                  </div>
                  <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-sm font-bold">Browse Covers</span>
                    <span className="text-white/80 text-xs mt-0.5">{bookSkins.length} available</span>
                  </div>
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
                    📖 {bookSkins.length} covers
                  </div>
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Book Covers</h3>
                  <p className="text-gray-500 text-xs line-clamp-2 mb-auto">Personalise your challenge book cover. Tap to browse all designs.</p>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                    <span className="text-amber-600 font-bold text-sm">
                      from {Math.min(...bookSkins.map(s => s.shopItem?.cost ?? 999))}
                      <span className="text-gray-400 font-normal text-xs ml-0.5">pts</span>
                    </span>
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white group-hover:bg-amber-700 transition-colors">
                      Browse
                    </span>
                  </div>
                </div>
              </div>
            )}
            {filteredItems.map((item) => {
              const commodityType = item.commodity_type ?? 'standard'
              const isBlindbox = commodityType === 'blindbox' || commodityType === 'physical_blindbox'
              const isPhysical = commodityType === 'physical'
              const isPhysicalBlindbox = commodityType === 'physical_blindbox'

              // Out of stock logic
              // physical_blindbox: out of stock when global stock (SUM of set quantities) = 0
              // blindbox (digital): out of stock when this student has claimed all sets (per-student)
              // standard/physical: out of stock when quantity cap reached
              const outOfStock = isPhysicalBlindbox
                ? (item.blindbox_remaining ?? 0) === 0
                : isBlindbox
                  ? (item.blindbox_remaining ?? 0) === 0
                  : item.quantity !== null && (item.redemption_count ?? 0) >= item.quantity

              const canAfford = balance >= item.cost
              const isOwned = ownedItemIds.has(item.id)
              const disabled = outOfStock || !canAfford || isOwned
              const redeemError = redeemErrors[item.id]

              return (
                <div
                  key={item.id}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200 flex flex-col"
                >
                  {/* Image area */}
                  <div className="relative w-full aspect-square bg-gray-50 overflow-hidden">
                    {isBlindbox ? (
                      item.image_url ? (
                        <div className="relative w-full h-full">
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          {/* Mystery box overlay badge */}
                          <div className="absolute bottom-2 right-2 bg-purple-600/80 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            🎁 Mystery
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200 group-hover:from-purple-200 group-hover:to-purple-300 transition-colors">
                          <span className="text-7xl group-hover:scale-110 transition-transform select-none">🎁</span>
                        </div>
                      )
                    ) : isPhysical ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100 group-hover:from-amber-100 group-hover:to-amber-200 transition-colors">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <>
                            <span className="text-5xl mb-1">📦</span>
                            <span className="text-xs font-semibold text-amber-600">Physical Prize</span>
                          </>
                        )}
                      </div>
                    ) : (
                      item.image_url ? (
                        <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl select-none">🎁</div>
                      )
                    )}

                    {/* Sold out / Owned overlay */}
                    {outOfStock && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-white text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">Sold Out</span>
                      </div>
                    )}
                    {isOwned && !outOfStock && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">✓ Owned</span>
                      </div>
                    )}

                    {/* Stock badge */}
                    {!outOfStock && isBlindbox && !isPhysicalBlindbox && (
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full shadow-sm">
                        {item.blindbox_remaining} left
                      </div>
                    )}
                    {!outOfStock && isPhysicalBlindbox && (
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-rose-700 text-xs font-medium px-2 py-0.5 rounded-full shadow-sm">
                        {item.blindbox_remaining} left
                      </div>
                    )}
                    {!outOfStock && !isBlindbox && !isPhysicalBlindbox && item.quantity !== null && (
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full shadow-sm">
                        {item.quantity - (item.redemption_count ?? 0)} left
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-3 flex flex-col flex-1">
                    {/* Commodity badge — shown for blindbox/physical types */}
                    {(isBlindbox || isPhysical) && (
                      <div className="mb-1">
                        {isPhysicalBlindbox ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">
                            📦🎲 Physical Box
                          </span>
                        ) : (
                          <CommodityBadge type={commodityType} />
                        )}
                      </div>
                    )}

                    {/* Category badge */}
                    {item.category !== 'other' && (
                      <div className="mb-1">
                        <CategoryBadge category={item.category} />
                      </div>
                    )}

                    <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-0.5 line-clamp-2">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-gray-500 text-xs line-clamp-2 mb-1">{item.description}</p>
                    )}

                    {/* Collapsible details */}
                    {item.details && <ItemDetails details={item.details} />}

                    <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                      <span className="text-primary-600 font-bold text-base">
                        {item.cost}
                        <span className="text-gray-400 font-normal text-xs ml-0.5">pts</span>
                      </span>
                      <button
                        disabled={disabled || redeeming === item.id}
                        onClick={() => handleRedeem(item)}
                        aria-label={`Redeem ${item.title} for ${item.cost} points`}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                          disabled || redeeming === item.id
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : isPhysicalBlindbox
                            ? 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95'
                            : isBlindbox
                            ? 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95'
                            : isPhysical
                            ? 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95'
                            : 'bg-primary-600 text-white hover:bg-primary-700 active:scale-95'
                        }`}
                      >
                        {redeeming === item.id ? '…' :
                         isOwned ? '✓ Owned' :
                         outOfStock ? 'Sold Out' :
                         isPhysicalBlindbox ? 'Open & Claim' :
                         isBlindbox ? 'Open Box' :
                         isPhysical ? 'Claim Prize' :
                         'Redeem'}
                      </button>
                    </div>
                    {redeemError && !outOfStock && (
                      <p className="text-red-500 text-xs mt-1">{redeemError}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          )
        })()}

        {/* Redemption History */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">Your Redemption History</h2>
        {sortedRedemptions.length === 0 ? (
          <Card>
            <Card.Body>
              <p className="text-center text-gray-500 py-6">You haven&apos;t redeemed anything yet.</p>
            </Card.Body>
          </Card>
        ) : (
          <Card>
            <Card.Body>
              <div className="divide-y divide-gray-100">
                {sortedRedemptions.map((r) => (
                  <div key={r.id} className={`py-3 flex items-center justify-between gap-3 ${r.refunded_at ? 'opacity-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-medium text-gray-900 ${r.refunded_at ? 'line-through text-gray-400' : ''}`}>{r.item_title}</p>
                        {r.refunded_at && (
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Refunded</span>
                        )}
                        {!r.refunded_at && r.item_commodity_type === 'blindbox' && (
                          <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">🎁 Blind Box</span>
                        )}
                        {!r.refunded_at && r.item_commodity_type === 'physical_blindbox' && (
                          <span className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">📦🎲 Physical Box</span>
                        )}
                        {!r.refunded_at && r.item_commodity_type === 'physical' && (
                          <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">📦 Physical</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(r.redeemed_at).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!r.refunded_at && (r.item_commodity_type === 'blindbox' || r.item_commodity_type === 'physical_blindbox') && r.blindbox_image_url && (
                        <button
                          onClick={() => setBlindboxView({ imageUrls: r.blindbox_image_urls?.length ? r.blindbox_image_urls : [r.blindbox_image_url!], itemTitle: r.item_title, isPhysical: r.item_commodity_type === 'physical_blindbox' })}
                          className="text-xs font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          View Prize
                        </button>
                      )}
                      <span className={`font-bold ${r.refunded_at ? 'text-gray-400 line-through' : 'text-primary-600'}`}>-{r.points_spent} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        )}
      </main>
    </div>
  )
}
