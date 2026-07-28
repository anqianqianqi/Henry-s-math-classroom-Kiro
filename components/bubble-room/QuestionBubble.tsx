'use client'

/**
 * QuestionBubble — a single animated bubble rising from the bottom of the screen.
 *
 * Redesigned as a speech-tag shape (rounded rectangle + tail) so the question
 * text is easy to read at a glance while floating.
 *
 * Requirements: 5.1, 5.4
 */

import type { BubbleInstance } from '@/lib/types/bubbleRoom'

export interface QuestionBubbleProps {
  instance: BubbleInstance
  onClick: () => void
}

const PREVIEW_MAX_LENGTH = 80

// Engagement tier thresholds
function getEngagementTier(responses: number, views: number): 'hot' | 'warm' | 'normal' {
  const score = responses * 3 + views
  if (score >= 10) return 'hot'
  if (score >= 3) return 'warm'
  return 'normal'
}

const TIER_STYLES = {
  hot: {
    bg: 'from-amber-400 via-orange-300 to-pink-300',
    border: 'border-amber-300',
    shadow: 'shadow-orange-200/60',
    text: 'text-gray-800',
    tail: '#f97316', // orange-500
    badge: '🔥',
  },
  warm: {
    bg: 'from-purple-300 via-blue-200 to-cyan-200',
    border: 'border-purple-300',
    shadow: 'shadow-purple-200/50',
    text: 'text-gray-800',
    tail: '#a78bfa', // violet-400
    badge: '💬',
  },
  normal: {
    bg: 'from-blue-200 via-indigo-100 to-purple-100',
    border: 'border-blue-200',
    shadow: 'shadow-blue-100/50',
    text: 'text-gray-700',
    tail: '#93c5fd', // blue-300
    badge: null,
  },
}

export function QuestionBubble({ instance, onClick }: QuestionBubbleProps) {
  const { question, id, x, drift, speed } = instance

  const preview =
    question.text.length > PREVIEW_MAX_LENGTH
      ? question.text.slice(0, PREVIEW_MAX_LENGTH - 1) + '…'
      : question.text

  const tier = getEngagementTier(question.response_count, question.unique_view_count)
  const styles = TIER_STYLES[tier]

  return (
    <div
      key={id}
      role="button"
      tabIndex={0}
      aria-label={`Question: ${preview}`}
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
          bottom: '-120px',
          transform: 'translateX(-50%)',
          animationDuration: `${speed}s`,
          animationTimingFunction: 'ease-out',
          animationFillMode: 'forwards',
          width: '160px',
        } as React.CSSProperties
      }
    >
      {/* ── Speech tag bubble ─────────────────────────────────── */}
      <div className="relative">
        {/* Main pill */}
        <div
          className={`
            relative
            rounded-2xl
            bg-gradient-to-br ${styles.bg}
            border ${styles.border}
            shadow-lg ${styles.shadow}
            px-3 py-2.5
            hover:scale-105 focus:scale-105
            transition-transform duration-200
            backdrop-blur-sm
          `}
        >
          {/* Glare */}
          <div
            className="absolute top-1.5 left-3 w-8 h-2 rounded-full bg-white/40 blur-[2px] pointer-events-none"
            aria-hidden="true"
          />

          {/* Hot/warm badge */}
          {styles.badge && (
            <span className="absolute -top-2 -right-2 text-base leading-none" aria-hidden="true">
              {styles.badge}
            </span>
          )}

          {/* Author avatar initial */}
          <div className="flex items-start gap-2">
            <div
              className="shrink-0 w-6 h-6 rounded-full bg-white/60 flex items-center justify-center text-[10px] font-bold text-gray-600 mt-0.5"
              aria-hidden="true"
            >
              {question.author_display_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>

            {/* Question text */}
            <p className={`text-xs font-medium ${styles.text} leading-snug break-words flex-1`}>
              {preview}
            </p>
          </div>

          {/* Stats row */}
          {(question.response_count > 0 || question.unique_view_count > 0) && (
            <div className="flex items-center gap-2 mt-1.5 ml-8">
              {question.response_count > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-gray-500 font-medium">
                  <span aria-hidden="true">💬</span> {question.response_count}
                </span>
              )}
              {question.unique_view_count > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-gray-500 font-medium">
                  <span aria-hidden="true">👁️</span> {question.unique_view_count}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Speech tail — small triangle pointing down-left */}
        <svg
          aria-hidden="true"
          viewBox="0 0 16 10"
          width="16"
          height="10"
          className="absolute -bottom-[9px] left-6"
          style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.08))' }}
        >
          <path d="M0 0 L16 0 L4 10 Z" fill={styles.tail} />
        </svg>
      </div>
    </div>
  )
}
