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
  postResponse,
  deleteQuestion,
  deleteResponse,
} from '@/lib/actions/bubbleRoom'
import type { BubbleQuestion, BubbleResponse } from '@/lib/types/bubbleRoom'
import { Button } from '@/components/ui/Button'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

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
  const [responseImageFile, setResponseImageFile] = useState<File | null>(null)
  const [responseImagePreview, setResponseImagePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [responseError, setResponseError] = useState<string | null>(null)
  const [deleteQuestionError, setDeleteQuestionError] = useState<string | null>(null)
  const [deleteResponseError, setDeleteResponseError] = useState<string | null>(null)
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false)
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(null)
  const [loadingResponses, setLoadingResponses] = useState(true)
  const [confirmDeleteQuestion, setConfirmDeleteQuestion] = useState(false)
  const [confirmDeleteResponseId, setConfirmDeleteResponseId] = useState<string | null>(null)
  // Challenge context: fetch the challenge title+description when challenge_id is set
  const [challengeContext, setChallengeContext] = useState<{
    title: string
    description: string
  } | null>(null)
  const responseInputRef = useRef<HTMLTextAreaElement>(null)
  const responseFileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // ── On mount: record view + fetch responses + open Realtime channel ──────
  useEffect(() => {
    // Fire-and-forget engagement tracking (Req: engagement scoring)
    recordView(question.id).catch(() => {})

    // Fetch challenge context if this bubble is linked to a challenge
    if (question.challenge_id) {
      ;(async () => {
        const supabaseClient = createClient()
        // Try daily_challenges first, then challenge_bank as fallback
        let title = ''
        let description = ''

        const { data: dc } = await supabaseClient
          .from('daily_challenges')
          .select('title, description')
          .eq('id', question.challenge_id!)
          .maybeSingle()

        if (dc) {
          title = dc.title ?? ''
          description = dc.description ?? ''
        } else {
          const { data: cb } = await supabaseClient
            .from('challenge_bank')
            .select('title, description')
            .eq('id', question.challenge_id!)
            .maybeSingle()
          if (cb) {
            title = cb.title ?? ''
            description = cb.description ?? ''
          }
        }

        if (title || description) {
          setChallengeContext({ title, description })
        }
      })()
    }

    // Fetch existing responses directly via client — no Server Action round-trip
    ;(async () => {
      const supabaseClient = createClient()
      const { data, error } = await supabaseClient
        .from('bubble_room_responses')
        .select(`
          id,
          question_id,
          user_id,
          text,
          image_url,
          created_at,
          profiles:user_id ( full_name, nickname )
        `)
        .eq('question_id', question.id)
        .order('created_at', { ascending: true })

      if (!error && data) {
        // Batch-resolve teacher roles
        const responderIds = [...new Set(data.map((r: any) => r.user_id))]
        let teacherIds = new Set<string>()
        if (responderIds.length > 0) {
          const { data: roleRows } = await supabaseClient
            .from('user_roles')
            .select('user_id, roles ( name )')
            .in('user_id', responderIds)
            .is('class_id', null)
          teacherIds = new Set(
            (roleRows ?? [])
              .filter((r: any) => r.roles?.name === 'teacher' || r.roles?.name === 'administrator')
              .map((r: any) => r.user_id),
          )
        }

        setResponses(
          data.map((row: any): BubbleResponse => ({
            id: row.id,
            question_id: row.question_id,
            user_id: row.user_id,
            text: row.text,
            image_url: row.image_url ?? null,
            created_at: row.created_at,
            responder_display_name: row.profiles?.nickname ?? row.profiles?.full_name ?? 'Unknown',
            responder_role: teacherIds.has(row.user_id) ? 'teacher' : 'student',
          })),
        )
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
          // Re-fetch to get joined profile data, but skip if already present (optimistic)
          const supabaseClient = createClient()
          const { data, error } = await supabaseClient
            .from('bubble_room_responses')
            .select(`
              id,
              question_id,
              user_id,
              text,
              created_at,
              profiles:user_id ( full_name, nickname )
            `)
            .eq('question_id', question.id)
            .order('created_at', { ascending: true })

          if (!error && data) {
            const responderIds = [...new Set(data.map((r: any) => r.user_id))]
            let teacherIds = new Set<string>()
            if (responderIds.length > 0) {
              const { data: roleRows } = await supabaseClient
                .from('user_roles')
                .select('user_id, roles ( name )')
                .in('user_id', responderIds)
                .is('class_id', null)
              teacherIds = new Set(
                (roleRows ?? [])
                  .filter((r: any) => r.roles?.name === 'teacher' || r.roles?.name === 'administrator')
                  .map((r: any) => r.user_id),
              )
            }
            setResponses(
              data.map((row: any): BubbleResponse => ({
                id: row.id,
                question_id: row.question_id,
                user_id: row.user_id,
                text: row.text,
                image_url: row.image_url ?? null,
                created_at: row.created_at,
                responder_display_name: row.profiles?.nickname ?? row.profiles?.full_name ?? 'Unknown',
                responder_role: teacherIds.has(row.user_id) ? 'teacher' : 'student',
              })),
            )
          }
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

  // ── Response image handler ────────────────────────────────────────────────

  function handleResponseImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setResponseError('Only JPEG, PNG, GIF, or WebP images are allowed.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setResponseError('Image must be 10 MB or smaller.')
      return
    }
    setResponseError(null)
    setResponseImageFile(file)
    setResponseImagePreview(URL.createObjectURL(file))
  }

  function handleRemoveResponseImage() {
    setResponseImageFile(null)
    setResponseImagePreview(null)
    if (responseFileInputRef.current) responseFileInputRef.current.value = ''
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
      // Upload image if one was attached
      let uploadedImageUrl: string | null = null
      if (responseImageFile) {
        const supabaseClient = createClient()
        const ext = responseImageFile.name.split('.').pop() ?? 'jpg'
        const path = `responses/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabaseClient.storage
          .from('bubble-room-images')
          .upload(path, responseImageFile, { cacheControl: '3600', upsert: false })
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`)
        const { data: { publicUrl } } = supabaseClient.storage
          .from('bubble-room-images')
          .getPublicUrl(path)
        uploadedImageUrl = publicUrl
      }

      const result = await postResponse(question.id, trimmed, uploadedImageUrl)
      if (result.error) {
        setResponseError(result.error)
        return
      }
      // Optimistically append the new response immediately
      if (result.data) {
        setResponses((prev) => {
          if (prev.find((r) => r.id === result.data!.id)) return prev
          return [...prev, result.data!]
        })
      }
      setResponseText('')
      setResponseImageFile(null)
      setResponseImagePreview(null)
      if (responseFileInputRef.current) responseFileInputRef.current.value = ''
      onResponseSubmitted()
    } catch (err) {
      setResponseError(err instanceof Error ? err.message : 'Failed to post your response. Please try again.')
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

            {/* Challenge context banner — shows the math problem above the user's question */}
            {challengeContext && (
              <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm" aria-hidden="true">🎯</span>
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    Challenge
                  </span>
                  <a
                    href={`/challenges/${question.challenge_id}`}
                    className="ml-auto text-xs text-primary-600 hover:text-primary-700 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View →
                  </a>
                </div>
                <p className="text-sm font-semibold text-amber-900 leading-snug">
                  {challengeContext.title}
                </p>
                {challengeContext.description && (
                  <p className="text-xs text-amber-800 leading-snug mt-1 whitespace-pre-wrap">
                    {challengeContext.description}
                  </p>
                )}
              </div>
            )}

            {question.title && (
              <h2
                id="question-detail-title"
                className="text-base font-semibold text-gray-900 leading-snug mb-1"
              >
                {question.title}
              </h2>
            )}
            <p
              id={question.title ? undefined : 'question-detail-title'}
              className={`leading-snug ${question.title ? 'text-sm text-gray-600' : 'text-base font-semibold text-gray-900'}`}
            >
              {question.text}
            </p>
            {/* Question image */}
            {question.image_url && (
              <a
                href={question.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2"
                aria-label="View full question image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={question.image_url}
                  alt="Question attachment"
                  className="max-h-64 rounded-xl border border-gray-200 object-contain bg-gray-50 hover:opacity-90 transition-opacity"
                />
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
                {/* Response image */}
                {response.image_url && (
                  <a
                    href={response.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-1.5"
                    aria-label="View full response image"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={response.image_url}
                      alt="Response attachment"
                      className="max-h-48 rounded-xl border border-gray-200 object-contain bg-gray-50 hover:opacity-90 transition-opacity"
                    />
                  </a>
                )}
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

          {/* Response image preview */}
          {responseImagePreview && (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={responseImagePreview}
                alt="Selected image preview"
                className="max-h-32 rounded-xl border border-gray-200 object-contain bg-gray-50"
              />
              <button
                type="button"
                onClick={handleRemoveResponseImage}
                aria-label="Remove image"
                className="
                  absolute -top-2 -right-2
                  w-5 h-5 rounded-full bg-gray-700 text-white
                  flex items-center justify-center text-xs
                  hover:bg-red-600 transition-colors
                "
              >
                ✕
              </button>
            </div>
          )}

          {responseError && (
            <p role="alert" className="text-sm text-red-600">
              {responseError}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            {/* Image attach button */}
            <label
              className="
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                text-xs text-gray-500 border border-gray-200 bg-white
                cursor-pointer hover:border-primary-400 hover:text-primary-500
                transition-colors
              "
              aria-label="Attach image to response"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {responseImageFile ? responseImageFile.name.slice(0, 16) + (responseImageFile.name.length > 16 ? '…' : '') : 'Image'}
              <input
                ref={responseFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleResponseImageChange}
                className="sr-only"
              />
            </label>

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
