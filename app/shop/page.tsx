'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  computeSpendableBalance,
  isRedeemDisabled,
  sortRedemptionsByRecent,
} from '@/lib/utils/shop'
import type { ShopItem, Redemption } from '@/lib/types/shop'

// ─────────────────────────────────────────────────────────────────────────────
// Student Shop Page
//
// Displays the student's spendable balance and a grid of active shop items.
// Spendable balance = SUM(locked submission points) - SUM(redemptions.points_spent)
// Student total_score is NEVER reduced — only the wallet balance changes on spend.
// ─────────────────────────────────────────────────────────────────────────────

interface ShopItemWithCount extends ShopItem {
  redemption_count: number
}

interface RedemptionWithTitle extends Redemption {
  item_title: string
}

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

  const loadData = useCallback(async (userId: string) => {
    // Run balance queries in parallel
    const [submissionsResult, spentResult] = await Promise.all([
      supabase
        .from('challenge_submissions')
        .select('points')
        .eq('user_id', userId)
        .not('points', 'is', null),  // any graded submission counts, not just locked
      supabase
        .from('redemptions')
        .select('points_spent')
        .eq('user_id', userId),
    ])

    const lockedPoints = (submissionsResult.data ?? []).map((s: any) => s.points ?? 0)
    const pointsSpent = (spentResult.data ?? []).map((r: any) => r.points_spent ?? 0)
    const newBalance = computeSpendableBalance(lockedPoints, pointsSpent)
    setBalance(newBalance)

    // Fetch active shop items
    const { data: shopItems, error: itemsError } = await supabase
      .from('shop_items')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (itemsError) {
      setError('Failed to load shop items')
      return
    }

    // Fetch redemption counts per item
    const { data: redemptionCounts } = await supabase
      .from('redemptions')
      .select('item_id')

    const countMap: Record<string, number> = {}
    for (const r of redemptionCounts ?? []) {
      countMap[r.item_id] = (countMap[r.item_id] ?? 0) + 1
    }

    setItems(
      (shopItems ?? []).map((item: ShopItem) => ({
        ...item,
        redemption_count: countMap[item.id] ?? 0,
      }))
    )

    // Fetch own redemption history with item titles
    const { data: history } = await supabase
      .from('redemptions')
      .select('*, shop_items(title)')
      .eq('user_id', userId)
      .order('redeemed_at', { ascending: false })

    setRedemptions(
      (history ?? []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        item_id: r.item_id,
        points_spent: r.points_spent,
        redeemed_at: r.redeemed_at,
        item_title: r.shop_items?.title ?? 'Unknown item',
      }))
    )
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      await loadData(user.id)
      setLoading(false)
    }
    init()
  }, [router, supabase, loadData])

  async function handleRedeem(itemId: string) {
    setRedeeming(itemId)
    setRedeemErrors((prev) => ({ ...prev, [itemId]: '' }))

    try {
      const res = await fetch('/api/shop/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      })

      const data = await res.json()

      if (!res.ok) {
        const msg =
          data.error === 'Insufficient balance'
            ? 'Not enough points'
            : data.error === 'Item is out of stock'
            ? 'This item is out of stock'
            : 'Something went wrong, please try again'
        setRedeemErrors((prev) => ({ ...prev, [itemId]: msg }))
      } else {
        // Refresh balance and history without full page reload
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await loadData(user.id)
      }
    } catch {
      setRedeemErrors((prev) => ({
        ...prev,
        [itemId]: 'Something went wrong, please try again',
      }))
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
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Dashboard
          </button>
          <h1 className="text-xl font-bold text-gray-900">Points Shop 🛍️</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Balance Display — shown above the item grid */}
        <div className="mb-8 bg-gradient-to-br from-primary-500 to-accent-blue rounded-3xl px-6 py-6 text-white shadow-lg">
          <p className="text-white/80 text-sm font-medium uppercase tracking-wide mb-1">
            Your Spendable Balance
          </p>
          <p className="text-5xl font-bold">{balance}</p>
          <p className="text-white/70 text-sm mt-1">points available to spend</p>
        </div>

        {/* Shop Items Grid */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">Available Rewards</h2>
        {items.length === 0 ? (
          <Card className="mb-8">
            <Card.Body>
              <p className="text-center text-gray-500 py-8">
                No rewards available yet. Check back soon!
              </p>
            </Card.Body>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {items.map((item) => {
              const disabled = isRedeemDisabled(balance, item)
              const outOfStock =
                item.quantity !== null &&
                item.redemption_count >= item.quantity
              const redeemError = redeemErrors[item.id]

              return (
                <Card key={item.id} className="flex flex-col">
                  <Card.Body className="flex flex-col flex-1">
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-40 object-cover rounded-xl mb-3"
                      />
                    )}
                    <h3 className="font-bold text-gray-900 text-lg mb-1">{item.title}</h3>
                    {item.description && (
                      <p className="text-gray-600 text-sm mb-3 flex-1">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                      <div>
                        <span className="text-2xl font-bold text-primary-600">
                          {item.cost}
                        </span>
                        <span className="text-gray-500 text-sm ml-1">pts</span>
                        {outOfStock && (
                          <span className="ml-2 text-xs text-red-500 font-medium">
                            Out of stock
                          </span>
                        )}
                        {!outOfStock && item.quantity !== null && (
                          <span className="ml-2 text-xs text-gray-400">
                            {item.quantity - item.redemption_count} left
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        disabled={disabled || redeeming === item.id}
                        onClick={() => handleRedeem(item.id)}
                        aria-label={`Redeem ${item.title} for ${item.cost} points`}
                      >
                        {redeeming === item.id ? 'Redeeming…' : 'Redeem'}
                      </Button>
                    </div>
                    {redeemError && (
                      <p className="text-red-500 text-xs mt-2">{redeemError}</p>
                    )}
                  </Card.Body>
                </Card>
              )
            })}
          </div>
        )}

        {/* Redemption History */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">Your Redemption History</h2>
        {sortedRedemptions.length === 0 ? (
          <Card>
            <Card.Body>
              <p className="text-center text-gray-500 py-6">
                You haven&apos;t redeemed anything yet.
              </p>
            </Card.Body>
          </Card>
        ) : (
          <Card>
            <Card.Body>
              <div className="divide-y divide-gray-100">
                {sortedRedemptions.map((r) => (
                  <div key={r.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{r.item_title}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(r.redeemed_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <span className="text-primary-600 font-bold">-{r.points_spent} pts</span>
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
