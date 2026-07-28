'use client'

/**
 * QuestionDetailModal — expanded question with responses and reply form.
 *
 * On mount:
 *  - Calls recordView() silently for engagement tracking
 *  - Opens a Supabase Realtime channel for live response updates
 *  - Fetches existing responses via getResponses() Server Action
 *
 * Responsibilities:
 *  - Display full question text, author, timestamp (Req 3.1)
 *  - Display each response with role indicator (Req 3.2)
 *  - Response form: validate + postResponse (Req 3.3, 3.4, 3.5, 3.6)
 *  - Delete actions respecting authorship/role rules (Req 6.1-6.4, 7.1-7.5)
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  recordView,
  getResponses,
  postResponse,
  deleteQuestion,
  deleteResponse,
} from '@/lib/actions/bubbleRoom'
import type { BubbleQuestion, BubbleResponse } from '@/lib/types/bubbleRoom'
import { Button } from '@/components/ui/Button'

export interface QuestionDetailModalProps {
  question: BubbleQuestion
  currentUserId: string
  currentUserRole: 'teacher' | 'student'
  currentUserDisplayName: string
  onClose: () => void
  onResponseSubmitted: () => void
  onDeleteQuestion: (questionId: string) => void
  onDeleteResponse: (responseId: string) => void
}

export function QuestionDetailModal({
  question,
  currentUserId,
  currentUserRole,
  currentUserDisplayName,
  onClose,
  onResponseSubmitted,
  onDeleteQuestion,
  onDeleteResponse,
}: QuestionDetailModalProps) {
  const [responses, setResponses] = useState<BubbleResponse[]>([])
  const [responseText, setResponseText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [responseError, setResponseError] = useState<string | null>(null)
  const [deleteQuestionError, setDeleteQuestionError] = useState<string | null>(null)
  const [deleteResponseError, setDeleteResponseError] = useState<string | null>(null)
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false)
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(null)
  const [loadingResponses, setLoadingResponses] = useState(true)
  const [confirmDeleteQuestion, setConfirmDeleteQuestion] = useState(false)
  const [confirmDeleteResponseId, setConfirmDeleteResponseId] = useState<string | null>(null)
  const responseInputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  // ── On mount: record view + fetch responses + open Realtime channel ──────
  useEffect(() => {
    // Fire-and-forget engagement tracking (Req: engagement scoring)
    recordView(question.id).catch(() => {})

    // Fetch existing responses
    ;(async () => {
      const result = await getResponses(question.id)
      if (!result.error) {
        setResponses(result.data ?? [])
      }
      setLoadingResponses(false)
    })()

    // Supabase Realtime: listen for response INSERT / DELETE
    const channel = supabase
      .channel(`bubble-room-responses:${question.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bubble_room_responses',
          filter: `question_id=eq.${question.id}`,
        },
        async (payload) => {
          // Re-fetch to get joined profile data
          const result = await getResponses(question.id)
          if (!result.error) setResponses(result.data ?? [])
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'bubble_room_responses',
          filter: `question_id=eq.${question.id}`,
        },
        (payload) => {
          setResponses((prev) => prev.filter((r) => r.id !== (payload.old as any).id))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [question.id])

  // ── Helpers ──────────────────────────────────────────────────────────────

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  /** Can the current user delete a piece of content? */
  function canDelete(contentUserId: string): boolean {
    return currentUserId === contentUserId || currentUserRole === 'teacher'
  }

  // ── Response submit ───────────────────────────────────────────────────────

  async function handleResponseSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResponseError(null)

    const trimmed = responseText.trim()
    if (!trimmed) {
      setResponseError('Response cannot be empty.')
      responseInputRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    try {
      const result = await postResponse(question.id, trimmed)
      if (result.error) {
        setResponseError(result.error)
        return
      }
      setResponseText('')
      onResponseSubmitted()
    } catch {
      setResponseError('Failed to post your response. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Delete question ───────────────────────────────────────────────────────

  async function handleDeleteQuestion() {
    if (!confirmDeleteQuestion) {
      setConfirmDeleteQuestion(true)
      return
    }
    setIsDeletingQuestion(true)
    setDeleteQuestionError(null)
    try {
      const result = await deleteQuestion(question.id)
      if (result.error) {
        setDeleteQuestionError(result.error)
        setConfirmDeleteQuestion(false)
        return
      }
      onDeleteQuestion(question.id)
      onClose()
    } catch {
      setDeleteQuestionError('Failed to delete. Please try again.')
      setConfirmDeleteQuestion(false)
    } finally {
      setIsDeletingQuestion(false)
    }
  }

  // ── Delete response ───────────────────────────────────────────────────────

  async function handleDeleteResponse(responseId: string) {
    if (confirmDeleteResponseId !== responseId) {
      setConfirmDeleteResponseId(responseId)
      return
    }
    setDeletingResponseId(responseId)
    setDeleteResponseError(null)
    try {
      const result = await deleteResponse(responseId)
      if (result.error) {
        setDeleteResponseError(result.error)
        setConfirmDeleteResponseId(null)
        return
      }
      setResponses((prev) => prev.filter((r) => r.id !== responseId))
      onDeleteResponse(responseId)
      setConfirmDeleteResponseId(null)
    } catch {
      setDeleteResponseError('Failed to delete. Please try again.')
      setConfirmDeleteResponseId(null)
    } finally {
      setDeletingResponseId(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-detail-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="
          relative z-10 w-full sm:max-w-xl
          rounded-t-2xl sm:rounded-2xl
          bg-white shadow-2xl
          flex flex-col
          max-h-[90vh]
          overflow-hidden
        "
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-xs text-gray-400 mb-0.5">
              {question.author_display_name} · {formatDate(question.created_at)}
            </p>
            <h2
              id="question-detail-title"
              className="text-base font-semibold text-gray-900 leading-snug"
            >
              {question.text}
            </h2>
            {/* Challenge linkage — shown when question was created from a challenge */}
            {question.challenge_id && (
              <a
                href={`/challenges/${question.challenge_id}`}
                className="
                  inline-flex items-center gap-1 mt-2
                  text-xs font-medium text-primary-600 hover:text-primary-700
                  bg-primary-50 hover:bg-primary-100
                  rounded-full px-2.5 py-1
                  transition-colors
                "
                onClick={(e) => e.stopPropagation()}
              >
                <span aria-hidden="true">🎯</span>
                View Challenge
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
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

        {/* ── Delete question action (Req 6.1, 7.1) ───────────────────── */}
        {canDelete(question.user_id) && (
          <div className="px-5 pt-3 pb-1">
            {deleteQuestionError && (
              <p role="alert" className="text-sm text-red-600 mb-2">
                {deleteQuestionError}
              </p>
            )}
            {confirmDeleteQuestion ? (
              <div className="flex gap-2 items-center">
                <span className="text-sm text-red-600 font-medium">Delete this question and all its responses?</span>
                <button
                  type="button"
                  onClick={handleDeleteQuestion}
                  disabled={isDeletingQuestion}
                  className="text-sm font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  {isDeletingQuestion ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteQuestion(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDeleteQuestion}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
                aria-label="Delete this question"
              >
                🗑 Delete Question
              </button>
            )}
          </div>
        )}

        {/* ── Responses list (Req 3.1, 3.2) ───────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {loadingResponses ? (
            <div className="text-center py-6">
              <div className="inline-block w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" aria-label="Loading responses" />
            </div>
          ) : responses.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No responses yet. Be the first to reply!
            </p>
          ) : (
            responses.map((response) => (
              <div
                key={response.id}
                className="group rounded-xl bg-gray-50 p-3 space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Role indicator (Req 3.2) */}
                    {response.responder_role === 'teacher' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full px-2 py-0.5">
                        ⭐ {response.responder_display_name}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-gray-600">
                        {response.responder_display_name}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{formatDate(response.created_at)}</span>
                  </div>

                  {/* Delete response action (Req 6.3, 7.3) */}
                  {canDelete(response.user_id) && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {confirmDeleteResponseId === response.id ? (
                        <div className="flex gap-1 items-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteResponse(response.id)}
                            disabled={deletingResponseId === response.id}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            {deletingResponseId === response.id ? 'Deleting…' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteResponseId(null)}
                            className="text-xs text-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteResponse(response.id)}
                          aria-label={`Delete response by ${response.responder_display_name}`}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">{response.text}</p>
              </div>
            ))
          )}

          {deleteResponseError && (
            <p role="alert" className="text-sm text-red-600">
              {deleteResponseError}
            </p>
          )}
        </div>

        {/* ── Response form (Req 3.3, 3.4, 3.5, 3.6) ─────────────────── */}
        <form
          onSubmit={handleResponseSubmit}
          className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-2"
          aria-label="Post a response"
        >
          <textarea
            ref={responseInputRef}
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Write a response…"
            className={`
              w-full px-3 py-2 rounded-xl border text-sm text-gray-900 resize-none
              focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
              transition-colors
              ${responseError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}
            `}
          />
          {responseError && (
            <p role="alert" className="text-sm text-red-600">
              {responseError}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              variant="primary"
              isLoading={isSubmitting}
              disabled={isSubmitting || responseText.trim().length === 0}
            >
              Reply
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
