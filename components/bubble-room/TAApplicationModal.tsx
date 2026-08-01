'use client'

/**
 * TAApplicationModal — student applies for the Bubble Room TA badge.
 *
 * Shows the badge description, a textarea for their pitch, and submit.
 * Handles all three states: apply, pending, already-TA.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { applyForBadge } from '@/lib/actions/badges'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

export interface TAApplicationModalProps {
  onClose: () => void
  onSubmitted: () => void
}

const MAX_NOTE = 500

export function TAApplicationModal({ onClose, onSubmitted }: TAApplicationModalProps) {
  const { t } = useLanguage()
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await applyForBadge('bubble_room_ta', note.trim() || undefined)
      if (result.error) {
        setError(result.error)
        return
      }
      onSubmitted()
    } catch {
      setError('Failed to submit. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ta-apply-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <form
        onSubmit={handleSubmit}
        className="
          relative z-10 w-full sm:max-w-md
          rounded-t-2xl sm:rounded-2xl
          bg-white shadow-2xl
          p-6 space-y-4
        "
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden="true">🎓</span>
          <div>
            <h2 id="ta-apply-title" className="text-lg font-semibold text-gray-900">
              {t('bubble.applyTaTitle')}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('bubble.taBlurb')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('action.close')}
            className="ml-auto shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* What the role asks of you, before the box where you argue for it. */}
        <div className="rounded-xl bg-gray-50 px-4 py-3">
          <p className="text-sm font-medium text-gray-700">{t('bubble.taGoodMeans')}</p>
          {/* An ordered list rather than numbers typed into each string, so the
              numerals come from the browser and cannot drift between the two
              languages or be renumbered by a translation edit. */}
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-gray-600">
            <li>{t('bubble.taGood1')}</li>
            <li>{t('bubble.taGood2')}</li>
            <li>{t('bubble.taGood3')}</li>
          </ol>
        </div>

        {/* Pitch */}
        <div className="space-y-1.5">
          <label htmlFor="ta-note" className="text-sm font-medium text-gray-700">
            {t('bubble.taWhyLabel')} <span className="text-gray-400 font-normal">{t('admin.optional')}</span>
          </label>
          <textarea
            id="ta-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={MAX_NOTE}
            rows={4}
            placeholder={t('bubble.taPitchPlaceholder')}
            className="
              w-full px-3 py-2 rounded-xl border border-gray-200 bg-white
              text-sm text-gray-900 resize-none
              focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent
              transition-colors
            "
          />
          <div className="flex justify-end">
            <span className={`text-xs ${note.length > MAX_NOTE * 0.9 ? 'text-orange-500' : 'text-gray-400'}`}>
              {note.length}/{MAX_NOTE}
            </span>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="flex-1">
            {t('action.cancel')}
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
          >
            {t('bubble.taSubmitApplication')}
          </Button>
        </div>
      </form>
    </div>
  )
}
