// components/desktop-pet/DesktopPet.tsx
// Floating desktop pet — Didi the Ragdoll cat.
// Lives in the bottom-right corner of every page.
// Auto-cycles through: idle → walking → sleeping → yawning → playing
// Click to trigger play/yawn. Minimizable.

'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import DidiSvg, { type DidiPose } from './DidiSvg'

// ─── Types ───────────────────────────────────────────────────────────────────

type BehaviorState =
  | { pose: 'idle';     duration: number }
  | { pose: 'sleeping'; duration: number }
  | { pose: 'yawning';  duration: number }
  | { pose: 'playing';  duration: number }
  | { pose: 'walking';  duration: number; targetX: number; facingLeft: boolean }

// ─── CSS keyframes (injected once) ───────────────────────────────────────────

const STYLES = `
@keyframes didiWalkBob {
  0%   { transform: translateY(0px); }
  25%  { transform: translateY(-3px); }
  50%  { transform: translateY(0px); }
  75%  { transform: translateY(-3px); }
  100% { transform: translateY(0px); }
}
@keyframes didiBreath {
  0%   { transform: scaleY(1); }
  50%  { transform: scaleY(1.03); }
  100% { transform: scaleY(1); }
}
@keyframes didiIdleTail {
  0%   { transform: rotate(0deg); }
  50%  { transform: rotate(4deg); }
  100% { transform: rotate(0deg); }
}
@keyframes didiPlayBounce {
  0%   { transform: translateY(0px) rotate(0deg); }
  20%  { transform: translateY(-8px) rotate(-3deg); }
  40%  { transform: translateY(0px) rotate(3deg); }
  60%  { transform: translateY(-5px) rotate(-2deg); }
  80%  { transform: translateY(0px) rotate(1deg); }
  100% { transform: translateY(0px) rotate(0deg); }
}
@keyframes didiYawnShake {
  0%   { transform: rotate(0deg); }
  15%  { transform: rotate(-2deg); }
  30%  { transform: rotate(2deg); }
  45%  { transform: rotate(-1deg); }
  60%  { transform: rotate(1deg); }
  100% { transform: rotate(0deg); }
}
@keyframes didiSleepBreath {
  0%   { transform: scaleX(1) scaleY(1); }
  50%  { transform: scaleX(1.02) scaleY(0.98); }
  100% { transform: scaleX(1) scaleY(1); }
}
@keyframes didiPopIn {
  0%   { transform: scale(0) translateY(20px); opacity: 0; }
  70%  { transform: scale(1.1) translateY(-4px); opacity: 1; }
  100% { transform: scale(1) translateY(0px); opacity: 1; }
}
@keyframes didiSpeechBubble {
  0%   { opacity: 0; transform: scale(0.8) translateY(4px); }
  20%  { opacity: 1; transform: scale(1) translateY(0px); }
  80%  { opacity: 1; transform: scale(1) translateY(0px); }
  100% { opacity: 0; transform: scale(0.8) translateY(-4px); }
}
`

// ─── Speech bubble messages ───────────────────────────────────────────────────

const IDLE_MESSAGES = ['喵~', '...', '😺', '(*^▽^*)', '喵喵喵']
const PLAY_MESSAGES  = ['喵！', '玩！', '抓到了！', '嘿嘿~', '⚡']
const YAWN_MESSAGES  = ['哈~', '困了...', '呼~', '😪']
const SLEEP_MESSAGES = ['Zzz...', '💤', '呼噜噜~']

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── Behavior schedule ───────────────────────────────────────────────────────

function nextBehavior(current: BehaviorState, windowWidth: number): BehaviorState {
  const roll = Math.random()

  if (current.pose === 'sleeping') {
    // After sleeping: yawn then idle
    if (roll < 0.6) return { pose: 'yawning', duration: 3000 }
    return { pose: 'idle', duration: 4000 + Math.random() * 3000 }
  }

  if (current.pose === 'yawning') {
    // After yawning: idle or sleep
    if (roll < 0.4) return { pose: 'sleeping', duration: 8000 + Math.random() * 6000 }
    return { pose: 'idle', duration: 3000 + Math.random() * 2000 }
  }

  if (current.pose === 'playing') {
    return { pose: 'idle', duration: 3000 + Math.random() * 2000 }
  }

  if (current.pose === 'walking') {
    if (roll < 0.3) return { pose: 'sleeping', duration: 8000 + Math.random() * 6000 }
    if (roll < 0.5) return { pose: 'yawning', duration: 3000 }
    return { pose: 'idle', duration: 3000 + Math.random() * 3000 }
  }

  // From idle
  if (roll < 0.25) {
    return { pose: 'sleeping', duration: 8000 + Math.random() * 8000 }
  }
  if (roll < 0.45) {
    return { pose: 'yawning', duration: 3000 }
  }
  if (roll < 0.75) {
    const maxX = Math.max(60, windowWidth - 160)
    const targetX = 60 + Math.random() * (maxX - 60)
    return {
      pose: 'walking',
      duration: 4000 + Math.random() * 3000,
      targetX,
      facingLeft: false, // will be computed at render time
    }
  }
  return { pose: 'idle', duration: 4000 + Math.random() * 4000 }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DesktopPet() {
  const [minimized, setMinimized]     = useState(false)
  const [mounted, setMounted]         = useState(false)
  const [posX, setPosX]               = useState<number | null>(null)
  const [behavior, setBehavior]       = useState<BehaviorState>({ pose: 'idle', duration: 3000 })
  const [facingLeft, setFacingLeft]   = useState(false)
  const [speech, setSpeech]           = useState<string | null>(null)
  const [speechKey, setSpeechKey]     = useState(0)

  const behaviorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const walkTimer     = useRef<ReturnType<typeof setInterval> | null>(null)
  const speechTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Mount: set initial position ──────────────────────────────────────────
  useEffect(() => {
    setMounted(true)
    setPosX(window.innerWidth - 150)
  }, [])

  // ── Show speech bubble ────────────────────────────────────────────────────
  const showSpeech = useCallback((msg: string) => {
    setSpeech(msg)
    setSpeechKey(k => k + 1)
    if (speechTimer.current) clearTimeout(speechTimer.current)
    speechTimer.current = setTimeout(() => setSpeech(null), 3000)
  }, [])

  // ── Advance behavior ──────────────────────────────────────────────────────
  const advanceBehavior = useCallback((current: BehaviorState) => {
    const next = nextBehavior(current, window.innerWidth)
    setBehavior(next)

    // Show speech for certain poses
    if (next.pose === 'sleeping') showSpeech(randomFrom(SLEEP_MESSAGES))
    if (next.pose === 'yawning')  showSpeech(randomFrom(YAWN_MESSAGES))
    if (next.pose === 'idle' && Math.random() < 0.3) showSpeech(randomFrom(IDLE_MESSAGES))

    return next
  }, [showSpeech])

  // ── Behavior timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || minimized) return

    if (behaviorTimer.current) clearTimeout(behaviorTimer.current)

    behaviorTimer.current = setTimeout(() => {
      advanceBehavior(behavior)
    }, behavior.duration)

    return () => {
      if (behaviorTimer.current) clearTimeout(behaviorTimer.current)
    }
  }, [behavior, mounted, minimized, advanceBehavior])

  // ── Walking movement ──────────────────────────────────────────────────────
  useEffect(() => {
    if (walkTimer.current) clearInterval(walkTimer.current)

    if (behavior.pose !== 'walking' || posX === null) return

    const targetX = behavior.targetX
    const goLeft  = targetX < posX
    setFacingLeft(goLeft)

    const STEP = 1.5
    walkTimer.current = setInterval(() => {
      setPosX(prev => {
        if (prev === null) return prev
        const diff = targetX - prev
        if (Math.abs(diff) < STEP + 1) {
          clearInterval(walkTimer.current!)
          return targetX
        }
        return prev + (diff > 0 ? STEP : -STEP)
      })
    }, 16)

    return () => {
      if (walkTimer.current) clearInterval(walkTimer.current)
    }
  }, [behavior, posX])

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleClick = useCallback(() => {
    if (minimized) {
      setMinimized(false)
      return
    }
    const roll = Math.random()
    if (roll < 0.5) {
      setBehavior({ pose: 'playing', duration: 2500 })
      showSpeech(randomFrom(PLAY_MESSAGES))
    } else {
      setBehavior({ pose: 'yawning', duration: 3000 })
      showSpeech(randomFrom(YAWN_MESSAGES))
    }
  }, [minimized, showSpeech])

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (behaviorTimer.current) clearTimeout(behaviorTimer.current)
      if (walkTimer.current)     clearInterval(walkTimer.current)
      if (speechTimer.current)   clearTimeout(speechTimer.current)
    }
  }, [])

  if (!mounted || posX === null) return null

  // ── Compute animation style per pose ─────────────────────────────────────
  const pose: DidiPose = behavior.pose === 'walking' ? 'walking' : behavior.pose

  const catStyle: React.CSSProperties = (() => {
    switch (behavior.pose) {
      case 'sleeping':
        return { animation: 'didiSleepBreath 3s ease-in-out infinite', transformOrigin: 'center' }
      case 'yawning':
        return { animation: 'didiYawnShake 0.6s ease-in-out 2', transformOrigin: 'center bottom' }
      case 'playing':
        return { animation: 'didiPlayBounce 0.5s ease-in-out 3', transformOrigin: 'center bottom' }
      case 'walking':
        return { animation: 'didiWalkBob 0.4s ease-in-out infinite', transformOrigin: 'center bottom' }
      default:
        return { animation: 'didiBreath 3s ease-in-out infinite', transformOrigin: 'center bottom' }
    }
  })()

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: `${posX}px`,
    zIndex: 9999,
    cursor: 'pointer',
    userSelect: 'none',
    transition: behavior.pose === 'walking' ? 'none' : 'left 0.3s ease',
    animation: mounted ? 'didiPopIn 0.5s ease-out forwards' : undefined,
  }

  return (
    <>
      <style>{STYLES}</style>

      <div style={containerStyle} onClick={handleClick} title="点击逗逗迪迪！">

        {/* Speech bubble */}
        {speech && !minimized && (
          <div
            key={speechKey}
            style={{
              position: 'absolute',
              bottom: minimized ? 36 : 118,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'white',
              border: '2px solid #E8E0D0',
              borderRadius: '12px',
              padding: '4px 10px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#4A2C1A',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(44,24,16,0.15)',
              animation: 'didiSpeechBubble 3s ease-in-out forwards',
              pointerEvents: 'none',
              zIndex: 10000,
            }}
          >
            {speech}
            {/* Bubble tail */}
            <div style={{
              position: 'absolute',
              bottom: -8,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '8px solid white',
            }} />
          </div>
        )}

        {minimized ? (
          /* ── Minimized: just a small cat icon ── */
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'white',
            border: '2px solid #E8E0D0',
            boxShadow: '0 2px 8px rgba(44,24,16,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            marginBottom: 8,
          }}>
            🐱
          </div>
        ) : (
          /* ── Full cat ── */
          <div style={{ position: 'relative' }}>
            {/* Minimize button */}
            <button
              onClick={e => { e.stopPropagation(); setMinimized(true) }}
              style={{
                position: 'absolute',
                top: 4,
                right: -4,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid #E8E0D0',
                cursor: 'pointer',
                fontSize: '10px',
                lineHeight: '16px',
                textAlign: 'center',
                color: '#8B6060',
                zIndex: 10001,
                padding: 0,
                boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              }}
              title="隐藏迪迪"
              aria-label="隐藏迪迪"
            >
              ×
            </button>

            {/* Cat SVG with animation */}
            <div style={catStyle}>
              <DidiSvg
                pose={pose}
                size={120}
                facingLeft={behavior.pose === 'walking' ? facingLeft : false}
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
