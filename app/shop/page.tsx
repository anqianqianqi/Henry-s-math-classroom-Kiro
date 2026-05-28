'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import {
  computeSpendableBalance,
  isRedeemDisabled,
  sortRedemptionsByRecent,
} from '@/lib/utils/shop'
import type { ShopItem, Redemption } from '@/lib/types/shop'

interface ShopItemWithCount extends ShopItem {
  redemption_count: number
  blindbox_remaining?: number
}

interface RedemptionWithTitle extends Redemption {
  item_title: string
  item_commodity_type?: string
  blindbox_image_url?: string | null
}

// ── Blind Box Reveal Modal ────────────────────────────────────────────────────
function BlindBoxReveal({
  imageUrl,
  itemTitle,
  onClose,
}: {
  imageUrl: string
  itemTitle: string
  onClose: () => void
}) {
  const [phase, setPhase] = useState<'shake' | 'open' | 'reveal'>('shake')

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

        {/* Box animation */}
        <div className="relative mx-auto mb-6" style={{ width: 200, height: 200 }}>
          {phase !== 'reveal' && (
            <div
              className={`absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-accent-blue shadow-lg ${
                phase === 'shake' ? 'animate-[wiggle_0.15s_ease-in-out_4]' : 'animate-[scaleUp_0.4s_ease-out_forwards]'
              }`}
              style={{
                animation: phase === 'shake'
                  ? 'wiggle 0.15s ease-in-out 4'
                  : 'scaleUp 0.4s ease-out forwards',
              }}
            >
              <span className="text-7xl select-none">🎁</span>
            </div>
          )}
          {phase === 'reveal' && (
            <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-lg animate-[fadeIn_0.5s_ease-out]">
              <img
                src={imageUrl}
                alt="Your blind box reward"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {phase === 'reveal' ? (
          <>
            <p className="text-lg font-bold text-gray-900 mb-1">You got it! 🎉</p>
            <p className="text-sm text-gray-500 mb-6">Download your exclusive image below.</p>
            <div className="flex gap-3">
              <a
                href={imageUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-primary-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-700 transition-colors text-center"
              >
                ⬇ Download
              </a>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-100 text-gray-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Close
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
  imageUrl,
  itemTitle,
  onClose,
}: {
  imageUrl: string
  itemTitle: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center">
        <p className="text-sm font-semibold text-primary-500 uppercase tracking-widest mb-4">
          🎁 {itemTitle}
        </p>
        <div className="rounded-2xl overflow-hidden shadow-lg mb-6" style={{ width: 200, height: 200, margin: '0 auto 24px' }}>
          <img src={imageUrl} alt="Your blind box reward" className="w-full h-full object-cover" />
        </div>
        <p className="text-sm text-gray-500 mb-6">Your exclusive prize — download it anytime!</p>
        <div className="flex gap-3">
          <a
            href={imageUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-primary-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-700 transition-colors text-center"
          >
            ⬇ Download
          </a>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-200 transition-colors"
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

  // Modals
  const [blindboxReveal, setBlindboxReveal] = useState<{ imageUrl: string; itemTitle: string } | null>(null)
  const [blindboxView, setBlindboxView] = useState<{ imageUrl: string; itemTitle: string } | null>(null)
  const [physicalConfirm, setPhysicalConfirm] = useState<{ itemTitle: string } | null>(null)

  const loadData = useCallback(async (userId: string) => {
    // Balance from wallet
    let newBalance = 0
    try {
      const { data: walletData } = await supabase
        .from('student_wallets')
        .select('spendable_balance')
        .eq('user_id', userId)
        .single()
      newBalance = walletData?.spendable_balance ?? 0
    } catch {
      const [submissionsResult, spentResult] = await Promise.all([
        supabase.from('challenge_submissions').select('points').eq('user_id', userId).not('points', 'is', null),
        supabase.from('redemptions').select('points_spent').eq('user_id', userId),
      ])
      const lockedPoints = (submissionsResult.data ?? []).map((s: any) => s.points ?? 0)
      const pointsSpent = (spentResult.data ?? []).map((r: any) => r.points_spent ?? 0)
      newBalance = computeSpendableBalance(lockedPoints, pointsSpent)
    }
    setBalance(newBalance)

    // Shop items
    const { data: shopItems, error: itemsError } = await supabase
      .from('shop_items')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (itemsError) { setError('Failed to load shop items'); return }

    // Redemption counts
    const { data: redemptionCounts } = await supabase.from('redemptions').select('item_id')
    const countMap: Record<string, number> = {}
    for (const r of redemptionCounts ?? []) {
      countMap[r.item_id] = (countMap[r.item_id] ?? 0) + 1
    }

    // Blind box remaining counts — per-student: total pool minus what THIS student has claimed
    const blindboxIds = (shopItems ?? [])
      .filter((i: any) => i.commodity_type === 'blindbox' || i.commodity_type === 'physical_blindbox')
      .map((i: any) => i.id)

    const remainingMap: Record<string, number> = {}
    if (blindboxIds.length > 0) {
      // Total pool size per item
      const { data: poolCounts } = await supabase
        .from('blindbox_images')
        .select('item_id')
        .in('item_id', blindboxIds)
      const poolMap: Record<string, number> = {}
      for (const r of poolCounts ?? []) {
        poolMap[r.item_id] = (poolMap[r.item_id] ?? 0) + 1
      }

      // How many this student has already claimed
      const { data: studentClaims } = await supabase
        .from('blindbox_claims')
        .select('item_id')
        .in('item_id', blindboxIds)
        .eq('student_id', userId)
      const claimedCountMap: Record<string, number> = {}
      for (const r of studentClaims ?? []) {
        claimedCountMap[r.item_id] = (claimedCountMap[r.item_id] ?? 0) + 1
      }

      for (const id of blindboxIds) {
        remainingMap[id] = (poolMap[id] ?? 0) - (claimedCountMap[id] ?? 0)
      }
    }

    setItems(
      (shopItems ?? []).map((item: ShopItem) => ({
        ...item,
        redemption_count: countMap[item.id] ?? 0,
        blindbox_remaining: (item.commodity_type === 'blindbox' || item.commodity_type === 'physical_blindbox') ? (remainingMap[item.id] ?? 0) : undefined,
      }))
    )

    // Redemption history with item details
    const { data: history } = await supabase
      .from('redemptions')
      .select('*, shop_items(title, commodity_type)')
      .eq('user_id', userId)
      .order('redeemed_at', { ascending: false })

    // Fetch claimed blind box images for this student (from blindbox_claims)
    const { data: claimedImages } = await supabase
      .from('blindbox_claims')
      .select('item_id, image_id, blindbox_images(image_url)')
      .eq('student_id', userId)
      .order('claimed_at', { ascending: false })

    // For redemption history: show the most recently claimed image per item
    const claimedImageMap: Record<string, string> = {}
    for (const claim of claimedImages ?? []) {
      const url = (claim as any).blindbox_images?.image_url
      if (url && !claimedImageMap[claim.item_id]) {
        claimedImageMap[claim.item_id] = url
      }
    }

    setRedemptions(
      (history ?? []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        item_id: r.item_id,
        points_spent: r.points_spent,
        redeemed_at: r.redeemed_at,
        item_title: r.shop_items?.title ?? 'Unknown item',
        item_commodity_type: r.shop_items?.commodity_type ?? 'standard',
        blindbox_image_url: (r.shop_items?.commodity_type === 'blindbox' || r.shop_items?.commodity_type === 'physical_blindbox')
          ? (claimedImageMap[r.item_id] ?? null)
          : null,
      }))
    )
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
        const msg =
          data.error === 'Insufficient balance' ? 'Not enough points' :
          data.error === 'Item is out of stock' ? 'This item is out of stock' :
          'Something went wrong, please try again'
        setRedeemErrors((prev) => ({ ...prev, [item.id]: msg }))
      } else {
        // Refresh data
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await loadData(user.id)

        // Show appropriate modal
        if (data.commodity_type === 'blindbox' && data.image_url) {
          setBlindboxReveal({ imageUrl: data.image_url, itemTitle: item.title })
        } else if (data.commodity_type === 'physical_blindbox') {
          // Physical blind box: show pickup note, no download
          setPhysicalConfirm({ itemTitle: item.title })
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
      {blindboxReveal && (
        <BlindBoxReveal
          imageUrl={blindboxReveal.imageUrl}
          itemTitle={blindboxReveal.itemTitle}
          onClose={() => setBlindboxReveal(null)}
        />
      )}
      {blindboxView && (
        <BlindBoxView
          imageUrl={blindboxView.imageUrl}
          itemTitle={blindboxView.itemTitle}
          onClose={() => setBlindboxView(null)}
        />
      )}
      {physicalConfirm && (
        <PhysicalConfirm
          itemTitle={physicalConfirm.itemTitle}
          onClose={() => setPhysicalConfirm(null)}
        />
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-600 hover:text-gray-900">
            ← Dashboard
          </button>
          <h1 className="text-xl font-bold text-gray-900">Points Shop 🛍️</h1>
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
        <h2 className="text-xl font-bold text-gray-900 mb-4">Available Rewards</h2>
        {items.length === 0 ? (
          <div className="mb-8 text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🛍️</div>
            <p className="text-lg font-medium text-gray-500">No rewards available yet.</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 mb-10">
            {items.map((item) => {
              const commodityType = item.commodity_type ?? 'standard'
              const isBlindbox = commodityType === 'blindbox' || commodityType === 'physical_blindbox'
              const isPhysical = commodityType === 'physical'
              const isPhysicalBlindbox = commodityType === 'physical_blindbox'

              // Out of stock logic
              const outOfStock = isBlindbox
                ? (item.blindbox_remaining ?? 0) === 0
                : item.quantity !== null && item.redemption_count >= item.quantity

              const canAfford = balance >= item.cost
              const disabled = outOfStock || !canAfford
              const redeemError = redeemErrors[item.id]

              return (
                <div
                  key={item.id}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200 flex flex-col"
                >
                  {/* Image area */}
                  <div className="relative w-full aspect-square bg-gray-50 overflow-hidden">
                    {isBlindbox ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200 group-hover:from-purple-200 group-hover:to-purple-300 transition-colors">
                        <span className="text-5xl mb-1 group-hover:scale-110 transition-transform">🎁</span>
                        <span className="text-xs font-semibold text-purple-600">Mystery Box</span>
                      </div>
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

                    {/* Sold out overlay */}
                    {outOfStock && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-white text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">Sold Out</span>
                      </div>
                    )}

                    {/* Stock badge */}
                    {!outOfStock && isBlindbox && (
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full shadow-sm">
                        {item.blindbox_remaining} left
                      </div>
                    )}
                    {!outOfStock && !isBlindbox && item.quantity !== null && (
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full shadow-sm">
                        {item.quantity - item.redemption_count} left
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-3 flex flex-col flex-1">
                    {/* Commodity badge */}
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
                         outOfStock ? 'Sold Out' :
                         isPhysicalBlindbox ? 'Open & Claim' :
                         isBlindbox ? 'Open Box' :
                         isPhysical ? 'Claim Prize' :
                         'Redeem'}
                      </button>
                    </div>
                    {redeemError && (
                      <p className="text-red-500 text-xs mt-1">{redeemError}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

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
                  <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900">{r.item_title}</p>
                        {r.item_commodity_type === 'blindbox' && (
                          <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">🎁 Blind Box</span>
                        )}
                        {r.item_commodity_type === 'physical_blindbox' && (
                          <span className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">📦🎲 Physical Box</span>
                        )}
                        {r.item_commodity_type === 'physical' && (
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
                      {(r.item_commodity_type === 'blindbox' || r.item_commodity_type === 'physical_blindbox') && r.blindbox_image_url && (
                        <button
                          onClick={() => setBlindboxView({ imageUrl: r.blindbox_image_url!, itemTitle: r.item_title })}
                          className="text-xs font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          View Prize
                        </button>
                      )}
                      <span className="text-primary-600 font-bold">-{r.points_spent} pts</span>
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
