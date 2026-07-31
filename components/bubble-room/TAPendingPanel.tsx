'use client'

/**
 * TAPendingPanel — teacher/admin TA management panel.
 * Tabs: Active TAs (with revoke) | Pending applications | History (reviews + removals, time-sorted)
 */

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { getPendingApplications, getAllApplications, reviewBadgeApplication, getAllBadgeHolders, revokeBadge, getRevokedBadgeHolders } from '@/lib/actions/badges'
import type { BadgeApplication } from '@/lib/types/badges'

export interface TAPendingPanelProps {
  onClose: () => void
}

type Tab = 'active' | 'pending' | 'history'

interface ActiveTA {
  userBadgeId: string
  userId: string
  name: string
  email: string
  grantedAt: string
}

interface RemovedTA {
  userBadgeId: string
  userId: string
  name: string
  email: string
  grantedAt: string
  revokedAt: string
}

// Unified history entry — either an application review or a TA removal
type HistoryEntry =
  | { kind: 'application'; sortTime: string; app: BadgeApplication }
  | { kind: 'removal'; sortTime: string; ta: RemovedTA }

export function TAPendingPanel({ onClose }: TAPendingPanelProps) {
  const [tab, setTab] = useState<Tab>('active')
  const [applications, setApplications] = useState<BadgeApplication[]>([])
  const [historyApps, setHistoryApps] = useState<BadgeApplication[]>([])
  const [activeTAs, setActiveTAs] = useState<ActiveTA[]>([])
  const [removedTAs, setRemovedTAs] = useState<RemovedTA[]>([])
  const [loading, setLoading] = useState(true)

  // Pending review state
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [pendingDecision, setPendingDecision] = useState<'approved' | 'denied' | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Revoke TA state
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const [revokeProcessing, setRevokeProcessing] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [pendingResult, historyResult, holdersResult, removedResult] = await Promise.all([
      getPendingApplications('bubble_room_ta'),
      getAllApplications('bubble_room_ta'),
      getAllBadgeHolders('bubble_room_ta'),
      getRevokedBadgeHolders('bubble_room_ta'),
    ])
    if (!pendingResult.error) setApplications(pendingResult.data ?? [])
    if (!historyResult.error) setHistoryApps((historyResult.data ?? []).filter(a => a.status !== 'pending'))
    if (!holdersResult.error) setActiveTAs(holdersResult.data ?? [])
    if (!removedResult.error) setRemovedTAs(removedResult.data ?? [])
    setLoading(false)
  }

  // Merge application history + removals, sort newest-first
  const mergedHistory = useMemo((): HistoryEntry[] => {
    const entries: HistoryEntry[] = [
      ...historyApps.map(app => ({
        kind: 'application' as const,
        sortTime: app.reviewed_at ?? app.updated_at ?? app.created_at,
        app,
      })),
      ...removedTAs.map(ta => ({
        kind: 'removal' as const,
        sortTime: ta.revokedAt,
        ta,
      })),
    ]
    return entries.sort((a, b) => b.sortTime.localeCompare(a.sortTime))
  }, [historyApps, removedTAs])

  function startReview(appId: string, decision: 'approved' | 'denied') {
    setReviewingId(appId); setPendingDecision(decision); setReviewComment(''); setError(null)
  }
  function cancelReview() {
    setReviewingId(null); setPendingDecision(null); setReviewComment(''); setError(null)
  }

  async function submitReview() {
    if (!reviewingId || !pendingDecision) return
    setProcessing(true); setError(null)
    try {
      const result = await reviewBadgeApplication(reviewingId, pendingDecision, reviewComment || undefined)
      if (result.error) { setError(result.error); return }
      const reviewed = applications.find(a => a.id === reviewingId)
      if (reviewed) {
        setApplications(prev => prev.filter(a => a.id !== reviewingId))
        const updatedApp = { ...reviewed, status: pendingDecision, reviewed_at: new Date().toISOString() }
        setHistoryApps(prev => [updatedApp, ...prev])
        if (pendingDecision === 'approved') {
          const r = await getAllBadgeHolders('bubble_room_ta')
          if (!r.error) setActiveTAs(r.data ?? [])
        }
      }
      cancelReview()
    } catch { setError('Failed to process. Please try again.') }
    finally { setProcessing(false) }
  }

  function startRevoke(id: string) { setRevokingId(id); setRevokeReason(''); setRevokeError(null) }
  function cancelRevoke() { setRevokingId(null); setRevokeReason(''); setRevokeError(null) }

  async function submitRevoke() {
    if (!revokingId) return
    setRevokeProcessing(true); setRevokeError(null)
    try {
      const result = await revokeBadge(revokingId, revokeReason || undefined)
      if (result.error) { setRevokeError(result.error); return }
      const removed = activeTAs.find(t => t.userBadgeId === revokingId)
      setActiveTAs(prev => prev.filter(t => t.userBadgeId !== revokingId))
      if (removed) {
        setRemovedTAs(prev => [{ ...removed, revokedAt: new Date().toISOString() }, ...prev])
      }
      cancelRevoke()
    } catch { setRevokeError('Failed to remove TA. Please try again.') }
    finally { setRevokeProcessing(false) }
  }

  function formatDate(iso: string) {
    try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
    catch { return iso }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ta-panel-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 id="ta-panel-title" className="text-base font-semibold text-gray-900">🎓 TA Management</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? 'Loading…' : `${activeTAs.length} active · ${applications.length} pending`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs — 3 tabs now */}
        <div className="flex border-b border-gray-100">
          {([
            { key: 'active' as Tab, label: `Active (${activeTAs.length})` },
            { key: 'pending' as Tab, label: `Pending (${applications.length})` },
            { key: 'history' as Tab, label: `History (${mergedHistory.length})` },
          ]).map(({ key, label }) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === key ? 'text-green-700 border-b-2 border-green-500' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            </div>

          ) : tab === 'active' ? (
            activeTAs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No active TAs</p>
            ) : activeTAs.map((ta) => (
              <div key={ta.userBadgeId} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">🎓 {ta.name}</p>
                    <p className="text-xs text-gray-400">{ta.email} · Since {formatDate(ta.grantedAt)}</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">Active TA</span>
                </div>
                {revokeError && revokingId === ta.userBadgeId && (
                  <p className="text-sm text-red-600">{revokeError}</p>
                )}
                {revokingId === ta.userBadgeId ? (
                  <div className="space-y-2 pt-1">
                    <textarea value={revokeReason} onChange={e => setRevokeReason(e.target.value)}
                      rows={2} maxLength={300}
                      placeholder="Reason for removing TA status (optional, sent to student)…"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={submitRevoke} isLoading={revokeProcessing} disabled={revokeProcessing}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white">Confirm Remove</Button>
                      <Button size="sm" variant="ghost" onClick={cancelRevoke} disabled={revokeProcessing} className="flex-1">Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-1">
                    <Button size="sm" variant="outline" onClick={() => startRevoke(ta.userBadgeId)}
                      className="text-red-600 border-red-200 hover:bg-red-50">Remove TA</Button>
                  </div>
                )}
              </div>
            ))

          ) : tab === 'pending' ? (
            applications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No pending applications</p>
            ) : applications.map((app) => (
              <div key={app.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{app.applicant_name}</p>
                    <p className="text-xs text-gray-400">{app.applicant_email} · {formatDate(app.created_at)}</p>
                  </div>
                </div>
                {app.note
                  ? <p className="text-sm text-gray-700 leading-relaxed bg-white rounded-lg p-2.5 border border-gray-100">"{app.note}"</p>
                  : <p className="text-xs text-gray-400 italic">No pitch provided</p>
                }
                {error && reviewingId === app.id && <p className="text-sm text-red-600">{error}</p>}
                {reviewingId === app.id ? (
                  <div className="space-y-2 pt-1">
                    <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                      rows={2} maxLength={300}
                      placeholder={pendingDecision === 'approved' ? 'Optional message to the student…' : 'Feedback for the student (optional)…'}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={submitReview} isLoading={processing} disabled={processing}
                        className={`flex-1 text-white ${pendingDecision === 'approved' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
                        {pendingDecision === 'approved' ? 'Confirm Approve' : 'Confirm Deny'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelReview} disabled={processing} className="flex-1">Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => startReview(app.id, 'approved')} className="flex-1 bg-green-500 hover:bg-green-600 text-white">✓ Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => startReview(app.id, 'denied')} className="flex-1 text-red-600 border-red-200 hover:bg-red-50">✕ Deny</Button>
                  </div>
                )}
              </div>
            ))

          ) : (
            // History tab — application reviews + removals merged, newest first
            mergedHistory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No history yet</p>
            ) : mergedHistory.map((entry, i) => (
              entry.kind === 'application' ? (
                <div key={`app-${entry.app.id}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{entry.app.applicant_name}</p>
                      <p className="text-xs text-gray-400">{entry.app.applicant_email} · {formatDate(entry.sortTime)}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      entry.app.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {entry.app.status === 'approved' ? '✓ Approved' : '✕ Denied'}
                    </span>
                  </div>
                  {entry.app.note
                    ? <p className="text-sm text-gray-700 leading-relaxed bg-white rounded-lg p-2.5 border border-gray-100">"{entry.app.note}"</p>
                    : <p className="text-xs text-gray-400 italic">No pitch provided</p>
                  }
                  {entry.app.reviewer_comment && (
                    <p className="text-xs text-gray-500 italic">Reviewer note: "{entry.app.reviewer_comment}"</p>
                  )}
                </div>
              ) : (
                <div key={`rem-${entry.ta.userBadgeId}-${i}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{entry.ta.name}</p>
                      <p className="text-xs text-gray-400">{entry.ta.email}</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">Removed</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    TA from {formatDate(entry.ta.grantedAt)} · Removed {formatDate(entry.ta.revokedAt)}
                  </p>
                </div>
              )
            ))
          )}
        </div>
      </div>
    </div>
  )
}
