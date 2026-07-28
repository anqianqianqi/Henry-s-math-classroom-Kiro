'use client'

/**
 * QuestionBubble — a single animated bubble rising from the bottom of the screen.
 *
 * Pure presentational component. Receives a BubbleInstance and renders a <div>
 * with CSS custom properties consumed by the @keyframes bubble-rise animation.
 *
 * Shows a truncated question preview (≤ 60 chars).
 *
 * Requirements: 5.1, 5.4
 */

import type { BubbleInstance } from '@/lib/types/bubbleRoom'

export interface QuestionBubbleProps {
  /** The live bubble instance with position/speed params */
  instance: BubbleInstance
  /** Called when the user clicks the bubble */
  onClick: () => void
}

const PREVIEW_MAX_LENGTH = 60

/**
 * QuestionBubble renders an absolutely positioned bubble that rises from the
 * bottom of the viewport using a CSS keyframe animation driven by inline custom
 * properties: --x (horizontal start, 0-100%), --drift (lateral offset, ±5-15%),
 * --speed (rise duration, 14-22s).
 */
export function QuestionBubble({ instance, onClick }: QuestionBubbleProps) {
  const { question, id, x, drift, speed } = instance

  const preview =
    question.text.length > PREVIEW_MAX_LENGTH
      ? question.text.slice(0, PREVIEW_MAX_LENGTH - 1) + '…'
      : question.text

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
        {/* Bubble glare effect */}
        <div
          className="absolute top-2 left-3 w-6 h-3 rounded-full bg-white/50 blur-sm pointer-events-none"
          aria-hidden="true"
        />

        {/* Question text */}
        <p className="px-3 text-center text-xs font-medium text-gray-700 leading-tight break-words">
          {preview}
        </p>
      </div>

      {/* Response count badge */}
      {question.response_count > 0 && (
        <div
          aria-label={`${question.response_count} response${question.response_count !== 1 ? 's' : ''}`}
          className="
            absolute -top-1 -right-1
            min-w-[1.25rem] h-5 px-1
            rounded-full
            bg-primary-500 text-white
            text-xs font-bold
            flex items-center justify-center
            border-2 border-white
            shadow
          "
        >
          {question.response_count}
        </div>
      )}
    </div>
  )
}
