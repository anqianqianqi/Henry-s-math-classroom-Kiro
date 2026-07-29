'use client'

/**
 * QuestionBubble — animated floating bubble that bursts (膨脹 → pop) on click.
 *
 * Click sequence:
 *  1. Bubble pauses its rise animation
 *  2. Expands (scale 1 → 1.5) over 200ms
 *  3. Pops: scale jumps to 1.8, opacity drops to 0 over 150ms
 *     + 8 radial particle fragments fly outward
 *  4. After 380ms total → calls onClick to open the detail modal
 */

import React, { useCallback, useRef, useState } from 'react'
import type { BubbleInstance } from '@/lib/types/bubbleRoom'

export interface QuestionBubbleProps {
  instance: BubbleInstance
  onClick: () => void
  searchQuery?: string
}

const PREVIEW_MAX_LENGTH = 55
const EXPAND_MS = 200
const POP_MS = 150
const TOTAL_MS = EXPAND_MS + POP_MS

// 8 particles, evenly spaced radially
const PARTICLES = Array.from({ length: 8 }, (_, i) => ({
  angle: (i * 360) / 8,
  size: 6 + Math.floor(Math.random() * 8),
}))

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

type BurstPhase = 'idle' | 'expand' | 'pop'

export function QuestionBubble({ instance, onClick, searchQuery = '' }: QuestionBubbleProps) {
  const { question, id, x, drift, speed } = instance
  const [phase, setPhase] = useState<BurstPhase>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const preview =
    question.text.length > PREVIEW_MAX_LENGTH
      ? question.text.slice(0, PREVIEW_MAX_LENGTH - 1) + '…'
      : question.text

  const hasActivity = question.response_count > 0 || question.unique_view_count > 0

  const handleClick = useCallback(() => {
    if (phase !== 'idle') return
    setPhase('expand')
    timerRef.current = setTimeout(() => {
      setPhase('pop')
      timerRef.current = setTimeout(() => {
        onClick()
      }, POP_MS)
    }, EXPAND_MS)
  }, [phase, onClick])

  const isPopping = phase === 'pop'
  const isExpanding = phase === 'expand'

  // Bubble transform based on phase
  let bubbleStyle: React.CSSProperties = {}
  if (isExpanding) {
    bubbleStyle = {
      transform: 'translateX(-50%) scale(1.5)',
      transition: `transform ${EXPAND_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
      opacity: 1,
    }
  } else if (isPopping) {
    bubbleStyle = {
      transform: 'translateX(-50%) scale(1.8)',
      transition: `transform ${POP_MS}ms ease-out, opacity ${POP_MS}ms ease-out`,
      opacity: 0,
    }
  } else {
    bubbleStyle = {
      transform: 'translateX(-50%)',
    }
  }

  return (
    <div
      key={id}
      role="button"
      tabIndex={0}
      aria-label={`Question bubble: ${preview}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
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
          animationPlayState: phase !== 'idle' ? 'paused' : 'running',
          animationDuration: `${speed}s`,
          animationTimingFunction: 'ease-out',
          animationFillMode: 'forwards',
        } as React.CSSProperties
      }
    >
      {/* Burst particles — radiate outward on pop */}
      {isPopping && PARTICLES.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180
        const tx = Math.cos(rad) * 50
        const ty = Math.sin(rad) * 50
        return (
          <div
            key={i}
            aria-hidden="true"
            className="bubble-particle"
            style={{
              width: p.size,
              height: p.size,
              top: '50%',
              left: '50%',
              marginTop: -p.size / 2,
              marginLeft: -p.size / 2,
              background: `hsl(${200 + i * 20}, 70%, 65%)`,
              '--px': `${tx}px`,
              '--py': `${ty}px`,
            } as React.CSSProperties}
          />
        )
      })}

      {/* Counts tag — floating outside bubble, centered at top */}
      {hasActivity && phase === 'idle' && (
        <div
          className="
            absolute -top-4 left-1/2 -translate-x-1/2
            flex items-center gap-1
            bg-white/90 backdrop-blur-sm
            rounded-full px-2 py-0.5
            border border-white/60 shadow-sm
            text-[9px] font-semibold text-gray-600
            pointer-events-none whitespace-nowrap z-10
          "
          aria-label={`${question.response_count} responses, ${question.unique_view_count} views`}
        >
          {question.response_count > 0 && (
            <span className="flex items-center gap-0.5 text-purple-600">
              <span aria-hidden="true">💬</span>{question.response_count}
            </span>
          )}
          {question.response_count > 0 && question.unique_view_count > 0 && (
            <span className="text-gray-300" aria-hidden="true">·</span>
          )}
          {question.unique_view_count > 0 && (
            <span className="flex items-center gap-0.5 text-blue-500">
              <span aria-hidden="true">👁</span>{question.unique_view_count}
            </span>
          )}
        </div>
      )}

      {/* Bubble circle — warm tint for challenge-linked bubbles */}
      <div
        className={`
          relative flex flex-col items-center justify-center
          w-24 h-24 sm:w-28 sm:h-28
          rounded-full
          border-2 border-white/60
          shadow-lg
          backdrop-blur-sm
          origin-center
          ${question.challenge_id
            ? 'bg-gradient-to-br from-orange-200 via-yellow-100 to-amber-100 shadow-amber-200/50'
            : 'bg-gradient-to-br from-blue-200 via-purple-100 to-pink-100 shadow-purple-200/50'
          }
        `}
        style={bubbleStyle}
      >
        {/* Bubble glare */}
        <div
          className="absolute top-2 left-3 w-6 h-3 rounded-full bg-white/50 blur-sm pointer-events-none"
          aria-hidden="true"
        />

        {/* Question text */}
        <p className="px-3 text-center text-[10px] font-medium text-gray-700 leading-tight break-words">
          {searchQuery ? highlightInBubble(preview, searchQuery) : preview}
        </p>

        {/* Challenge link — bottom of circle */}
        {question.challenge_id && (
          <div className="mt-0.5 text-[9px] font-semibold text-amber-700 flex items-center gap-0.5">
            <span aria-hidden="true">🎯</span>
            <span>Challenge</span>
          </div>
        )}
      </div>
    </div>
  )
}
