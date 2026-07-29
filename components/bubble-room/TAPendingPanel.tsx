'use client'

/**
 * TAPendingPanel — teacher/admin review queue for Bubble Room TA applications.
 *
 * Shown in the Bubble Room header (collapsible) when viewer is teacher/admin.
 * Lists pending applications. Approve/deny inline with optional comment.
 */

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { getPendingApplications, reviewBadgeApplication } from '@/lib/actions/badges'
import type { BadgeApplication } from '@/lib/types/badges'

export interface TAPendingPanelProps {
  onClose: () => void
}

export function TAPendingPanel({ onClose }: TAPendingPanelProps) {
  const [applications, setApplications] = useState<BadgeApplication[]>([])
  const [loading, setLoading] = useState(true)
  // Track per-application state: null = default, 'reviewing' = comment box open
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [pendingDecision, setPendingDecision] = useState<'approved' | 'denied' | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const result = await getPendingApplications('bubble_room_ta')
    if (!result.error) setApplications(result.data ?? [])
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
      setApplications((prev) => prev.filter((a) => a.id !== reviewingId))
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ta-panel-title"
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
        max-h-[85vh]
        overflow-hidden
      ">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 id="ta-panel-title" className="text-base font-semibold text-gray-900">
              🎓 TA Applications
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? 'Loading…' : `${applications.length} pending`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : applications.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No pending applications</p>
          ) : (
            applications.map((app) => (
              <div key={app.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{app.applicant_name}</p>
                    <p className="text-xs text-gray-400">{app.applicant_email} · Applied {formatDate(app.created_at)}</p>
                  </div>
                </div>

                {app.note && (
                  <p className="text-sm text-gray-700 leading-relaxed bg-white rounded-lg p-2.5 border border-gray-100">
                    "{app.note}"
                  </p>
                )}
                {!app.note && (
                  <p className="text-xs text-gray-400 italic">No pitch provided</p>
                )}

                {error && reviewingId === app.id && (
                  <p className="text-sm text-red-600">{error}</p>
                )}

                {/* Review comment box */}
                {reviewingId === app.id && (
                  <div className="space-y-2 pt-1">
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      rows={2}
                      maxLength={300}
                      placeholder={pendingDecision === 'approved'
                        ? 'Optional message to the student…'
                        : 'Feedback for the student (optional)…'}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={submitReview}
                        isLoading={processing}
                        disabled={processing}
                        className={`flex-1 text-white ${pendingDecision === 'approved' ? 'bg-teal-500 hover:bg-teal-600' : 'bg-red-500 hover:bg-red-600'}`}
                      >
                        {pendingDecision === 'approved' ? 'Confirm Approve' : 'Confirm Deny'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelReview} disabled={processing} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {reviewingId !== app.id && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => startReview(app.id, 'approved')}
                      className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
                    >
                      ✓ Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startReview(app.id, 'denied')}
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
