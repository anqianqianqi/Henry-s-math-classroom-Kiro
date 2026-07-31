'use client'

/**
 * BubbleAnimationEngine — manages the CSS animation cycle for floating question bubbles.
 *
 * Spawn rules:
 *  - Each unique question can appear at most MAX_PER_QUESTION (2) times simultaneously.
 *  - Questions are drawn in weighted-shuffled order.
 *  - A question is skipped if it already has MAX_PER_QUESTION live instances on screen.
 *  - Once all questions have been seen in the current cycle, the queue refills and
 *    the process repeats — allowing duplicates only after full enumeration.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { weightedShuffle } from '@/lib/utils/bubbleRoom'
import type { BubbleInstance, BubbleQuestion } from '@/lib/types/bubbleRoom'
import { QuestionBubble } from './QuestionBubble'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

export interface BubbleAnimationEngineProps {
  questions: BubbleQuestion[]
  isActive: boolean
  onBubbleClick: (q: BubbleQuestion) => void
  onAskQuestion?: () => void
  searchQuery?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const SPAWN_INTERVAL_MS = 1500
const MIN_VISIBLE = 4
const ANIMATION_BUFFER_MS = 500

/**
 * Hard cap on simultaneous bubbles on screen.
 * When the pool has ≥ 15 unique questions, show each at most once (no duplicates).
 * When the pool is smaller, allow up to 2 copies of the same question.
 */
const MAX_ON_SCREEN = 15
const MAX_PER_QUESTION_SMALL_POOL = 2

const X_MIN = 5
const X_MAX = 95
const DRIFT_MAG_MIN = 10
const DRIFT_MAG_MAX = 28
/** Rise speed range — slower for a more relaxed floating feel */
const SPEED_MIN = 14   // slower floor for gentle drifting
const SPEED_MAX = 28

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomBubbleParams(): { x: number; drift: number; speed: number } {
  const x = X_MIN + Math.random() * (X_MAX - X_MIN)
  const driftMagnitude = DRIFT_MAG_MIN + Math.random() * (DRIFT_MAG_MAX - DRIFT_MAG_MIN)
  const drift = Math.random() < 0.5 ? driftMagnitude : -driftMagnitude
  const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN)
  return { x, drift, speed }
}

let instanceCounter = 0
function nextInstanceId(): string {
  return `bubble-${++instanceCounter}-${Date.now()}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BubbleAnimationEngine({
  questions,
  isActive,
  onBubbleClick,
  onAskQuestion,
  searchQuery = '',
}: BubbleAnimationEngineProps) {
  const { t } = useLanguage()
  const [visible, setVisible] = useState<BubbleInstance[]>([])
  const cycleQueueRef = useRef<BubbleQuestion[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Ref mirror of visible so interval closure always sees current state
  const visibleRef = useRef<BubbleInstance[]>([])

  useEffect(() => {
    visibleRef.current = visible
  }, [visible])

  // ── Remove visible instances for questions that no longer exist ─────────────
  useEffect(() => {
    const validIds = new Set(questions.map((q) => q.id))
    setVisible((prev) => {
      const next = prev.filter((b) => validIds.has(b.question.id))
      return next.length === prev.length ? prev : next
    })
  }, [questions])

  // ── Spawn one bubble ───────────────────────────────────────────────────────
  const spawnBubble = useCallback(() => {
    if (!isActive) return
    if (questions.length === 0) return

    // Hard cap: never exceed MAX_ON_SCREEN bubbles at once
    if (visibleRef.current.length >= MAX_ON_SCREEN) return

    // Per-question cap: 1 if pool ≥ 15 (no duplicates), 2 if pool < 15
    const maxPerQuestion = questions.length >= MAX_ON_SCREEN ? 1 : MAX_PER_QUESTION_SMALL_POOL

    // Count how many of each question are currently on screen
    const onScreenCount = new Map<string, number>()
    for (const b of visibleRef.current) {
      onScreenCount.set(b.question.id, (onScreenCount.get(b.question.id) ?? 0) + 1)
    }

    // Refill queue if empty
    if (cycleQueueRef.current.length === 0) {
      cycleQueueRef.current = weightedShuffle(questions)
    }

    let chosen: BubbleQuestion | null = null
    const skipped: BubbleQuestion[] = []

    while (cycleQueueRef.current.length > 0) {
      const candidate = cycleQueueRef.current.shift()!
      if ((onScreenCount.get(candidate.id) ?? 0) < maxPerQuestion) {
        chosen = candidate
        break
      }
      skipped.push(candidate)
    }

    cycleQueueRef.current = [...skipped, ...cycleQueueRef.current]

    if (!chosen) return

    const { x, drift, speed } = randomBubbleParams()
    const instance: BubbleInstance = {
      question: chosen,
      id: nextInstanceId(),
      x,
      drift,
      speed,
      startedAt: Date.now(),
    }

    setVisible((prev) => [...prev, instance])

    setTimeout(() => {
      setVisible((prev) => prev.filter((b) => b.id !== instance.id))
    }, speed * 1000 + ANIMATION_BUFFER_MS)
  }, [isActive, questions])

  // ── Main interval loop ─────────────────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!isActive || questions.length === 0) return

    cycleQueueRef.current = weightedShuffle(questions)

    // Spawn first bubble immediately, then one every SPAWN_INTERVAL_MS — no bulk burst
    spawnBubble()
    intervalRef.current = setInterval(spawnBubble, SPAWN_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isActive, questions, spawnBubble])

  // ── Keep at least MIN_VISIBLE when count drops ─────────────────────────────
  useEffect(() => {
    if (!isActive || questions.length === 0) return
    if (visible.length < MIN_VISIBLE && visible.length < MAX_ON_SCREEN) {
      spawnBubble()
    }
  }, [visible.length, isActive, questions.length, spawnBubble])

  // ── Empty state ────────────────────────────────────────────────────────────
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6 select-none">
        <div className="relative">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border-2 border-purple-200 bg-purple-50/50"
              style={{
                width: `${80 + i * 40}px`,
                height: `${80 + i * 40}px`,
                top: `${-i * 20}px`,
                left: `${-i * 20}px`,
                opacity: 0.6 - i * 0.15,
              }}
              aria-hidden="true"
            />
          ))}
          <div className="relative z-10 flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 border-2 border-purple-200 text-3xl">
            💬
          </div>
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold text-gray-800">{t('bubble.noQuestions')}</h3>
          <p className="text-sm text-gray-500 max-w-xs">
            {t('bubble.beFirst')}
          </p>
        </div>

        {onAskQuestion && (
          <button
            type="button"
            onClick={onAskQuestion}
            className="
              px-6 py-3 rounded-2xl
              bg-primary-500 text-white font-semibold
              shadow-float hover:bg-primary-600
              transition-all active:translate-y-0.5
              focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2
            "
          >
            {t('bubble.askFirst')}
          </button>
        )}
      </div>
    )
  }

  // ── Animation canvas ───────────────────────────────────────────────────────
  return (
    <div
      className="relative w-full h-full overflow-hidden"
      aria-label={t('bubble.animationArea')}
      aria-live="polite"
      aria-relevant="additions"
    >
      {visible.map((instance) => (
        <QuestionBubble
          key={instance.id}
          instance={instance}
          searchQuery={searchQuery}
          onClick={() => {
            // Immediately remove this instance so the count drops and
            // the keepalive effect spawns a replacement from the bottom
            setVisible((prev) => prev.filter((b) => b.id !== instance.id))
            onBubbleClick(instance.question)
          }}
        />
      ))}
    </div>
  )
}
