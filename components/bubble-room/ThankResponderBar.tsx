'use client'

/**
 * "I understand now! I want to give thanks to …" — the owner resolving their
 * own question.
 *
 * Sits bottom-left of the open question. Only the owner sees it, and only once
 * somebody has replied: with no replies there is nobody to thank, so the
 * control is absent rather than present and dead.
 *
 * Thanking is final. That is enforced by a UNIQUE constraint rather than by
 * this component hiding the button — a student could otherwise re-thank to mint
 * TA points for a friend.
 */

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import {
  fetchThankableResponders,
  thankResponder,
  type Responder,
} from '@/lib/actions/bubbleThanks'

export interface ThankResponderBarProps {
  questionId: string
  /** Whether the viewer wrote this question. */
  isOwner: boolean
  /** Set once resolved, so the bar can show its finished state. */
  resolvedAt: string | null
  /** Number of replies — the bar stays hidden until there is at least one. */
  responseCount: number
  onResolved: () => void
}

export function ThankResponderBar({
  questionId,
  isOwner,
  resolvedAt,
  responseCount,
  onResolved,
}: ThankResponderBarProps) {
  const { t } = useLanguage()
  const [responders, setResponders] = useState<Responder[]>([])
  const [picked, setPicked] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOwner || resolvedAt || responseCount === 0) return
    fetchThankableResponders(questionId).then(setResponders)
  }, [questionId, isOwner, resolvedAt, responseCount])

  if (resolvedAt) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-green-700">
        <span aria-hidden="true">✓</span>
        {t('thanks.resolved')}
      </div>
    )
  }

  // Not the owner, or nobody has answered yet.
  if (!isOwner || responseCount === 0) return null

  async function handleThank() {
    if (!picked) return
    setBusy(true)
    setError(null)
    const result = await thankResponder(questionId, picked)
    setBusy(false)

    if (result.error) {
      setError(t(result.error === 'ALREADY_RESOLVED' ? 'thanks.errAlready' : 'thanks.errFailed'))
      return
    }
    onResolved()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleThank}
        /* Disabled until a name is picked. A button that silently does nothing
           reads as broken; a disabled one explains itself. */
        disabled={!picked || busy}
        className="
          rounded-xl border border-green-200 bg-green-50 px-3 py-1.5
          text-xs font-semibold text-green-700
          transition-colors hover:bg-green-100
          disabled:cursor-not-allowed disabled:opacity-50
        "
      >
        {busy ? t('thanks.thanking') : t('thanks.button')}
      </button>

      <select
        value={picked}
        onChange={e => setPicked(e.target.value)}
        disabled={busy}
        className="rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700"
      >
        <option value="">{t('thanks.pickSomeone')}</option>
        {responders.map(r => (
          <option key={r.userId} value={r.userId}>
            {r.displayName}{r.isStaff ? ` ${t('thanks.staffNote')}` : ''}
          </option>
        ))}
      </select>

      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  )
}
