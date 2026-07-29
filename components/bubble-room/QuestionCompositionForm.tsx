'use client'

/**
 * QuestionCompositionForm — textarea + submit button for posting new questions.
 *
 * Responsibilities:
 *  1. Validate non-empty text (Req 1.4)
 *  2. Run client-side Jaccard duplicate detection (Req 2.1)
 *  3. If duplicates found → call onDuplicatesFound (Req 2.2)
 *  4. If no duplicates → upload image (if any) then call postQuestion (Req 1.1)
 *  5. Show inline errors; preserve draft on failure (Req 1.4, 3.6)
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.5
 */

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { postQuestion } from '@/lib/actions/bubbleRoom'
import { findDuplicates } from '@/lib/utils/bubbleRoom'
import type { BubbleQuestion, DuplicateMatch } from '@/lib/types/bubbleRoom'

export interface QuestionCompositionFormProps {
  /** Class the question will be posted to (null for global bubble room) */
  classId: string | null
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
   * (text, matches, title) so parent can confirm or cancel.
   */
  onDuplicatesFound: (text: string, matches: DuplicateMatch[], title?: string | null) => void
}

const MAX_LENGTH = 2000
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export function QuestionCompositionForm({
  classId,
  challengeId,
  initialText = '',
  existingQuestions,
  onSubmitted,
  onClose,
  onDuplicatesFound,
}: QuestionCompositionFormProps) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState(initialText)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, GIF, or WebP images are allowed.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image must be 10 MB or smaller.')
      return
    }
    setError(null)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function handleRemoveImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedTitle = title.trim() || null
    const trimmed = text.trim()

    if (!trimmedTitle) {
      setError('Please enter a title for your question.')
      return
    }
    if (!trimmed) {
      setError('Please enter your question before submitting.')
      textareaRef.current?.focus()
      return
    }
    if (trimmed.length > MAX_LENGTH) {
      setError(`Question must be ${MAX_LENGTH} characters or fewer.`)
      return
    }
    if (trimmedTitle.length > 120) {
      setError('Title must be 120 characters or fewer.')
      return
    }

    // Duplicate detection — runs entirely client-side
    let duplicates: DuplicateMatch[] = []
    try {
      duplicates = findDuplicates(trimmed, existingQuestions)
    } catch (dupErr) {
      console.error('[BubbleRoom] duplicate detection failed:', dupErr)
    }

    if (duplicates.length > 0) {
      onDuplicatesFound(trimmed, duplicates, trimmedTitle)
      return
    }

    await submitQuestion(trimmed, trimmedTitle)
  }

  async function submitQuestion(trimmedText: string, trimmedTitle: string | null) {
    setIsSubmitting(true)
    setError(null)

    try {
      // Upload image first if one was selected
      let uploadedImageUrl: string | null = null
      if (imageFile) {
        const supabase = createClient()
        const ext = imageFile.name.split('.').pop() ?? 'jpg'
        const path = `questions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('bubble-room-images')
          .upload(path, imageFile, { cacheControl: '3600', upsert: false })
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`)
        const { data: { publicUrl } } = supabase.storage
          .from('bubble-room-images')
          .getPublicUrl(path)
        uploadedImageUrl = publicUrl
      }

      const result = await postQuestion(classId, trimmedText, challengeId, trimmedTitle, uploadedImageUrl)

      if (result.error) {
        setError(result.error)
        return
      }

      onSubmitted(result.data!)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post your question. Please try again.')
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
          max-h-[90vh] overflow-y-auto
        "
        aria-label="Post a question"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 id="compose-form-title" className="text-lg font-semibold text-gray-900">
            💬 Ask a Question
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Challenge context chip */}
        {challengeId && (
          <p className="text-xs text-purple-500 flex items-center gap-1">
            <span aria-hidden="true">🎯</span>
            Linked to current challenge
          </p>
        )}

        {/* Title field */}
        <div className="space-y-1">
          <label htmlFor="question-title" className="text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            id="question-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Give your question a short title…"
            className="
              w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white
              text-sm text-gray-900
              focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
              transition-colors
            "
          />
          <div className="flex justify-end">
            <span className={`text-xs ${title.length > 108 ? 'text-orange-500' : 'text-gray-400'}`}>
              {title.length}/120
            </span>
          </div>
        </div>

        {/* Body textarea */}
        <div className="space-y-1.5">
          <label htmlFor="question-text" className="text-sm font-medium text-gray-700">
            Details
          </label>
          <textarea
            id="question-text"
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_LENGTH}
            rows={4}
            placeholder="Describe your question in detail…"
            autoFocus={!initialText}
            className={`
              w-full px-4 py-3 rounded-xl border text-sm text-gray-900 resize-none
              focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
              transition-colors
              ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}
            `}
          />
          <div className="flex justify-between items-center">
            {error ? (
              <p role="alert" className="text-sm text-red-600">{error}</p>
            ) : (
              <span />
            )}
            <span className={`text-xs ${text.length > MAX_LENGTH * 0.9 ? 'text-orange-500' : 'text-gray-400'}`}>
              {text.length}/{MAX_LENGTH}
            </span>
          </div>
        </div>

        {/* Image upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Image <span className="text-gray-400 font-normal">(optional)</span>
          </label>

          {imagePreview ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Selected image preview"
                className="max-h-48 rounded-xl border border-gray-200 object-contain bg-gray-50"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                aria-label="Remove image"
                className="
                  absolute -top-2 -right-2
                  w-6 h-6 rounded-full bg-gray-700 text-white
                  flex items-center justify-center text-xs
                  hover:bg-red-600 transition-colors
                "
              >
                ✕
              </button>
            </div>
          ) : (
            <label
              className="
                flex items-center gap-2 w-fit
                px-3 py-2 rounded-xl border border-dashed border-gray-300
                text-sm text-gray-500 cursor-pointer
                hover:border-primary-400 hover:text-primary-500
                transition-colors
              "
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Attach image
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
                className="sr-only"
              />
            </label>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting || text.trim().length === 0 || title.trim().length === 0}
            className="flex-1"
          >
            Post Question
          </Button>
        </div>
      </form>
    </div>
  )
}
