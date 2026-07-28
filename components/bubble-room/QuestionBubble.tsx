'use client'

/**
 * QuestionBubble — a single animated bubble rising from the bottom of the screen.
 *
 * Round circle design with:
 * - Keyword highlight when a search query is active
 * - Prominent response + view count badges
 *
 * Requirements: 5.1, 5.4
 */

import React from 'react'
import type { BubbleInstance } from '@/lib/types/bubbleRoom'

export interface QuestionBubbleProps {
  instance: BubbleInstance
  onClick: () => void
  /** If set, highlights this keyword inside the bubble text */
  searchQuery?: string
}

const PREVIEW_MAX_LENGTH = 55

/** Splits text around keyword and wraps the match in a highlight span */
function highlightInBubble(text: string, keyword: string): React.ReactNode {
  if (!keyword.trim()) return text
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-300 text-yellow-900 rounded-sm px-0.5 not-italic font-semibold">
        {text.slice(idx, idx + keyword.length)}
      </mark>
      {text.slice(idx + keyword.length)}
    </>
  )
}

export function QuestionBubble({ instance, onClick, searchQuery = '' }: QuestionBubbleProps) {
  const { question, id, x, drift, speed } = instance

  const preview =
    question.text.length > PREVIEW_MAX_LENGTH
      ? question.text.slice(0, PREVIEW_MAX_LENGTH - 1) + '…'
      : question.text

  const hasActivity = question.response_count > 0 || question.unique_view_count > 0

  return (
    <div
      key={id}
      role="button"
      tabIndex={0}
      aria-label={`Question bubble: ${preview}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="bubble-rise absolute cursor-pointer select-none"
      style={
        {
          '--x': `${x}%`,
          '--drift': `${drift}vw`,
          '--speed': `${speed}s`,
          left: `${x}%`,
          bottom: '-80px',
          transform: 'translateX(-50%)',
          animationDuration: `${speed}s`,
          animationTimingFunction: 'ease-out',
          animationFillMode: 'forwards',
        } as React.CSSProperties
      }
    >
      {/* Bubble circle */}
      <div
        className="
          relative flex items-center justify-center
          w-24 h-24 sm:w-28 sm:h-28
          rounded-full
          bg-gradient-to-br from-blue-200 via-purple-100 to-pink-100
          border-2 border-white/60
          shadow-lg shadow-purple-200/50
          hover:scale-110 focus:scale-110
          transition-transform duration-200
          backdrop-blur-sm
        "
      >
        {/* Bubble glare */}
        <div
          className="absolute top-2 left-3 w-6 h-3 rounded-full bg-white/50 blur-sm pointer-events-none"
          aria-hidden="true"
        />

        {/* Question text with optional keyword highlight */}
        <p className="px-3 text-center text-xs font-medium text-gray-700 leading-tight break-words">
          {searchQuery ? highlightInBubble(preview, searchQuery) : preview}
        </p>
      </div>

      {/* Activity bar — shown below bubble when there are responses or views */}
      {hasActivity && (
        <div
          className="
            mt-1 mx-auto w-fit
            flex items-center gap-1.5
            bg-white/80 backdrop-blur-sm
            rounded-full px-2 py-0.5
            border border-white/60 shadow-sm
            text-[10px] font-semibold text-gray-600
          "
          aria-label={`${question.response_count} responses, ${question.unique_view_count} views`}
        >
          {question.response_count > 0 && (
            <span className="flex items-center gap-0.5 text-purple-600">
              <span aria-hidden="true">💬</span>
              {question.response_count}
            </span>
          )}
          {question.response_count > 0 && question.unique_view_count > 0 && (
            <span className="text-gray-300" aria-hidden="true">·</span>
          )}
          {question.unique_view_count > 0 && (
            <span className="flex items-center gap-0.5 text-blue-500">
              <span aria-hidden="true">👁</span>
              {question.unique_view_count}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
