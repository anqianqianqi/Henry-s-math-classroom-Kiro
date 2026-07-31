'use client'

/**
 * AssignedToMeTray — modal showing questions assigned to the current user.
 * Opened via the "📬 Assigned" button in the Bubble Room top bar.
 */

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useOnDemandTranslation } from '@/lib/i18n/useOnDemandTranslation'
import { fetchMyAssignments } from '@/lib/actions/bubbleRoom'
import type { BubbleQuestionAssignment, BubbleQuestion } from '@/lib/types/bubbleRoom'

export interface AssignedToMeTrayProps {
  currentUserId: string
  onQuestionClick: (q: BubbleQuestion) => void
  onClose: () => void
}

export function AssignedToMeTray({ currentUserId, onQuestionClick, onClose }: AssignedToMeTrayProps) {
  // The language is read per row, not here — see AssignmentRow below.
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="assigned-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="
        relative z-10 w-full sm:max-w-lg
        rounded-t-2xl sm:rounded-2xl
        bg-white shadow-2xl
        flex flex-col
        max-h-[80vh]
        overflow-hidden
      ">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50">
          <div>
            <h2 id="assigned-modal-title" className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <span aria-hidden="true">📬</span>
              Assigned to You
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? 'Loading…' : `${pendingCount} pending · ${responded.length} responded`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ↻ Refresh
            </button>
            <button type="button" onClick={onClose} aria-label="Close"
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pending.length === 0 && responded.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm text-gray-400">No questions assigned to you yet</p>
            </div>
          ) : (
            <>
              {/* Pending */}
              {pending.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">
                  ✅ All caught up — no pending questions
                </p>
              )}

              {pending.map(assignment => (
                <AssignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  isPending
                  onOpen={() => {
                    if (assignment.question) onQuestionClick(assignment.question)
                  }}
                  formatDate={formatDate}
                />
              ))}

              {/* Responded section */}
              {responded.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowResponded(s => !s)}
                    className="w-full flex items-center justify-between px-2 py-2 text-xs font-medium text-gray-400 hover:text-gray-600 border-t border-gray-100 mt-2"
                  >
                    <span>Responded ({responded.length})</span>
                    <span>{showResponded ? '▲ hide' : '▼ show'}</span>
                  </button>
                  {showResponded && responded.map(assignment => (
                    <AssignmentRow
                      key={assignment.id}
                      assignment={assignment}
                      isPending={false}
                      onOpen={() => {
                        if (assignment.question) onQuestionClick(assignment.question)
                      }}
                      formatDate={formatDate}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
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
  // Own hook rather than a prop: this row renders in a list and reads the
  // language for its own preview text. Both hooks run before the early return
  // below, so the hook order stays fixed whether or not the question loaded.
  const { language } = useLanguage()
  const q = assignment.question
  const local = useOnDemandTranslation('question', q?.id, q, language)
  if (!q) return null

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`
        w-full text-left rounded-xl px-3 py-3 space-y-1
        border transition-all hover:shadow-sm
        focus:outline-none focus:ring-2 focus:ring-orange-400
        ${isPending
          ? 'bg-orange-50 border-orange-200 hover:border-orange-400'
          : 'bg-gray-50 border-gray-100 hover:border-gray-300 opacity-75 hover:opacity-100'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium leading-snug ${isPending ? 'text-orange-900' : 'text-gray-600'}`}>
          {local.title ?? local.text.slice(0, 80)}
        </p>
        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
          isPending ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
        }`}>
          {isPending ? 'Pending' : '✓ Done'}
        </span>
      </div>
      {q.title && (
        <p className="text-xs text-gray-500 line-clamp-1">{local.text}</p>
      )}
      <p className="text-[11px] text-gray-400">
        by {q.author_display_name} · {formatDate(assignment.created_at)}
      </p>
    </button>
  )
}
