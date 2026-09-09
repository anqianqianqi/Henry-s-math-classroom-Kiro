'use client'

/**
 * The right column of the desk: the assistant's card, the score, the comment,
 * and the buttons that write them.
 *
 * The score box is filled with the assistant's suggestion the moment a
 * student is opened, so the fast path is reading, then Enter. Typing digits
 * anywhere overwrites it; the assistant's card stays visible so the override
 * is a decision and not a slip.
 */

import { useState, type RefObject } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { confidenceBand, type QueueRow, type TaSuggestion } from '@/lib/studio/queue'
import { COMMENT_FIELD_ID, SCORE_FIELD_ID } from '@/lib/studio/keys'

export interface DeskMessage {
  kind: 'ok' | 'error'
  text: string
}

export interface DeskActionsProps {
  row: QueueRow | null
  ta: TaSuggestion | null
  score: string
  onScore: (value: string) => void
  comment: string
  onComment: (value: string) => void
  busy: boolean
  onSave: () => void
  onAccept: () => void
  onSkip: () => void
  onRunTa: () => void
  taRunning: boolean
  taError: string | null
  flagOpen: boolean
  onFlagOpen: (open: boolean) => void
  flagNote: string
  onFlagNote: (value: string) => void
  onFlagSend: () => void
  message: DeskMessage | null
  scoreRef: RefObject<HTMLInputElement>
  commentRef: RefObject<HTMLTextAreaElement>
}

function TaCard({ ta, row, taRunning, taError, onRunTa }: Pick<DeskActionsProps, 'ta' | 'row' | 'taRunning' | 'taError' | 'onRunTa'>) {
  const { t } = useLanguage()
  const [showSolution, setShowSolution] = useState(false)

  if (!row) return null
  if (taRunning) {
    return (
      <div className="studio-card studio-section">
        <h3 className="studio-eyebrow">{t('studio.ta')}</h3>
        <p className="mt-2 text-sm studio-thinking">{t('studio.taRunning')}</p>
      </div>
    )
  }
  if (!ta) {
    const canAsk = !!row.challengeId
    return (
      <div className="studio-card studio-section">
        <h3 className="studio-eyebrow">{t('studio.ta')}</h3>
        <p className="studio-muted mt-2 text-sm">{canAsk ? t('studio.taNone') : t('studio.taUnavailable')}</p>
        {taError && <p className="studio-error mt-2 text-sm">{t('studio.taFailed', { reason: taError })}</p>}
        {canAsk && (
          <button type="button" className="studio-btn mt-3" onClick={onRunTa}>
            {t('studio.taRun')} <kbd className="studio-kbd">T</kbd>
          </button>
        )}
      </div>
    )
  }

  const band = confidenceBand(ta.confidence)
  const bandKey = band === 'high' ? 'studio.taHigh' : band === 'mid' ? 'studio.taMid' : 'studio.taLow'
  return (
    <div className={`studio-card studio-section studio-ta studio-ta-${band}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="studio-eyebrow">{t('studio.ta')}</h3>
          <p className="text-2xl font-semibold leading-tight">{t('studio.taSuggests', { score: ta.suggestedScore, max: ta.maxScore })}</p>
        </div>
        <span className={`studio-chip studio-chip-${band}`}>
          {t('studio.taConfidence', { percent: Math.round(ta.confidence * 100) })} · {t(bandKey)}
        </span>
      </div>

      {ta.status !== 'pending' && (
        <p className="studio-muted mt-2 text-sm">
          {ta.status === 'accepted'
            ? t('studio.taAccepted', { score: ta.henryScore ?? ta.suggestedScore })
            : t('studio.taOverridden', { score: ta.henryScore ?? ta.suggestedScore })}
        </p>
      )}

      {ta.criticChanged && ta.criticFrom !== null && ta.criticTo !== null && (
        <p className="studio-note mt-2 text-sm">
          {t('studio.taReviewed', { from: ta.criticFrom, to: ta.criticTo, reason: ta.criticReason ?? '' })}
        </p>
      )}

      {ta.comment && (
        <div className="mt-3">
          <p className="studio-muted text-xs">{t('studio.taComment')}</p>
          <p className="text-sm italic whitespace-pre-wrap">{ta.comment}</p>
        </div>
      )}
      {ta.gap && (
        <div className="mt-3">
          <p className="studio-muted text-xs">{t('studio.taGap')}</p>
          <p className="text-sm whitespace-pre-wrap">{ta.gap}</p>
        </div>
      )}
      {ta.view && (
        <div className="mt-3">
          <p className="studio-muted text-xs">{t('studio.taView')}</p>
          <p className="text-sm whitespace-pre-wrap">{ta.view}</p>
        </div>
      )}
      {ta.solution && (
        <div className="mt-3">
          <button type="button" className="studio-link text-xs" onClick={() => setShowSolution(v => !v)}>
            {showSolution ? t('studio.taHideSolution') : t('studio.taShowSolution')}
          </button>
          {showSolution && (
            <div className="mt-1">
              <p className="studio-muted text-xs">{t('studio.taSolution')}</p>
              <p className="text-sm whitespace-pre-wrap">{ta.solution}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function DeskActions(props: DeskActionsProps) {
  const { t } = useLanguage()
  const { row, ta } = props
  const canFlag = !!ta?.id && ta.status === 'pending'
  const canAccept = !!ta && ta.status === 'pending'

  return (
    <aside className="studio-actions" aria-label={t('studio.score')}>
      <TaCard ta={ta} row={row} taRunning={props.taRunning} taError={props.taError} onRunTa={props.onRunTa} />

      <div className="studio-card studio-section">
        <label className="block" htmlFor={SCORE_FIELD_ID}>
          <span className="studio-eyebrow">{t('studio.score')}</span>
          <div className="mt-1 flex items-baseline gap-2">
            <input
              id={SCORE_FIELD_ID}
              ref={props.scoreRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="studio-input studio-score"
              value={props.score}
              onChange={e => props.onScore(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={!row || props.busy}
              aria-label={t('studio.score')}
            />
            <span className="studio-muted text-sm">{row ? t('studio.outOf', { max: row.maxPoints }) : ''}</span>
          </div>
        </label>
        <p className="studio-muted mt-1 text-xs">{t('studio.scoreHint')}</p>

        <label className="mt-4 block" htmlFor={COMMENT_FIELD_ID}>
          <span className="studio-eyebrow">{t('studio.comment')}</span>
          <textarea
            id={COMMENT_FIELD_ID}
            ref={props.commentRef}
            className="studio-input mt-1 w-full"
            rows={5}
            value={props.comment}
            onChange={e => props.onComment(e.target.value)}
            disabled={!row || props.busy}
          />
        </label>
        <p className="studio-muted mt-1 text-xs">{t('studio.commentHint')}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="studio-btn studio-btn-primary" disabled={!row || props.busy} onClick={props.onSave}>
            {props.busy ? t('studio.saving') : t('studio.save')} <kbd className="studio-kbd studio-kbd-onprimary">{t('studio.kEnter')}</kbd>
          </button>
          {canAccept && (
            <button type="button" className="studio-btn studio-btn-accent" disabled={props.busy} onClick={props.onAccept}>
              {t('studio.accept')} <kbd className="studio-kbd">A</kbd>
            </button>
          )}
          <button type="button" className="studio-btn" disabled={!row || props.busy} onClick={props.onSkip}>
            {t('studio.skip')} <kbd className="studio-kbd">S</kbd>
          </button>
          {canFlag && (
            <button type="button" className="studio-btn" disabled={props.busy} onClick={() => props.onFlagOpen(!props.flagOpen)}>
              {t('studio.flag')} <kbd className="studio-kbd">F</kbd>
            </button>
          )}
        </div>

        {props.flagOpen && canFlag && (
          <div className="mt-3">
            <label className="block">
              <span className="studio-muted text-xs">{t('studio.flagNote')}</span>
              <textarea
                className="studio-input mt-1 w-full"
                rows={3}
                value={props.flagNote}
                onChange={e => props.onFlagNote(e.target.value)}
              />
            </label>
            <button type="button" className="studio-btn studio-btn-sm mt-2" disabled={props.busy || !props.flagNote.trim()} onClick={props.onFlagSend}>
              {t('studio.flagSend')}
            </button>
          </div>
        )}

        {props.message && (
          <p className={`mt-3 text-sm ${props.message.kind === 'error' ? 'studio-error' : 'studio-ok'}`} role="status">
            {props.message.text}
          </p>
        )}
      </div>

      <div className="studio-keys">
        <p className="studio-eyebrow">{t('studio.keys')}</p>
        <dl>
          <div><dt><kbd className="studio-kbd">J</kbd> <kbd className="studio-kbd">K</kbd></dt><dd>{t('studio.keyNext')} · {t('studio.keyPrev')}</dd></div>
          <div><dt><kbd className="studio-kbd">0</kbd>–<kbd className="studio-kbd">9</kbd></dt><dd>{t('studio.keyDigits')}</dd></div>
          <div><dt><kbd className="studio-kbd">{t('studio.kEnter')}</kbd></dt><dd>{t('studio.keyEnter')}</dd></div>
          <div><dt><kbd className="studio-kbd">A</kbd></dt><dd>{t('studio.keyAccept')}</dd></div>
          <div><dt><kbd className="studio-kbd">C</kbd></dt><dd>{t('studio.keyComment')}</dd></div>
          <div><dt><kbd className="studio-kbd">F</kbd></dt><dd>{t('studio.keyFlag')}</dd></div>
          <div><dt><kbd className="studio-kbd">S</kbd></dt><dd>{t('studio.keySkip')}</dd></div>
          <div><dt><kbd className="studio-kbd">T</kbd></dt><dd>{t('studio.keyTa')}</dd></div>
        </dl>
        <p className="studio-muted mt-1 text-xs">{t('studio.keysHint')}</p>
      </div>
    </aside>
  )
}
