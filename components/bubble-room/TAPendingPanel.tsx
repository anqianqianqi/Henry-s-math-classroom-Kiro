'use client'

/**
 * TAPendingPanel — teacher/admin review queue for Bubble Room TA applications.
 * Shows both pending queue and application history (approved/denied).
 */

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { getPendingApplications, getAllApplications, reviewBadgeApplication } from '@/lib/actions/badges'
import type { BadgeApplication } from '@/lib/types/badges'

export interface TAPendingPanelProps {
  onClose: () => void
}

type Tab = 'pending' | 'history'

export function TAPendingPanel({ onClose }: TAPendingPanelProps) {
  const [tab, setTab] = useState<Tab>('pending')
  const [applications, setApplications] = useState<BadgeApplication[]>([])
  const [history, setHistory] = useState<BadgeApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [pendingDecision, setPendingDecision] = useState<'approved' | 'denied' | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [pendingResult, historyResult] = await Promise.all([
      getPendingApplications('bubble_room_ta'),
      getAllApplications('bubble_room_ta'),
    ])
    if (!pendingResult.error) setApplications(pendingResult.data ?? [])
    if (!historyResult.error) {
      // History = non-pending
      setHistory((historyResult.data ?? []).filter(a => a.status !== 'pending'))
    }
    setLoading(false)
  }

  function startReview(appId: string, decision: 'approved' | 'denied') {
    setReviewingId(appId)
    setPendingDecision(decision)
    setReviewComment('')
    setError(null)
  }

  function cancelReview() {
    setReviewingId(null)
    setPendingDecision(null)
    setReviewComment('')
    setError(null)
  }

  async function submitReview() {
    if (!reviewingId || !pendingDecision) return
    setProcessing(true)
    setError(null)
    try {
      const result = await reviewBadgeApplication(reviewingId, pendingDecision, reviewComment || undefined)
      if (result.error) {
        setError(result.error)
        return
      }
      // Move from pending to history
      const reviewed = applications.find(a => a.id === reviewingId)
      if (reviewed) {
        setApplications(prev => prev.filter(a => a.id !== reviewingId))
        setHistory(prev => [{ ...reviewed, status: pendingDecision }, ...prev])
      }
      cancelReview()
    } catch {
      setError('Failed to process. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch { return iso }
  }

  const displayed = tab === 'pending' ? applications : history

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ta-panel-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 id="ta-panel-title" className="text-base font-semibold text-gray-900">🎓 TA Applications</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? 'Loading…' : `${applications.length} pending · ${history.length} reviewed`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['pending', 'history'] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'text-green-700 border-b-2 border-green-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'pending' ? `Pending (${applications.length})` : `History (${history.length})`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {tab === 'pending' ? 'No pending applications' : 'No reviewed applications yet'}
            </p>
          ) : (
            displayed.map((app) => (
              <div key={app.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{app.applicant_name}</p>
                    <p className="text-xs text-gray-400">{app.applicant_email} · {formatDate(app.created_at)}</p>
                  </div>
                  {/* Status badge for history */}
                  {tab === 'history' && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      app.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {app.status === 'approved' ? '✓ Approved' : '✕ Denied'}
                    </span>
                  )}
                </div>

                {app.note ? (
                  <p className="text-sm text-gray-700 leading-relaxed bg-white rounded-lg p-2.5 border border-gray-100">
                    "{app.note}"
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 italic">No pitch provided</p>
                )}

                {/* Reviewer comment in history */}
                {tab === 'history' && app.reviewer_comment && (
                  <p className="text-xs text-gray-500 italic">
                    Reviewer note: "{app.reviewer_comment}"
                  </p>
                )}

                {error && reviewingId === app.id && (
                  <p className="text-sm text-red-600">{error}</p>
                )}

                {/* Review comment box */}
                {tab === 'pending' && reviewingId === app.id && (
                  <div className="space-y-2 pt-1">
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      rows={2}
                      maxLength={300}
                      placeholder={pendingDecision === 'approved' ? 'Optional message to the student…' : 'Feedback for the student (optional)…'}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={submitReview} isLoading={processing} disabled={processing}
                        className={`flex-1 text-white ${pendingDecision === 'approved' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                      >
                        {pendingDecision === 'approved' ? 'Confirm Approve' : 'Confirm Deny'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelReview} disabled={processing} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Action buttons — pending tab only */}
                {tab === 'pending' && reviewingId !== app.id && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => startReview(app.id, 'approved')}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    >
                      ✓ Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => startReview(app.id, 'denied')}
                      className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      ✕ Deny
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
