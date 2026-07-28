'use client'

/**
 * QuestionCompositionForm — textarea + submit button for posting new questions.
 *
 * Responsibilities:
 *  1. Validate non-empty text (Req 1.4)
 *  2. Run client-side Jaccard duplicate detection (Req 2.1)
 *  3. If duplicates found → call onDuplicatesFound (Req 2.2)
 *  4. If no duplicates → call postQuestion Server Action (Req 1.1)
 *  5. Show inline errors; preserve draft on failure (Req 1.4, 3.6)
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.5
 */

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { postQuestion } from '@/lib/actions/bubbleRoom'
import { findDuplicates } from '@/lib/utils/bubbleRoom'
import type { BubbleQuestion, DuplicateMatch } from '@/lib/types/bubbleRoom'

export interface QuestionCompositionFormProps {
  /** Class the question will be posted to */
  classId: string
  /** Pre-populate challenge context (Req 1.3) */
  challengeId?: string | null
  /** Pre-populate text from search query or "go back" cancel (Req 2.4) */
  initialText?: string
  /** Full list of existing questions for duplicate detection */
  existingQuestions: BubbleQuestion[]
  /** Called after successful submission */
  onSubmitted: (question: BubbleQuestion) => void
  /** Called when close/cancel is requested */
  onClose: () => void
  /**
   * Called when duplicates are found — parent should show DuplicateDetectionModal.
   * (text, matches) so parent can confirm or cancel.
   */
  onDuplicatesFound: (text: string, matches: DuplicateMatch[]) => void
}

const MAX_LENGTH = 2000

export function QuestionCompositionForm({
  classId,
  challengeId,
  initialText = '',
  existingQuestions,
  onSubmitted,
  onClose,
  onDuplicatesFound,
}: QuestionCompositionFormProps) {
  const [text, setText] = useState(initialText)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = text.trim()

    // Client-side validation: non-empty (Req 1.4)
    if (!trimmed) {
      setError('Please enter your question before submitting.')
      textareaRef.current?.focus()
      return
    }

    if (trimmed.length > MAX_LENGTH) {
      setError(`Question must be ${MAX_LENGTH} characters or fewer.`)
      return
    }

    // Duplicate detection (Req 2.1) — runs entirely client-side
    let duplicates: DuplicateMatch[] = []
    try {
      duplicates = findDuplicates(trimmed, existingQuestions)
    } catch (dupErr) {
      // Req 2.6: if duplicate detection fails, proceed silently
      console.error('[BubbleRoom] duplicate detection failed:', dupErr)
    }

    if (duplicates.length > 0) {
      // Hand off to parent — will show DuplicateDetectionModal
      onDuplicatesFound(trimmed, duplicates)
      return
    }

    // No duplicates → submit immediately
    await submitQuestion(trimmed)
  }

  /** Called by this form (no duplicate) and by the parent after duplicate confirm */
  async function submitQuestion(trimmedText: string) {
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await postQuestion(classId, trimmedText, challengeId)

      if (result.error) {
        setError(result.error)
        return
      }

      onSubmitted(result.data!)
    } catch (err) {
      setError('Failed to post your question. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-form-title"
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
          relative z-10 w-full sm:max-w-lg
          rounded-t-2xl sm:rounded-2xl
          bg-white shadow-2xl
          p-6 space-y-4
        "
        aria-label="Post a question"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 id="compose-form-title" className="text-lg font-semibold text-gray-900">
            {challengeId ? '💬 Ask About This Challenge' : '💬 Ask a Question'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Challenge context label */}
        {challengeId && (
          <p className="text-xs text-purple-600 bg-purple-50 rounded-lg px-3 py-1.5">
            📌 This question will be linked to the current challenge.
          </p>
        )}

        {/* Textarea */}
        <div className="space-y-1.5">
          <label htmlFor="question-text" className="text-sm font-medium text-gray-700">
            Your question
          </label>
          <textarea
            id="question-text"
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_LENGTH}
            rows={4}
            placeholder="What would you like to ask?"
            autoFocus
            className={`
              w-full px-4 py-3 rounded-xl border text-sm text-gray-900 resize-none
              focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
              transition-colors
              ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}
            `}
          />
          {/* Character counter */}
          <div className="flex justify-between items-center">
            {error ? (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            ) : (
              <span />
            )}
            <span className={`text-xs ${text.length > MAX_LENGTH * 0.9 ? 'text-orange-500' : 'text-gray-400'}`}>
              {text.length}/{MAX_LENGTH}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting || text.trim().length === 0}
            className="flex-1"
          >
            Post Question
          </Button>
        </div>
      </form>
    </div>
  )
}
