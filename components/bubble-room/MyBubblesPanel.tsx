'use client'

/**
 * MyBubblesPanel
 *
 * Shows the current user's bubbles split into Active / Expired tabs.
 * - Active: expires_at > now()
 * - Expired: expires_at <= now()
 *
 * Actions available per bubble:
 *   Active   → "Expire now" (author or teacher)
 *   Expired  → "Revive" extends expires_at by 10 days from now (author or teacher)
 *
 * Teachers see ALL users' bubbles, with the author name shown.
 * Students see only their own bubbles.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

interface BubbleSummary {
  id: string
  title: string | null
  text: string
  created_at: string
  expires_at: string
  revived_at: string | null
  user_id: string
  author_display_name?: string
}

const REVIVAL_DAYS = 10

interface Props {
  currentUserId: string
  currentUserRole: 'teacher' | 'student'
  onClose: () => void
  /** Optional: clicking a bubble opens the detail modal */
  onQuestionClick?: (id: string) => void
}

export function MyBubblesPanel({
  currentUserId,
  currentUserRole,
  onClose,
  onQuestionClick,
}: Props) {
  const { t } = useLanguage()
  const supabase = createClient()

  const [tab, setTab] = useState<'active' | 'expired'>('active')
  const [bubbles, setBubbles] = useState<BubbleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const now = new Date().toISOString()

  // ── Fetch ────────────────────────────────────────────────────────────────

  async function fetchBubbles() {
    setLoading(true)

    let query = supabase
      .from('bubble_room_questions')
      .select('id, title, text, created_at, expires_at, revived_at, user_id')
      .order('expires_at', { ascending: false })

    // Students see only their own; teachers see all
    if (currentUserRole === 'student') {
      query = query.eq('user_id', currentUserId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[MyBubblesPanel] fetch error', error)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as BubbleSummary[]

    // For teachers, fetch display names for all unique authors
    if (currentUserRole === 'teacher' && rows.length > 0) {
      const userIds = [...new Set(rows.map((r) => r.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname, full_name')
        .in('id', userIds)

      const nameMap = new Map<string, string>()
      for (const p of profiles ?? []) {
        nameMap.set(p.id, (p as any).nickname ?? (p as any).full_name ?? 'Unknown')
      }

      for (const row of rows) {
        row.author_display_name = nameMap.get(row.user_id) ?? 'Unknown'
      }
    }

    setBubbles(rows)
    setLoading(false)
  }

  useEffect(() => {
    fetchBubbles()
  }, [])

  // ── Partition ────────────────────────────────────────────────────────────

  const active = bubbles.filter((b) => b.expires_at > now)
  const expired = bubbles.filter((b) => b.expires_at <= now)
  const displayed = tab === 'active' ? active : expired

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleExpireNow(id: string) {
    setActionId(id)
    const { error } = await supabase
      .from('bubble_room_questions')
      .update({ expires_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setBubbles((prev) =>
        prev.map((b) =>
          b.id === id ? { ...b, expires_at: new Date().toISOString() } : b,
        ),
      )
    }
    setActionId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this bubble permanently? This cannot be undone.')) return
    setActionId(id)
    const { error } = await supabase
      .from('bubble_room_questions')
      .delete()
      .eq('id', id)

    if (!error) {
      setBubbles((prev) => prev.filter((b) => b.id !== id))
    }
    setActionId(null)
  }

  async function handleRevive(id: string) {
    setActionId(id)
    const newExpiry = new Date(
      Date.now() + REVIVAL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()
    const revivedAt = new Date().toISOString()

    const { error } = await supabase
      .from('bubble_room_questions')
      .update({ expires_at: newExpiry, revived_at: revivedAt })
      .eq('id', id)

    if (!error) {
      setBubbles((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, expires_at: newExpiry, revived_at: revivedAt }
            : b,
        ),
      )
    }
    setActionId(null)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function daysUntil(isoDate: string): number {
    const ms = new Date(isoDate).getTime() - Date.now()
    return Math.ceil(ms / (1000 * 60 * 60 * 24))
  }

  function daysAgo(isoDate: string): number {
    const ms = Date.now() - new Date(isoDate).getTime()
    return Math.floor(ms / (1000 * 60 * 60 * 24))
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full sm:w-[520px] max-h-[85vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            🫧 My Bubbles
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['active', 'expired'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`
                flex-1 py-2.5 text-sm font-medium transition-colors
                ${tab === t
                  ? 'border-b-2 border-primary-500 text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              {t === 'active' ? `Active (${active.length})` : `Expired (${expired.length})`}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {tab === 'active' ? 'No active bubbles.' : 'No expired bubbles.'}
            </div>
          ) : (
            displayed.map((b) => {
              const isActive = b.expires_at > now
              const busy = actionId === b.id

              return (
                <div
                  key={b.id}
                  className="px-5 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                >
                  {/* Content */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onQuestionClick?.(b.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onQuestionClick?.(b.id)}
                  >
                    {b.title && (
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {b.title}
                      </p>
                    )}
                    <p className="text-sm text-gray-700 line-clamp-2 leading-snug">
                      {b.text}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {currentUserRole === 'teacher' && b.author_display_name && (
                        <span className="text-xs text-indigo-500 font-medium">
                          {b.author_display_name}
                        </span>
                      )}
                      {isActive ? (
                        <span className="text-xs text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                          Expires in {daysUntil(b.expires_at)}d
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                          Expired {daysAgo(b.expires_at)}d ago
                        </span>
                      )}
                      {b.revived_at && (
                        <span className="text-xs text-amber-500">↻ revived</span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isActive ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleExpireNow(b.id)}
                        className="
                          text-xs font-medium
                          px-3 py-1.5 rounded-lg
                          border border-red-200 text-red-600 bg-red-50
                          hover:bg-red-100 disabled:opacity-50
                          transition-colors
                        "
                      >
                        {busy ? '…' : 'Expire'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRevive(b.id)}
                        className="
                          text-xs font-medium
                          px-3 py-1.5 rounded-lg
                          border border-emerald-300 text-emerald-700 bg-emerald-50
                          hover:bg-emerald-100 disabled:opacity-50
                          transition-colors
                        "
                      >
                        {busy ? '…' : '↻ Revive'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(b.id)}
                      title="Delete permanently"
                      className="
                        text-xs font-medium
                        px-2.5 py-1.5 rounded-lg
                        border border-gray-200 text-gray-500 bg-gray-50
                        hover:bg-red-50 hover:border-red-200 hover:text-red-600
                        disabled:opacity-50 transition-colors
                      "
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
