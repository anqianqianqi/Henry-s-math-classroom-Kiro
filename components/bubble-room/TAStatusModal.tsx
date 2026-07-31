'use client'

/**
 * TAStatusModal — shows a student their current TA application status.
 * Opens when they click the "🎓 Pending…" button in the Bubble Room header.
 */

import { useLanguage } from '@/lib/i18n/LanguageProvider'

export interface TAStatusModalProps {
  note: string | null       // their submitted pitch
  appliedAt: string | null  // ISO date string
  onClose: () => void
  onWithdraw?: () => void   // optional: allow withdrawing the application
  isWithdrawing?: boolean
}

export function TAStatusModal({
  note,
  appliedAt,
  onClose,
  onWithdraw,
  isWithdrawing,
}: TAStatusModalProps) {
  const { t } = useLanguage()
  function formatDate(iso: string | null) {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    } catch { return iso }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ta-status-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="
        relative z-10 w-full sm:max-w-sm
        rounded-t-2xl sm:rounded-2xl
        bg-white shadow-2xl
        p-6 space-y-4
      ">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden="true">🎓</span>
          <div className="flex-1 min-w-0">
            <h2 id="ta-status-title" className="text-base font-semibold text-gray-900">
              TA Application — Pending
            </h2>
            {appliedAt && (
              <p className="text-xs text-gray-400 mt-0.5">
                Submitted {formatDate(appliedAt)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('action.close')}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status banner */}
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
          <span className="text-sm" aria-hidden="true">⏳</span>
          <p className="text-sm text-amber-800 font-medium">
            {t('bubble.taWaiting')}
          </p>
        </div>

        {/* Their pitch */}
        {note ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('bubble.taYourPitch')}</p>
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">
              "{note}"
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">{t('bubble.taNoPitch')}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t('action.close')}
          </button>
          {onWithdraw && (
            <button
              type="button"
              onClick={onWithdraw}
              disabled={isWithdrawing}
              className="flex-1 px-4 py-2 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {isWithdrawing ? 'Withdrawing…' : 'Withdraw'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
