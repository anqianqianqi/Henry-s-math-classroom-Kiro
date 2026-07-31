'use client'

/**
 * QuestionBubble — animated floating bubble that bursts (膨脹 → pop) on click.
 *
 * The outer wrapper handles the rise animation (CSS).
 * The inner circle handles the burst scale/opacity animation (React state).
 * The counts tag is absolutely positioned on the outer wrapper at top-center.
 */

import React, { useCallback, useRef, useState } from 'react'
import type { BubbleInstance } from '@/lib/types/bubbleRoom'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useOnDemandTranslation } from '@/lib/i18n/useOnDemandTranslation'

export interface QuestionBubbleProps {
  instance: BubbleInstance
  onClick: () => void
  searchQuery?: string
}

const PREVIEW_MAX_LENGTH = 55
const EXPAND_MS = 200
const POP_MS = 150

const WOBBLE_VARIANTS = ['bubble-wobble-a', 'bubble-wobble-b', 'bubble-wobble-c'] as const

/** Deterministic pseudo-random 0–1 from a string seed */
function seededRand(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  }
  return Math.abs(h) / 2147483648
}

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
  const { language } = useLanguage()
  // Show the reader's language; the original stays on the record for search.
  // Translated on first sight if nobody has read this one in `language` yet.
  const local = useOnDemandTranslation('question', question.id, question, language)
  const [phase, setPhase] = useState<BurstPhase>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Per-instance wobble: deterministic from bubble id so it's stable across renders
  const r1 = seededRand(id)
  const r2 = seededRand(id + 'delay')
  const r3 = seededRand(id + 'dur')
  const wobbleName = WOBBLE_VARIANTS[Math.floor(r1 * 3)]
  // wobble starts after 2–8 s, then repeats every 5–12 s
  const wobbleDelay = 2 + r2 * 6         // 2–8 s
  const wobbleDuration = 1.2 + r3 * 0.8  // 1.2–2.0 s per wobble cycle

  // If there's a title, show it as the bubble label; otherwise fall back to body
  // text preview. Both read the localized copy — the untranslated fields are for
  // search, not for display.
  const bubbleLabel = local.title
    ? local.title
    : local.text.length > PREVIEW_MAX_LENGTH
      ? local.text.slice(0, PREVIEW_MAX_LENGTH - 1) + '…'
      : local.text

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

  // Inner circle style for burst animation only
  let circleStyle: React.CSSProperties = { transform: 'scale(1)' }
  if (isExpanding) {
    circleStyle = {
      transform: 'scale(1.5)',
      transition: `transform ${EXPAND_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
    }
  } else if (isPopping) {
    circleStyle = {
      transform: 'scale(1.8)',
      opacity: 0,
      transition: `transform ${POP_MS}ms ease-out, opacity ${POP_MS}ms ease-out`,
    }
  }

  return (
    <div
      key={id}
      role="button"
      tabIndex={0}
      aria-label={`Question bubble: ${bubbleLabel}`}
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
      {/* Burst particles */}
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

      {/* Counts tag — floating tag outside bubble at top-center */}
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

      {/* Bubble circle — burst animation + 3D sphere effect + wobble */}
      <div
        className={`
          relative flex flex-col items-center justify-center
          w-24 h-24 sm:w-28 sm:h-28
          rounded-full
          overflow-hidden
          ${question.challenge_id ? 'border-2 border-white/60' : 'border-2 border-white/60'}
          shadow-lg
          backdrop-blur-sm
          origin-center
          ${question.challenge_id
            ? 'bg-gradient-to-br from-blue-200 via-purple-100 to-pink-100 shadow-purple-200/50'
            : 'bg-gradient-to-br from-yellow-200 via-yellow-100 to-yellow-50 shadow-yellow-200/50'
          }
        `}
        style={{
          ...circleStyle,
          // Wobble only when idle — pause during burst
          animationName: phase === 'idle' ? wobbleName : 'none',
          animationDuration: `${wobbleDuration}s`,
          animationDelay: `${wobbleDelay}s`,
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
          animationDirection: 'alternate',
          perspective: '200px',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* ── 3D sphere layers ─────────────────────────────────────────── */}

        {/* Main sphere highlight — large soft white ellipse upper-right */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '48%', height: '30%',
            top: '10%', right: '8%',
            background: 'radial-gradient(ellipse at 40% 40%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 100%)',
            transform: 'rotate(-35deg)',
            filter: 'blur(1.5px)',
          }}
          aria-hidden="true"
        />

        {/* Secondary highlight — small crescent top-center */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '18%', height: '10%',
            top: '16%', left: '38%',
            background: 'rgba(255,255,255,0.55)',
            filter: 'blur(1px)',
          }}
          aria-hidden="true"
        />

        {/* Rim light — thin bright ring at the bubble edge */}
        <div
          className={`
            absolute inset-0 rounded-full pointer-events-none
            ${question.challenge_id
              ? 'shadow-[inset_0_0_0_1.5px_rgba(180,140,255,0.45),inset_-3px_-3px_6px_rgba(100,80,200,0.25)]'
              : 'shadow-[inset_0_0_0_1.5px_rgba(253,224,71,0.50),inset_0_0_0_3.5px_rgba(253,224,71,0.20),inset_-3px_-3px_6px_rgba(180,130,0,0.18)]'
            }
          `}
          aria-hidden="true"
        />

        {/* Bottom shadow — internal shadow to give bottom depth */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none rounded-b-full"
          style={{
            height: '30%',
            background: question.challenge_id
              ? 'linear-gradient(to bottom, transparent, rgba(80,40,160,0.15))'
              : 'linear-gradient(to bottom, transparent, rgba(161,98,7,0.18))',
          }}
          aria-hidden="true"
        />

        {/* ── Text content ──────────────────────────────────────────────── */}
        {/* Question title or body preview */}
        {local.title ? (
          <>
            <p className="px-3 text-center text-[10px] font-bold text-gray-800 leading-tight break-words relative z-10">
              {searchQuery ? highlightInBubble(local.title, searchQuery) : local.title}
            </p>
            <p className="px-3 text-center text-[9px] text-gray-500 leading-tight break-words mt-0.5 line-clamp-2 relative z-10">
              {local.text.length > 40
                ? local.text.slice(0, 39) + '…'
                : local.text}
            </p>
          </>
        ) : (
          <p className="px-3 text-center text-[10px] font-medium text-gray-700 leading-tight break-words relative z-10">
            {searchQuery ? highlightInBubble(bubbleLabel, searchQuery) : bubbleLabel}
          </p>
        )}

        {/* Challenge link */}
        {question.challenge_id && (
          <div className="mt-0.5 text-[9px] font-semibold text-purple-600 flex items-center gap-0.5 relative z-10">
            <span aria-hidden="true">🎯</span>
            <span>Challenge</span>
          </div>
        )}
      </div>
    </div>
  )
}
