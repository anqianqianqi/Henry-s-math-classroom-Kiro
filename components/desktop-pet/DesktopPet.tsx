// components/desktop-pet/DesktopPet.tsx
// Floating desktop pet — Didi the Ragdoll cat.
// Uses real PNG images from /public/didi/ for each pose.
// Falls back to emoji until images are added.
//
// Behaviors: idle → walking → sleeping → yawning → playing
// Click to interact. Minimize button to hide.

'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import DidiSvg, { type DidiPose } from './DidiSvg'

// ─── CSS keyframes ────────────────────────────────────────────────────────────

const STYLES = `
@keyframes didi-float {
  0%   { transform: translateY(0px); }
  50%  { transform: translateY(-6px); }
  100% { transform: translateY(0px); }
}
@keyframes didi-breathe {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.025); }
  100% { transform: scale(1); }
}
@keyframes didi-walk-bob {
  0%   { transform: translateY(0px); }
  25%  { transform: translateY(-4px); }
  50%  { transform: translateY(0px); }
  75%  { transform: translateY(-4px); }
  100% { transform: translateY(0px); }
}
@keyframes didi-play-bounce {
  0%   { transform: translateY(0px) rotate(0deg); }
  20%  { transform: translateY(-10px) rotate(-4deg); }
  40%  { transform: translateY(0px) rotate(4deg); }
  60%  { transform: translateY(-6px) rotate(-2deg); }
  80%  { transform: translateY(0px) rotate(2deg); }
  100% { transform: translateY(0px) rotate(0deg); }
}
@keyframes didi-yawn-shake {
  0%   { transform: rotate(0deg) scale(1); }
  20%  { transform: rotate(-3deg) scale(1.05); }
  40%  { transform: rotate(3deg) scale(1.05); }
  60%  { transform: rotate(-2deg) scale(1.02); }
  80%  { transform: rotate(1deg) scale(1.01); }
  100% { transform: rotate(0deg) scale(1); }
}
@keyframes didi-sleep-breathe {
  0%   { transform: scaleX(1) scaleY(1); }
  50%  { transform: scaleX(1.03) scaleY(0.97); }
  100% { transform: scaleX(1) scaleY(1); }
}
@keyframes didi-pop-in {
  0%   { transform: scale(0.3) translateY(30px); opacity: 0; }
  60%  { transform: scale(1.08) translateY(-4px); opacity: 1; }
  80%  { transform: scale(0.96) translateY(2px); }
  100% { transform: scale(1) translateY(0px); opacity: 1; }
}
@keyframes didi-speech-in {
  0%   { opacity: 0; transform: translateX(-50%) scale(0.7) translateY(6px); }
  60%  { opacity: 1; transform: translateX(-50%) scale(1.05) translateY(-2px); }
  100% { opacity: 1; transform: translateX(-50%) scale(1) translateY(0px); }
}
@keyframes didi-speech-out {
  0%   { opacity: 1; transform: translateX(-50%) scale(1) translateY(0px); }
  100% { opacity: 0; transform: translateX(-50%) scale(0.8) translateY(-8px); }
}
@keyframes didi-zzz {
  0%   { opacity: 0; transform: translate(0px, 0px) scale(0.5); }
  30%  { opacity: 1; }
  100% { opacity: 0; transform: translate(12px, -24px) scale(1.2); }
}
@keyframes didi-zzz2 {
  0%   { opacity: 0; transform: translate(0px, 0px) scale(0.4); }
  30%  { opacity: 0.8; }
  100% { opacity: 0; transform: translate(18px, -36px) scale(1); }
}
@keyframes didi-heart {
  0%   { opacity: 0; transform: translateX(-50%) scale(0) translateY(0px); }
  30%  { opacity: 1; transform: translateX(-50%) scale(1.2) translateY(-4px); }
  70%  { opacity: 1; transform: translateX(-50%) scale(1) translateY(-12px); }
  100% { opacity: 0; transform: translateX(-50%) scale(0.8) translateY(-20px); }
}
`

// ─── Speech messages ──────────────────────────────────────────────────────────

const MESSAGES = {
  idle:     ['meow~', '( ´ ▽ ` )', '...', '🐾', 'mrrp!', 'hello?'],
  playing:  ['meow!', 'got it!', 'catch me!', 'hehe~', '⚡', 'so fun!'],
  yawning:  ['yaaawn~', 'sleepy...', 'so tired', '😪', '*yawns*'],
  sleeping: ['Zzz...', '💤', 'purrrr~'],
  walking:  ['strolling~', 'where to?', 'on patrol', 'exploring!'],
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

// ─── Behavior types ───────────────────────────────────────────────────────────

type Behavior =
  | { pose: 'idle';     ms: number }
  | { pose: 'sleeping'; ms: number }
  | { pose: 'yawning';  ms: number }
  | { pose: 'playing';  ms: number }
  | { pose: 'walking';  ms: number; targetX: number }

// Behavior weights — target distribution:
//   sleeping 50%, yawning 20%, walking 15%, playing 10%, idle 5%
function nextBehavior(cur: Behavior, winW: number): Behavior {
  const r = Math.random()
  const pad = 80

  if (cur.pose === 'sleeping') {
    // After sleep: yawn 75%, idle 25%
    return r < 0.75
      ? { pose: 'yawning', ms: 3200 }
      : { pose: 'idle', ms: 2000 + r * 2000 }
  }
  if (cur.pose === 'yawning') {
    // After yawn: back to sleep 70%, idle 30%
    return r < 0.70
      ? { pose: 'sleeping', ms: 120000 + r * 60000 }
      : { pose: 'idle', ms: 2000 + r * 2000 }
  }
  if (cur.pose === 'playing') {
    // After play: yawn 60%, idle 40%
    return r < 0.60
      ? { pose: 'yawning', ms: 3200 }
      : { pose: 'idle', ms: 2000 + r * 1500 }
  }
  if (cur.pose === 'walking') {
    // After walk: sleep 60%, yawn 40%
    return r < 0.60
      ? { pose: 'sleeping', ms: 120000 + r * 60000 }
      : { pose: 'yawning', ms: 3200 }
  }
  // From idle — this is where the target distribution is set:
  // 0.00–0.50 → sleep (50%)
  // 0.50–0.70 → yawn  (20%)
  // 0.70–0.85 → walk  (15%)
  // 0.85–0.95 → play  (10%)
  // 0.95–1.00 → idle  (5%)
  if (r < 0.50) return { pose: 'sleeping', ms: 120000 + r * 60000 }
  if (r < 0.70) return { pose: 'yawning',  ms: 3200 }
  if (r < 0.85) {
    const tx = pad + Math.random() * (winW - pad * 2 - 140)
    return { pose: 'walking', ms: 3000 + r * 2000, targetX: tx }
  }
  if (r < 0.95) return { pose: 'playing', ms: 2500 }
  return { pose: 'idle', ms: 3000 + r * 2000 }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DesktopPet() {
  const [mounted,    setMounted]    = useState(false)
  const [minimized,  setMinimized]  = useState(false)
  const [posX,       setPosX]       = useState(0)
  const [posY,       setPosY]       = useState(0)   // distance from bottom
  const [behavior,   setBehavior]   = useState<Behavior>({ pose: 'sleeping', ms: 120000 })
  const [facingLeft, setFacingLeft] = useState(false)
  const [speech,     setSpeech]     = useState<string | null>(null)
  const [speechKey,  setSpeechKey]  = useState(0)
  const [showHeart,  setShowHeart]  = useState(false)
  const [popIn,      setPopIn]      = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [catSize,    setCatSize]    = useState(130)  // px, range 60–220
  const [showSizer,  setShowSizer]  = useState(false)

  const behaviorRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const walkRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const speechRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragOffset   = useRef({ x: 0, y: 0 })
  const dragMoved    = useRef(false)  // distinguish drag from click

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const x = window.innerWidth - 160
    setPosX(x)
    setPosY(0)
    setMounted(true)
    setTimeout(() => setPopIn(true), 100)
  }, [])

  // ── Speech helper ────────────────────────────────────────────────────────
  const say = useCallback((msg: string) => {
    setSpeech(msg)
    setSpeechKey(k => k + 1)
    if (speechRef.current) clearTimeout(speechRef.current)
    speechRef.current = setTimeout(() => setSpeech(null), 3200)
  }, [])

  // ── Advance behavior ─────────────────────────────────────────────────────
  const advance = useCallback((cur: Behavior) => {
    const next = nextBehavior(cur, window.innerWidth)
    setBehavior(next)
    if (next.pose === 'sleeping') say(pick(MESSAGES.sleeping))
    if (next.pose === 'yawning')  say(pick(MESSAGES.yawning))
    if (next.pose === 'walking')  say(pick(MESSAGES.walking))
    if (next.pose === 'idle' && Math.random() < 0.25) say(pick(MESSAGES.idle))
  }, [say])

  // ── Behavior timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || minimized) return
    if (behaviorRef.current) clearTimeout(behaviorRef.current)
    behaviorRef.current = setTimeout(() => advance(behavior), behavior.ms)
    return () => { if (behaviorRef.current) clearTimeout(behaviorRef.current) }
  }, [behavior, mounted, minimized, advance])

  // ── Walk movement ────────────────────────────────────────────────────────
  useEffect(() => {
    if (walkRef.current) clearInterval(walkRef.current)
    if (behavior.pose !== 'walking') return

    const target = behavior.targetX
    setFacingLeft(target < posX)

    const STEP = 1.2
    walkRef.current = setInterval(() => {
      setPosX(prev => {
        const diff = target - prev
        if (Math.abs(diff) <= STEP + 1) { clearInterval(walkRef.current!); return target }
        return prev + (diff > 0 ? STEP : -STEP)
      })
    }, 16)

    return () => { if (walkRef.current) clearInterval(walkRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [behavior])

  // ── Hover → yawn (only when sleeping) ──────────────────────────────────
  const handleHover = useCallback(() => {
    if (behavior.pose === 'sleeping') {
      if (behaviorRef.current) clearTimeout(behaviorRef.current)
      setBehavior({ pose: 'yawning', ms: 3200 })
      say(pick(MESSAGES.yawning))
    }
  }, [behavior.pose, say])

  // ── Drag to move ─────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't drag when clicking the minimize button
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()

    dragMoved.current = false
    dragOffset.current = { x: e.clientX - posX, y: e.clientY }

    // Interrupt auto-behavior while dragging
    if (behaviorRef.current) clearTimeout(behaviorRef.current)
    if (walkRef.current) clearInterval(walkRef.current)

    const onMove = (ev: MouseEvent) => {
      dragMoved.current = true
      setIsDragging(true)
      const newX = Math.max(0, Math.min(window.innerWidth - 140, ev.clientX - dragOffset.current.x))
      const newY = Math.max(0, window.innerHeight - ev.clientY - 10)
      setPosX(newX)
      setPosY(newY)
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setIsDragging(false)
      // Snap back to floor with a bounce, then sleep
      setPosY(0)
      setBehavior({ pose: 'playing', ms: 1200 })
      say('*thud*')
      setTimeout(() => {
        setBehavior({ pose: 'sleeping', ms: 120000 })
        say(pick(MESSAGES.sleeping))
      }, 1400)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [posX, say])


  const handleClick = useCallback(() => {
    // Ignore if this was actually a drag
    if (dragMoved.current) return
    if (minimized) { setMinimized(false); return }

    // Show heart
    setShowHeart(true)
    if (heartRef.current) clearTimeout(heartRef.current)
    heartRef.current = setTimeout(() => setShowHeart(false), 1200)

    if (Math.random() < 0.5) {
      setBehavior({ pose: 'playing', ms: 2500 })
      say(pick(MESSAGES.playing))
    } else {
      setBehavior({ pose: 'yawning', ms: 3200 })
      say(pick(MESSAGES.yawning))
    }
  }, [minimized, say])

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => () => {
    if (behaviorRef.current) clearTimeout(behaviorRef.current)
    if (walkRef.current)     clearInterval(walkRef.current)
    if (speechRef.current)   clearTimeout(speechRef.current)
    if (heartRef.current)    clearTimeout(heartRef.current)
  }, [])

  if (!mounted) return null

  // ── Animation style per pose ─────────────────────────────────────────────
  const catAnim: React.CSSProperties = (() => {
    switch (behavior.pose) {
      case 'sleeping': return { animation: 'didi-sleep-breathe 3.5s ease-in-out infinite', transformOrigin: 'center' }
      case 'yawning':  return { animation: 'didi-yawn-shake 0.55s ease-in-out 2', transformOrigin: 'center bottom' }
      case 'playing':  return { animation: 'didi-play-bounce 0.45s ease-in-out 4', transformOrigin: 'center bottom' }
      case 'walking':  return { animation: 'didi-walk-bob 0.38s ease-in-out infinite', transformOrigin: 'center bottom' }
      default:         return { animation: 'didi-float 3s ease-in-out infinite', transformOrigin: 'center bottom' }
    }
  })()

  const pose: DidiPose = behavior.pose

  return (
    <>
      <style>{STYLES}</style>

      <div
        style={{
          position: 'fixed',
          bottom: posY,
          left: posX,
          zIndex: 9999,
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          transition: isDragging || behavior.pose === 'walking' ? 'none' : 'left 0.4s cubic-bezier(0.34,1.56,0.64,1), bottom 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          animation: popIn && !isDragging ? 'didi-pop-in 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards' : undefined,
        }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => { handleHover(); setShowSizer(true) }}
        onMouseLeave={() => setShowSizer(false)}
        role="button"
        aria-label="Didi — click to interact"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && handleClick()}
      >
        {/* ── Heart on click ── */}
        {showHeart && (
          <div style={{
            position: 'absolute',
            top: minimized ? -10 : -20,
            left: '50%',
            fontSize: 22,
            animation: 'didi-heart 1.2s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 10002,
          }}>
            ❤️
          </div>
        )}

        {/* ── Speech bubble — floats above and to the left, tail points down-right toward Didi ── */}
        {speech && !minimized && (
          <div
            key={speechKey}
            style={{
              position: 'absolute',
              bottom: 155,       // well above Didi's head
              right: 10,         // anchored to the right side so it doesn't cover the cat
              transform: 'none',
              background: 'white',
              border: '2px solid #f0e6d3',
              borderRadius: 14,
              padding: '5px 12px',
              fontSize: 13,
              fontWeight: 700,
              color: '#5c3d2e',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 16px rgba(92,61,46,0.18)',
              animation: 'didi-speech-in 0.3s ease-out forwards',
              pointerEvents: 'none',
              zIndex: 10001,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {speech}
            {/* Tail pointing down-right toward Didi's face */}
            <div style={{
              position: 'absolute',
              bottom: -9,
              right: 18,
              width: 0,
              height: 0,
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderTop: '9px solid white',
            }} />
            <div style={{
              position: 'absolute',
              bottom: -12,
              right: 17,
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '10px solid #f0e6d3',
              zIndex: -1,
            }} />
          </div>
        )}

        {minimized ? (
          /* ── Minimized pill ── */
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'white',
            border: '2px solid #f0e6d3',
            borderRadius: 24,
            padding: '6px 12px 6px 8px',
            boxShadow: '0 4px 16px rgba(92,61,46,0.18)',
            marginBottom: 12,
            fontSize: 13,
            fontWeight: 600,
            color: '#5c3d2e',
            fontFamily: 'system-ui, sans-serif',
          }}>
            <span style={{ fontSize: 20 }}>🐱</span>
            <span>Didi</span>
          </div>
        ) : (
          /* ── Full pet ── */
          <div style={{ position: 'relative', paddingBottom: 4 }}>
            {/* Minimize button */}
            <button
              onClick={e => { e.stopPropagation(); setMinimized(true) }}
              style={{
                position: 'absolute',
                top: 8,
                right: -2,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.95)',
                border: '1.5px solid #e8d5c0',
                cursor: 'pointer',
                fontSize: 11,
                lineHeight: '18px',
                textAlign: 'center',
                color: '#a07060',
                zIndex: 10001,
                padding: 0,
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Hide Didi"
              aria-label="Hide Didi"
            >
              ×
            </button>

            {/* ZZZ for sleeping */}
            {behavior.pose === 'sleeping' && (
              <>
                <div style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#8b9dc3',
                  animation: 'didi-zzz 2s ease-in-out infinite',
                  pointerEvents: 'none',
                }}>z</div>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 4,
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#8b9dc3',
                  animation: 'didi-zzz2 2s ease-in-out 0.7s infinite',
                  pointerEvents: 'none',
                }}>z</div>
              </>
            )}

            {/* Cat image with animation */}
            <div style={{
              ...catAnim,
              filter: isDragging ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))' : undefined,
              transform: isDragging ? 'scale(1.08)' : undefined,
            }}>
              <DidiSvg
                pose={pose}
                size={catSize}
                facingLeft={behavior.pose === 'walking' ? facingLeft : false}
              />
            </div>

            {/* Size slider — floats below as absolute overlay, doesn't push Didi up */}
            {showSizer && !isDragging && (
              <div
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  bottom: -28,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 6px',
                  background: 'rgba(255,255,255,0.92)',
                  borderRadius: 8,
                  border: '1px solid #f0e6d3',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  whiteSpace: 'nowrap',
                  zIndex: 10002,
                }}
              >
                <span style={{ fontSize: 9, color: '#a07060' }}>S</span>
                <input
                  type="range"
                  min={60}
                  max={220}
                  step={10}
                  value={catSize}
                  onChange={e => setCatSize(Number(e.target.value))}
                  style={{ width: 70, accentColor: '#a07060', cursor: 'ew-resize' }}
                  title="Resize Didi"
                />
                <span style={{ fontSize: 9, color: '#a07060' }}>L</span>
              </div>
            )}

            {/* Name tag */}
            <div style={{
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#a07060',
              letterSpacing: '0.05em',
              marginTop: 2,
              fontFamily: 'system-ui, sans-serif',
              opacity: 0.8,
            }}>
              Didi 🐾
            </div>
          </div>
        )}
      </div>
    </>
  )
}
