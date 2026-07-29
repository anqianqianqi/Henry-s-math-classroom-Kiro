'use client'

/**
 * BubbleRoomPage — client-side orchestrator for the Bubble Room Q&A feature.
 *
 * Owns all shared state and wires child components together:
 *  - questions list (updated via Supabase Realtime)
 *  - search query (pauses animation, shows filtered static list)
 *  - selected question (opens QuestionDetailModal)
 *  - composition form / duplicate detection modal state
 *
 * Requirements: 1.2, 1.5, 2.2, 2.3, 2.4, 2.6, 3.5, 4.2, 4.3, 4.4, 4.5, 8.1
 */

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BubbleQuestion, DuplicateMatch } from '@/lib/types/bubbleRoom'
import { postQuestion, searchQuestions } from '@/lib/actions/bubbleRoom'
import { SearchBar } from './SearchBar'
import { BubbleAnimationEngine } from './BubbleAnimationEngine'
import NotificationBell from '@/components/NotificationBell'
import { HomeButton } from '@/components/ui/HomeButton'
import { QuestionCompositionForm } from './QuestionCompositionForm'
import { DuplicateDetectionModal } from './DuplicateDetectionModal'
import { QuestionDetailModal } from './QuestionDetailModal'

export interface BubbleRoomPageProps {
  initialQuestions: BubbleQuestion[]
  currentUserId: string
  currentUserRole: 'teacher' | 'student'
  currentUserDisplayName: string
  /** Optional challengeId passed via URL query param */
  initialChallengeId?: string | null
}

/**
 * Splits text around the keyword and wraps the matching part in a highlight span.
 * Case-insensitive. Returns plain text if no match.
 */
function highlightKeyword(text: string, keyword: string): React.ReactNode {
  if (!keyword.trim()) return text
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5 not-italic">
        {text.slice(idx, idx + keyword.length)}
      </mark>
      {text.slice(idx + keyword.length)}
    </>
  )
}

export function BubbleRoomPage({
  initialQuestions,
  currentUserId,
  currentUserRole,
  currentUserDisplayName,
  initialChallengeId,
}: BubbleRoomPageProps) {
  // ── Core state ────────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<BubbleQuestion[]>(initialQuestions)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedQuestion, setSelectedQuestion] = useState<BubbleQuestion | null>(null)
  const [showCompositionForm, setShowCompositionForm] = useState(
    !!initialChallengeId, // auto-open when coming from a challenge page
  )
  const [compositionInitialText, setCompositionInitialText] = useState('')
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(
    initialChallengeId ?? null,
  )

  // Duplicate detection state
  const [pendingQuestion, setPendingQuestion] = useState('')
  const [pendingTitle, setPendingTitle] = useState<string | null>(null)
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([])
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [isPostingDuplicate, setIsPostingDuplicate] = useState(false)

  const supabase = createClient()

  // ── Realtime subscription: global questions channel ──────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('bubble-room-questions-global')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bubble_room_questions',
        },
        (payload) => {
          const newRow = payload.new as any
          const newQuestion: BubbleQuestion = {
            id: newRow.id,
            class_id: newRow.class_id,
            user_id: newRow.user_id,
            challenge_id: newRow.challenge_id ?? null,
            title: newRow.title ?? null,
            text: newRow.text,
            created_at: newRow.created_at,
            updated_at: newRow.updated_at,
            author_display_name: 'Loading…',
            response_count: 0,
            unique_view_count: 0,
          }
          setQuestions((prev) => {
            if (prev.find((q) => q.id === newRow.id)) return prev
            return [newQuestion, ...prev]
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'bubble_room_questions',
        },
        (payload) => {
          const deletedId = (payload.old as any).id
          setQuestions((prev) => prev.filter((q) => q.id !== deletedId))
          setSelectedQuestion((prev) => (prev?.id === deletedId ? null : prev))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ── Search state ──────────────────────────────────────────────────────────
  const isAnimationActive = searchQuery.length === 0

  const filteredQuestions = isAnimationActive
    ? []
    : questions.filter((q) => {
        const lower = searchQuery.toLowerCase()
        return (
          q.text.toLowerCase().includes(lower) ||
          (q.title ?? '').toLowerCase().includes(lower)
        )
      })

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSearchChange(query: string) {
    setSearchQuery(query)
  }

  /** Called by SearchBar "Show more" — paginated server fetch */
  async function handleSearchLoadMore(query: string, offset: number) {
    const result = await searchQuestions(query, offset, 5)
    if (result.error || !result.data) return null
    return result.data
  }

  function handleOpenCompositionForm() {
    setCompositionInitialText('')
    // Preserve initialChallengeId if this bubble room was opened from a challenge page
    setActiveChallengeId(initialChallengeId ?? null)
    setShowCompositionForm(true)
  }

  function handleCloseCompositionForm() {
    setShowCompositionForm(false)
    setCompositionInitialText('')
  }

  function handleQuestionSubmitted(question: BubbleQuestion) {
    setQuestions((prev) => {
      if (prev.find((q) => q.id === question.id)) return prev
      return [question, ...prev]
    })
    setShowCompositionForm(false)
    setCompositionInitialText('')
  }

  /** Called by QuestionCompositionForm when duplicates are found */
  function handleDuplicatesFound(text: string, matches: DuplicateMatch[], title?: string | null) {
    setPendingQuestion(text)
    setPendingTitle(title ?? null)
    setDuplicateMatches(matches)
    setShowCompositionForm(false)
    setShowDuplicateModal(true)
  }

  /** "Yes, post anyway" in DuplicateDetectionModal (Req 2.3) */
  async function handleDuplicateConfirm() {
    setShowDuplicateModal(false)
    setIsPostingDuplicate(true)
    try {
      const result = await postQuestion(null, pendingQuestion, activeChallengeId, pendingTitle)
      if (!result.error && result.data) {
        handleQuestionSubmitted(result.data)
      }
    } catch (err) {
      console.error('[BubbleRoom] postQuestion after duplicate confirm:', err)
    } finally {
      setIsPostingDuplicate(false)
      setPendingQuestion('')
      setPendingTitle(null)
      setDuplicateMatches([])
    }
  }

  /** "No, go back" in DuplicateDetectionModal — restore composition form with text (Req 2.4) */
  function handleDuplicateCancel() {
    setShowDuplicateModal(false)
    setCompositionInitialText(pendingQuestion)
    setShowCompositionForm(true)
    // Keep pendingQuestion/duplicateMatches so user can navigate back
  }

  function handleBubbleClick(q: BubbleQuestion) {
    setSelectedQuestion(q)
  }

  function handleModalClose() {
    setSelectedQuestion(null)
  }

  function handleQuestionDeleted(questionId: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId))
    if (selectedQuestion?.id === questionId) setSelectedQuestion(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-indigo-50 via-purple-50 to-white">
      {/* ── Dashboard-style nav bar ──────────────────────────────────────── */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-3">
              <HomeButton />
            </div>
            <div className="flex items-center gap-1 sm:gap-3">
              <NotificationBell />
              <span className="text-xs text-gray-500 font-medium hidden sm:inline">
                {currentUserDisplayName}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Bubble Room top bar (search + ask) ──────────────────────────── */}
      <div className="sticky top-[52px] z-20 bg-white/80 backdrop-blur border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900 shrink-0 hidden sm:block">
            💬 Bubble Room
          </h1>

          {/* Search (Req 4.1) */}
          <div className="flex-1">
            <SearchBar
              value={searchQuery}
              onChange={handleSearchChange}
              suggestions={questions}
              onLoadMore={handleSearchLoadMore}
              onSuggestionClick={(q) => setSelectedQuestion(q)}
            />
          </div>

          {/* Ask a Question button (Req 1.2) */}
          <button
            type="button"
            onClick={handleOpenCompositionForm}
            aria-label="Ask a question"
            className="
              shrink-0 flex items-center gap-1.5
              px-4 py-2 rounded-xl
              bg-primary-500 text-white text-sm font-semibold
              shadow-float hover:bg-primary-600
              transition-all active:translate-y-0.5
              focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2
            "
          >
            <span aria-hidden="true">+</span>
            <span className="hidden sm:inline">Ask</span>
          </button>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="relative" style={{ height: 'calc(100vh - 64px)' }}>
        {isAnimationActive ? (
          /* Animation mode */
          <BubbleAnimationEngine
            questions={questions}
            isActive={isAnimationActive}
            onBubbleClick={handleBubbleClick}
            onAskQuestion={handleOpenCompositionForm}
            searchQuery={searchQuery}
          />
        ) : (
          /* Search results mode (Req 4.3, 4.5) */
          <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
            {filteredQuestions.length === 0 ? (
              /* No results state (Req 4.3) */
              <div className="flex flex-col items-center gap-4 pt-12">
                <p className="text-gray-500 text-sm">
                  No questions found for &ldquo;{searchQuery}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCompositionInitialText(searchQuery)
                    setShowCompositionForm(true)
                  }}
                  className="
                    px-5 py-2.5 rounded-xl
                    bg-primary-500 text-white text-sm font-semibold
                    shadow-float hover:bg-primary-600
                    transition-all
                  "
                >
                  Ask about &ldquo;{searchQuery}&rdquo;
                </button>
              </div>
            ) : (
              /* Results list */
              filteredQuestions.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelectedQuestion(q)}
                  className="
                    w-full text-left
                    rounded-xl border border-gray-100 bg-white
                    p-4 space-y-1
                    shadow-sm hover:shadow-md
                    transition-all
                    focus:outline-none focus:ring-2 focus:ring-primary-400
                  "
                >
                  <p className="text-sm font-medium text-gray-900 leading-snug">
                    {highlightKeyword(q.title ?? q.text, searchQuery)}
                  </p>
                  {q.title && (
                    <p className="text-xs text-gray-500 leading-snug mt-0.5">
                      {highlightKeyword(
                        q.text.length > 80 ? q.text.slice(0, 79) + '…' : q.text,
                        searchQuery,
                      )}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{q.author_display_name}</span>
                    {q.response_count > 0 && (
                      <>
                        <span>·</span>
                        <span>
                          {q.response_count}{' '}
                          {q.response_count === 1 ? 'response' : 'responses'}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}

      {showCompositionForm && (
        <QuestionCompositionForm
          classId={null}
          challengeId={activeChallengeId}
          initialText={compositionInitialText}
          existingQuestions={questions}
          onSubmitted={handleQuestionSubmitted}
          onClose={handleCloseCompositionForm}
          onDuplicatesFound={handleDuplicatesFound}
        />
      )}

      {showDuplicateModal && (
        <DuplicateDetectionModal
          matches={duplicateMatches}
          onConfirm={handleDuplicateConfirm}
          onCancel={handleDuplicateCancel}
        />
      )}

      {selectedQuestion && (
        <QuestionDetailModal
          question={selectedQuestion}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          currentUserDisplayName={currentUserDisplayName}
          onClose={handleModalClose}
          onResponseSubmitted={() => {
            // Increment response count locally for immediate feedback
            setQuestions((prev) =>
              prev.map((q) =>
                q.id === selectedQuestion.id
                  ? { ...q, response_count: q.response_count + 1 }
                  : q,
              ),
            )
          }}
          onDeleteQuestion={handleQuestionDeleted}
          onDeleteResponse={() => {
            // Response deletion is handled inside modal; no state needed here
          }}
        />
      )}

      {isPostingDuplicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-xl flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-700">Posting your question…</span>
          </div>
        </div>
      )}
    </div>
  )
}
