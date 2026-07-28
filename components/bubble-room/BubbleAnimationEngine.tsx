'use client'

/**
 * BubbleAnimationEngine — manages the CSS animation cycle for floating question bubbles.
 *
 * Cycle logic (Requirements 5.1–5.7):
 *  1. Maintain a cycleQueue: copy of weighted-shuffled questions
 *  2. Every ~2 s, pop from cycleQueue and spawn a new BubbleInstance
 *  3. When cycleQueue is empty: recompute weightedShuffle → new cycle
 *  4. Keep visible: BubbleInstance[]; remove after animation ends (speed + buffer)
 *  5. Clamp visible count to [3, 7]
 *  6. When isActive=false: pause spawning (search active); bubbles already visible remain
 *  7. When questions=[] → empty-state CTA
 *  8. Cleanup on unmount: cancel interval
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { weightedShuffle } from '@/lib/utils/bubbleRoom'
import type { BubbleInstance, BubbleQuestion } from '@/lib/types/bubbleRoom'
import { QuestionBubble } from './QuestionBubble'

export interface BubbleAnimationEngineProps {
  /** Weighted-shuffled question list from BubbleRoomPage */
  questions: BubbleQuestion[]
  /** False when search is active — spawn loop pauses */
  isActive: boolean
  /** Called when user clicks a bubble */
  onBubbleClick: (q: BubbleQuestion) => void
  /** Optional callback to open the "ask question" form (empty-state CTA) */
  onAskQuestion?: () => void
  /** Current search query — used to highlight matching keywords in bubbles */
  searchQuery?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const SPAWN_INTERVAL_MS = 1500   // New bubble launches every 1.5s — continuous stream
const MIN_VISIBLE = 4            // Minimum to maintain
const MAX_VISIBLE = 999          // No effective cap — just keep launching
const ANIMATION_BUFFER_MS = 500

// Param ranges (Req 5.4)
const X_MIN = 5                  // % viewport width, keep away from edges
const X_MAX = 95
const DRIFT_MAG_MIN = 5          // % vw lateral drift magnitude
const DRIFT_MAG_MAX = 15
const SPEED_MIN = 14              // seconds (slowed down for readability)
const SPEED_MAX = 22

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate random parameters for a bubble instance (Req 5.4) */
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

/**
 * BubbleAnimationEngine renders an absolutely-positioned canvas layer over the
 * Bubble Room page. Each BubbleInstance mounts as a QuestionBubble with
 * CSS custom property-driven animation that auto-removes after the animation.
 */
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
  const visibleCountRef = useRef(0)

  // Track visible count in a ref so the interval closure can read it
  useEffect(() => {
    visibleCountRef.current = visible.length
  }, [visible.length])

  // ── Spawn one bubble ───────────────────────────────────────────────────────
  const spawnBubble = useCallback(() => {
    if (!isActive) return
    if (questions.length === 0) return
    if (visibleCountRef.current >= MAX_VISIBLE) return

    // Replenish queue if empty
    if (cycleQueueRef.current.length === 0) {
      cycleQueueRef.current = weightedShuffle(questions)
    }

    const question = cycleQueueRef.current.shift()!
    const { x, drift, speed } = randomBubbleParams()

    const instance: BubbleInstance = {
      question,
      id: nextInstanceId(),
      x,
      drift,
      speed,
      startedAt: Date.now(),
    }

    setVisible((prev) => {
      if (prev.length >= MAX_VISIBLE) return prev
      return [...prev, instance]
    })

    // Auto-remove after animation ends
    setTimeout(() => {
      setVisible((prev) => prev.filter((b) => b.id !== instance.id))
    }, (speed * 1000) + ANIMATION_BUFFER_MS)
  }, [isActive, questions])

  // ── Main interval loop ─────────────────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!isActive || questions.length === 0) return

    // Re-seed the cycle queue when questions change
    cycleQueueRef.current = weightedShuffle(questions)

    // Immediately spawn until MIN_VISIBLE is reached
    for (let i = 0; i < MIN_VISIBLE; i++) {
      // stagger slightly so they don't all appear at the same x
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

  // ── Empty state (Req 5.6) ──────────────────────────────────────────────────
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6 select-none">
        {/* Illustration */}
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
