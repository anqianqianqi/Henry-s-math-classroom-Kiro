'use client'

/**
 * AssignedToMeTray — collapsible right-side panel showing questions
 * that have been directly assigned to the current user (teacher or TA).
 *
 * Visual states:
 *   - Collapsed: a tab button on the right edge with a badge count
 *   - Expanded: a panel slides in from the right, listing pending + responded cards
 *
 * When the assignee responds to a question, it moves from "Pending" → "Responded"
 * in real time (tracked via responded_at on the assignment row).
 */

import { useEffect, useState } from 'react'
import { fetchMyAssignments } from '@/lib/actions/bubbleRoom'
import type { BubbleQuestionAssignment } from '@/lib/types/bubbleRoom'
import type { BubbleQuestion } from '@/lib/types/bubbleRoom'

export interface AssignedToMeTrayProps {
  currentUserId: string
  onQuestionClick: (q: BubbleQuestion) => void
}

export function AssignedToMeTray({ currentUserId, onQuestionClick }: AssignedToMeTrayProps) {
  const [isOpen, setIsOpen] = useState(false)
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

  // When a question gets clicked and the user responds, move it to responded
  function handleQuestionClick(assignment: BubbleQuestionAssignment) {
    if (!assignment.question) return
    onQuestionClick(assignment.question)
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch { return '' }
  }

  const pendingCount = pending.length

  return (
    <>
      {/* ── Tab trigger on the right edge ──────────────────────────────── */}
      <button
        type="button"
        onClick={() => { setIsOpen(o => !o); if (!isOpen) load() }}
        aria-label={`Assigned to you — ${pendingCount} pending`}
        className="
          fixed right-0 top-1/2 -translate-y-1/2 z-30
          flex flex-col items-center gap-1
          px-1.5 py-4
          bg-white border border-l-0 border-gray-200 rounded-l-xl
          shadow-md
          text-gray-600 hover:bg-gray-50
          transition-colors
        "
      >
        <span className="text-base" aria-hidden="true">📬</span>
        {pendingCount > 0 && (
          <span className="
            inline-flex items-center justify-center
            w-5 h-5 rounded-full
            bg-orange-500 text-white text-[10px] font-bold
          ">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
        <span
          className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          For You
        </span>
      </button>

      {/* ── Slide-in panel ──────────────────────────────────────────────── */}
      <div
        className={`
          fixed top-0 right-0 h-full z-40
          w-80 sm:w-96
          bg-white border-l border-gray-200 shadow-2xl
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        aria-label="Questions assigned to you"
        role="complementary"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <span aria-hidden="true">📬</span>
              Assigned to You
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? 'Loading…' : `${pendingCount} pending`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close panel"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pending.length === 0 && responded.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm text-gray-400">No questions assigned to you yet</p>
            </div>
          ) : (
            <>
              {/* Pending */}
              {pending.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  All caught up! No pending questions.
                </p>
              ) : (
                pending.map(assignment => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    isPending
                    onOpen={() => handleQuestionClick(assignment)}
                    formatDate={formatDate}
                  />
                ))
              )}

              {/* Responded toggle */}
              {responded.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowResponded(s => !s)}
                    className="w-full flex items-center justify-between py-2 text-xs font-medium text-gray-500 hover:text-gray-700"
                  >
                    <span>Responded ({responded.length})</span>
                    <span>{showResponded ? '▲' : '▼'}</span>
                  </button>
                  {showResponded && responded.map(assignment => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      isPending={false}
                      onOpen={() => handleQuestionClick(assignment)}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Refresh */}
        <div className="p-3 border-t border-gray-100">
          <button
            type="button"
            onClick={load}
            className="w-full text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Backdrop when open on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-39 bg-black/20 sm:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}

// ── Assignment card ──────────────────────────────────────────────────────────

function AssignmentCard({
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
        w-full text-left rounded-xl p-3 space-y-1
        border transition-all hover:shadow-md
        focus:outline-none focus:ring-2 focus:ring-orange-400
        ${isPending
          ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-200'
          : 'bg-gray-50 border-gray-100'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-semibold leading-snug ${isPending ? 'text-orange-900' : 'text-gray-700'}`}>
          {q.title ?? q.text.slice(0, 60)}
        </p>
        {isPending && (
          <span className="shrink-0 text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
            Pending
          </span>
        )}
        {!isPending && (
          <span className="shrink-0 text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
            ✓ Done
          </span>
        )}
      </div>
      {q.title && (
        <p className="text-xs text-gray-500 leading-snug line-clamp-2">{q.text}</p>
      )}
      <p className="text-[10px] text-gray-400">
        by {q.author_display_name} · {formatDate(assignment.created_at)}
      </p>
    </button>
  )
}
