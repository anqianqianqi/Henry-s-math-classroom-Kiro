'use client'

/**
 * DuplicateDetectionModal — warns students when a near-duplicate question exists.
 *
 * Shows up to 3 similar questions with Jaccard scores. The student can choose
 * to post anyway ("Yes, post anyway") or go back to edit ("No, go back").
 *
 * Requirements: 2.2, 2.3, 2.4
 */

import type { DuplicateMatch } from '@/lib/types/bubbleRoom'
import { Button } from '@/components/ui/Button'
import type { Language } from '@/lib/i18n/catalog'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useOnDemandTranslation } from '@/lib/i18n/useOnDemandTranslation'

export interface DuplicateDetectionModalProps {
  /** Up to 3 matches sorted by descending score */
  matches: DuplicateMatch[]
  /** Called when the user clicks "Yes, post anyway" (Req 2.3) */
  onConfirm: () => void
  /** Called when the user clicks "No, go back" (Req 2.4) */
  onCancel: () => void
}

/**
 * Renders a modal overlay listing duplicate candidates.
 * Keyboard-accessible: focuses confirm button on mount.
 */
export function DuplicateDetectionModal({
  matches,
  onConfirm,
  onCancel,
}: DuplicateDetectionModalProps) {
  const { language } = useLanguage()
  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Dimmed background */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden="true">🔍</span>
          <div>
            <h2
              id="duplicate-modal-title"
              className="text-lg font-semibold text-gray-900"
            >
              Similar question already exists
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Before posting, take a look at{' '}
              {matches.length === 1 ? 'this similar question' : 'these similar questions'}.
              They might already have the answer you need!
            </p>
          </div>
        </div>

        {/* Match list */}
        <ul className="space-y-3" aria-label="Similar existing questions">
          {matches.map((match) => (
            <li
              key={match.question.id}
              className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-1"
            >
              <MatchText question={match.question} language={language} />
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  by {match.question.author_display_name}
                </span>
                <span className="text-gray-200">·</span>
                <span className="text-xs font-medium text-purple-600">
                  {Math.round(match.score * 100)}% similar
                </span>
                {match.question.response_count > 0 && (
                  <>
                    <span className="text-gray-200">·</span>
                    <span className="text-xs text-gray-400">
                      {match.question.response_count}{' '}
                      {match.question.response_count === 1 ? 'response' : 'responses'}
                    </span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Action buttons */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="flex-1"
          >
            No, go back
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
            autoFocus
            className="flex-1"
          >
            Yes, post anyway
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * One candidate's text, in the reader's language.
 *
 * A separate component because the on-demand translation is a hook and this
 * renders inside a .map(). Worth translating despite being a preview: the whole
 * point of this modal is deciding "have I already asked this?", which a reader
 * cannot judge from text in a language they do not read.
 */
function MatchText({
  question,
  language,
}: {
  question: DuplicateMatch['question']
  language: Language
}) {
  const { text } = useOnDemandTranslation('question', question.id, question, language)
  return <p className="text-sm text-gray-800 leading-snug">{text}</p>
}
