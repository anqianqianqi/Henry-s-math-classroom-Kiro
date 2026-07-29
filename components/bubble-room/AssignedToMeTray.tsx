'use client'

/**
 * AssignedToMeTray — expandable bottom drawer showing questions
 * assigned to the current user (teachers and TAs).
 *
 * Design: a persistent strip at the bottom of the Bubble Room canvas.
 * Collapsed = a single row showing the pending count + "Assigned to you" label.
 * Expanded = the strip grows upward revealing all pending and responded cards.
 * No overlay, no slide-in panel — purely vertical expansion in place.
 */

import { useEffect, useState } from 'react'
import { fetchMyAssignments } from '@/lib/actions/bubbleRoom'
import type { BubbleQuestionAssignment, BubbleQuestion } from '@/lib/types/bubbleRoom'

export interface AssignedToMeTrayProps {
  currentUserId: string
  onQuestionClick: (q: BubbleQuestion) => void
}

export function AssignedToMeTray({ currentUserId, onQuestionClick }: AssignedToMeTrayProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [pending, setPending] = useState<BubbleQuestionAssignment[]>([])
  const [responded, setResponded] = useState<BubbleQuestionAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [showResponded, setShowResponded] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const result = await fetchMyAssignments()
    if (!result.error && result.data) {
      setPending(result.data.pending)
      setResponded(result.data.responded)
    }
    setLoading(false)
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch { return '' }
  }

  const pendingCount = pending.length
  const totalCount = pendingCount + responded.length

  return (
    <div
      className="
        absolute bottom-0 left-0 right-0 z-20
        bg-white border-t border-orange-200
        transition-all duration-300 ease-in-out
        select-none
      "
      style={{ maxHeight: isExpanded ? '50vh' : undefined }}
    >
      {/* ── Header row — always visible ──────────────────────────────── */}
      <button
        type="button"
        onClick={() => { setIsExpanded(e => !e); if (!isExpanded) load() }}
        className="
          w-full flex items-center justify-between
          px-4 py-2.5
          bg-gradient-to-r from-orange-50 to-amber-50
          hover:from-orange-100 hover:to-amber-100
          transition-colors cursor-pointer
          border-b border-orange-100
        "
        aria-expanded={isExpanded}
        aria-label={`Assigned to you — ${pendingCount} pending`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">📬</span>
          <span className="text-sm font-semibold text-gray-800">Assigned to you</span>
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin inline-block" />
          ) : (
            <>
              {pendingCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
              {pendingCount === 0 && totalCount > 0 && (
                <span className="text-xs text-gray-400">{totalCount} total</span>
              )}
            </>
          )}
        </div>
        <span className="text-gray-400 text-xs font-medium">
          {isExpanded ? '▼ Collapse' : '▲ Expand'}
        </span>
      </button>

      {/* ── Expanded list ─────────────────────────────────────────────── */}
      {isExpanded && (
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(50vh - 44px)' }}>
          <div className="p-3 space-y-2">
            {pending.length === 0 && responded.length === 0 && !loading && (
              <p className="text-xs text-gray-400 text-center py-4">
                No questions assigned to you yet
              </p>
            )}

            {pending.length === 0 && responded.length > 0 && (
              <p className="text-xs text-gray-400 text-center py-2">
                ✅ All caught up — no pending questions
              </p>
            )}

            {pending.map(assignment => (
              <AssignmentRow
                key={assignment.id}
                assignment={assignment}
                isPending
                onOpen={() => { if (assignment.question) onQuestionClick(assignment.question) }}
                formatDate={formatDate}
              />
            ))}

            {responded.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowResponded(s => !s)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 border-t border-gray-100 mt-1"
                >
                  <span>Responded ({responded.length})</span>
                  <span>{showResponded ? '▲ hide' : '▼ show'}</span>
                </button>
                {showResponded && responded.map(assignment => (
                  <AssignmentRow
                    key={assignment.id}
                    assignment={assignment}
                    isPending={false}
                    onOpen={() => { if (assignment.question) onQuestionClick(assignment.question) }}
                    formatDate={formatDate}
                  />
                ))}
              </>
            )}
          </div>

          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={load}
              className="w-full text-[11px] text-gray-400 hover:text-gray-600 py-1 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Row component ──────────────────────────────────────────────────────────

function AssignmentRow({
  assignment,
  isPending,
  onOpen,
  formatDate,
}: {
  assignment: BubbleQuestionAssignment
  isPending: boolean
  onOpen: () => void
  formatDate: (iso: string) => string
}) {
  const q = assignment.question
  if (!q) return null

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`
        w-full text-left rounded-xl px-3 py-2.5 space-y-0.5
        border transition-all hover:shadow-sm
        focus:outline-none focus:ring-2 focus:ring-orange-400
        ${isPending
          ? 'bg-orange-50 border-orange-200 hover:border-orange-400'
          : 'bg-gray-50 border-gray-100 hover:border-gray-300 opacity-70 hover:opacity-100'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium leading-snug line-clamp-1 ${isPending ? 'text-orange-900' : 'text-gray-600'}`}>
          {q.title ?? q.text.slice(0, 80)}
        </p>
        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          isPending ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
        }`}>
          {isPending ? 'Pending' : '✓ Done'}
        </span>
      </div>
      <p className="text-[11px] text-gray-400">
        by {q.author_display_name} · {formatDate(assignment.created_at)}
      </p>
    </button>
  )
}
