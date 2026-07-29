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
/** Max simultaneous instances of the same question on screen */
const MAX_PER_QUESTION = 2

const X_MIN = 5
const X_MAX = 95
const DRIFT_MAG_MIN = 5
const DRIFT_MAG_MAX = 15
/** Rise speed range — scales with question count to keep stream flowing */
const SPEED_MIN = 8    // faster floor so slots free up when few questions
const SPEED_MAX = 18

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
  const [visible, setVisible] = useState<BubbleInstance[]>([])
  const cycleQueueRef = useRef<BubbleQuestion[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Ref mirror of visible so interval closure always sees current state
  const visibleRef = useRef<BubbleInstance[]>([])

  useEffect(() => {
    visibleRef.current = visible
  }, [visible])

  // ── Spawn one bubble ───────────────────────────────────────────────────────
  const spawnBubble = useCallback(() => {
    if (!isActive) return
    if (questions.length === 0) return

    // Count how many of each question are currently on screen
    const onScreenCount = new Map<string, number>()
    for (const b of visibleRef.current) {
      onScreenCount.set(b.question.id, (onScreenCount.get(b.question.id) ?? 0) + 1)
    }

    // Refill queue if empty
    if (cycleQueueRef.current.length === 0) {
      cycleQueueRef.current = weightedShuffle(questions)
    }

    // Walk the queue to find the next question that isn't capped on screen.
    // If ALL remaining queue items are capped, skip spawning this tick — the
    // screen already has ≥ MAX_PER_QUESTION of every question simultaneously.
    let chosen: BubbleQuestion | null = null
    const skipped: BubbleQuestion[] = []

    while (cycleQueueRef.current.length > 0) {
      const candidate = cycleQueueRef.current.shift()!
      if ((onScreenCount.get(candidate.id) ?? 0) < MAX_PER_QUESTION) {
        chosen = candidate
        break
      }
      skipped.push(candidate)
    }

    // Put skipped ones back at the front so they get reconsidered next tick
    cycleQueueRef.current = [...skipped, ...cycleQueueRef.current]

    if (!chosen) return  // all questions are already at cap — wait for some to leave

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

    // Auto-remove after animation ends
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

    // Staggered initial burst
    for (let i = 0; i < MIN_VISIBLE; i++) {
      setTimeout(() => spawnBubble(), i * 300)
    }

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
    if (visible.length < MIN_VISIBLE) {
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
          <h3 className="text-xl font-semibold text-gray-800">No questions yet!</h3>
          <p className="text-sm text-gray-500 max-w-xs">
            Be the first to ask a question. Your bubble will float up for everyone to see.
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
            Ask the First Question
          </button>
        )}
      </div>
    )
  }

  // ── Animation canvas ───────────────────────────────────────────────────────
  return (
    <div
      className="relative w-full h-full overflow-hidden"
      aria-label="Bubble animation area"
      aria-live="polite"
      aria-relevant="additions"
    >
      {visible.map((instance) => (
        <QuestionBubble
          key={instance.id}
          instance={instance}
          searchQuery={searchQuery}
          onClick={() => onBubbleClick(instance.question)}
        />
      ))}
    </div>
  )
}
