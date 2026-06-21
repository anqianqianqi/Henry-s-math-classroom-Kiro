// components/desktop-pet/DesktopPet.tsx
// Floating desktop pet — Didi the Ragdoll cat.
// Uses real PNG images from /public/didi/ for each pose and stage.
// Falls back to emoji until images are added.
//
// Behaviors: idle → walking → sleeping → yawning → playing
// Click to interact. Minimize button to hide.

'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import DidiSvg, { type DidiPose, type DidiStage } from './DidiSvg'
import MusicPlayer from './MusicPlayer'

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
@keyframes didi-scratch {
  0%   { transform: rotate(0deg) scale(1); }
  15%  { transform: rotate(-8deg) scale(1.05) translateY(-3px); }
  30%  { transform: rotate(8deg) scale(1.05) translateY(-3px); }
  45%  { transform: rotate(-6deg) scale(1.03) translateY(-2px); }
  60%  { transform: rotate(6deg) scale(1.03) translateY(-2px); }
  75%  { transform: rotate(-4deg) scale(1.01); }
  100% { transform: rotate(0deg) scale(1); }
}
  0%   { opacity: 0; transform: translateX(-50%) scale(0) translateY(0px); }
  30%  { opacity: 1; transform: translateX(-50%) scale(1.2) translateY(-4px); }
  70%  { opacity: 1; transform: translateX(-50%) scale(1) translateY(-12px); }
  100% { opacity: 0; transform: translateX(-50%) scale(0.8) translateY(-20px); }
}
`

// ─── Speech messages ──────────────────────────────────────────────────────────

const MESSAGES = {
  idle:        ['meow~', '( ´ ▽ ` )', '...', '🐾', 'mrrp!', 'hello?'],
  playing:     ['meow!', 'got it!', 'catch me!', 'hehe~', '⚡', 'so fun!'],
  yawning:     ['yaaawn~', 'sleepy...', 'so tired', '😪', '*yawns*'],
  sleeping:    ['Zzz...', '💤', 'purrrr~'],
  walking:     ['strolling~', 'where to?', 'on patrol', 'exploring!'],
  scratching:  ['purrrr~', '😻', 'right there!', 'don\'t stop~', '♡'],
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

// ─── Behavior types ───────────────────────────────────────────────────────────

type Behavior =
  | { pose: 'idle';        ms: number }
  | { pose: 'sleeping';    ms: number }
  | { pose: 'yawning';     ms: number }
  | { pose: 'playing';     ms: number }
  | { pose: 'walking';     ms: number; targetX: number }
  | { pose: 'scratching';  ms: number }

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
    // After yawn: back to sleep 50%, idle 50%
    return r < 0.50
      ? { pose: 'sleeping', ms: 60000 + r * 30000 }
      : { pose: 'idle', ms: 2000 + r * 2000 }
  }
  if (cur.pose === 'playing') {
    // After play: idle 70%, yawning 30%
    return r < 0.70
      ? { pose: 'idle', ms: 2000 + r * 2000 }
      : { pose: 'yawning', ms: 3200 }
  }
  if (cur.pose === 'scratching') {
    // After scratching: idle 70%, playing 30%
    return r < 0.70
      ? { pose: 'idle', ms: 2000 + r * 2000 }
      : { pose: 'playing', ms: 2500 }
  }
  // From idle — no walking:
  // 0.00–0.30 → sleep    (30%)
  // 0.30–0.55 → play     (25%)
  // 0.55–0.75 → yawn     (20%)
  // 0.75–1.00 → idle     (25%)
  if (r < 0.30) return { pose: 'sleeping', ms: 60000 + r * 30000 }
  if (r < 0.55) return { pose: 'playing', ms: 2500 }
  if (r < 0.75) return { pose: 'yawning', ms: 3200 }
  return { pose: 'idle', ms: 3000 + r * 2000 }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DesktopPet({
  petStage = 'adult',
  petName,
  showAsMascot = false,
  happiness,
  hunger,
  streak,
  xp,
  xpGainToast,
  isEgg = false,
  onHatch,
  cracking = false,
  crackError,
}: {
  petStage?: DidiStage
  petName?: string
  showAsMascot?: boolean
  happiness?: number
  hunger?: number
  streak?: number
  xp?: number
  xpGainToast?: number
  isEgg?: boolean
  onHatch?: () => void
  cracking?: boolean
  crackError?: string
}) {
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
  const [showPopover, setShowPopover] = useState(false)
  const [showName, setShowName] = useState(() => {
    try { return localStorage.getItem('didi-show-name') !== 'false' } catch { return true }
  })
  // Suppress position transition when teleporting to dashboard pet area
  const [suppressTransition, setSuppressTransition] = useState(false)

  const prevXp = useRef<number | undefined>(undefined)
  const [walkFrame,  setWalkFrame]  = useState<'walking' | 'walking2'>('walking')

  const behaviorRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const walkRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const speechRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragOffset   = useRef({ x: 0, y: 0 })
  const dragMoved    = useRef(false)  // distinguish drag from click

  const pathname = usePathname()

  // Get the pet area's actual DOM rect on the dashboard page.
  // Returns null on other pages (no pet area element).
  function getPetAreaRect(): DOMRect | null {
    if (pathname !== '/dashboard') return null
    const el = document.getElementById('pet-area')
    return el ? el.getBoundingClientRect() : null
  }
  // posY is distance from viewport bottom. Convert DOMRect.bottom → posY.
  function rectToFloor(rect: DOMRect): number {
    return Math.max(0, window.innerHeight - rect.bottom)
  }

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Default to bottom-right corner; the dashboard pathname effect will reposition
    // if we're on /dashboard (it polls until #pet-area is available).
    setPosX(window.innerWidth - 160)
    setPosY(0)
    setMounted(true)
    setTimeout(() => setPopIn(true), 100)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-position when on /dashboard on every navigation to it.
  // Polls for #pet-area since the dashboard DOM may not have rendered yet.
  const positionPollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (positionPollRef.current) { clearTimeout(positionPollRef.current); positionPollRef.current = null }
    if (pathname !== '/dashboard') return

    let attempts = 0
    const MAX = 30

    function tryPosition() {
      const rect = getPetAreaRect()
      if (!rect || rect.width === 0) {
        if (++attempts < MAX) { positionPollRef.current = setTimeout(tryPosition, 50); return }
        return
      }
      positionPollRef.current = null
      const margin = 20
      const x = Math.round(rect.left + margin + Math.random() * Math.max(0, rect.width - catSize - margin * 2))
      const y = rectToFloor(rect)
      setSuppressTransition(true)
      setPosX(x)
      setPosY(y)
      requestAnimationFrame(() => setSuppressTransition(false))
    }

    tryPosition()
    return () => { if (positionPollRef.current) { clearTimeout(positionPollRef.current); positionPollRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // ── Speech helper ────────────────────────────────────────────────────────
  const say = useCallback((msg: string) => {
    setSpeech(msg)
    setSpeechKey(k => k + 1)
    if (speechRef.current) clearTimeout(speechRef.current)
    speechRef.current = setTimeout(() => setSpeech(null), 3200)
  }, [])

  // ── Show XP gain toast from wrapper (survives navigation) ────────────────
  useEffect(() => {
    if (xpGainToast != null && xpGainToast > 0) {
      say(`+${xpGainToast} XP ⭐`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xpGainToast])

  // ── Music hint on challenges pages — once per session ────────────────────
  const musicHintShownRef = useRef(false)
  useEffect(() => {
    if (!mounted || isEgg) return
    if (!pathname?.startsWith('/challenges')) return
    if (musicHintShownRef.current) return
    musicHintShownRef.current = true
    const t = setTimeout(() => {
      say('🎵 Try music while studying!')
    }, 2500)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, mounted, isEgg])

  // ── Advance behavior ─────────────────────────────────────────────────────
  const advance = useCallback((cur: Behavior) => {
    const next = nextBehavior(cur, window.innerWidth)
    setBehavior(next)
    if (next.pose === 'sleeping') say(pick(MESSAGES.sleeping))
    if (next.pose === 'yawning')  say(pick(MESSAGES.yawning))
    if (next.pose === 'walking')  say(pick(MESSAGES.walking))
    if (next.pose === 'scratching') say(pick(MESSAGES.scratching))
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

  // ── Walk frame alternation (swap images every 200ms for smooth walk cycle) ─
  useEffect(() => {
    if (behavior.pose !== 'walking') {
      setWalkFrame('walking')
      return
    }
    const frameInterval = setInterval(() => {
      setWalkFrame(f => f === 'walking' ? 'walking2' : 'walking')
    }, 200)
    return () => clearInterval(frameInterval)
  }, [behavior.pose])  // ── Hover → scratching (belly rub!) — only for hatched pets, not eggs ────
  const handleHover = useCallback(() => {
    if (isEgg) {
      say('click to hatch! 🐣')
      return
    }
    if (behavior.pose === 'sleeping' || behavior.pose === 'idle' || behavior.pose === 'yawning') {
      if (behaviorRef.current) clearTimeout(behaviorRef.current)
      setBehavior({ pose: 'scratching', ms: 4000 })
      say(pick(MESSAGES.scratching))
    }
  }, [isEgg, behavior.pose, say])

  // ── Mouse leave → stop scratching immediately ────────────────────────────
  const handleMouseLeave = useCallback(() => {
    setShowSizer(false)
    if (behavior.pose === 'scratching') {
      if (behaviorRef.current) clearTimeout(behaviorRef.current)
      setBehavior({ pose: 'idle', ms: 2000 })
    }
  }, [behavior.pose])

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
      const rect = getPetAreaRect()
      if (rect) {
        // Clamp X within pet area, clamp Y between top and floor of pet area
        const floor = rectToFloor(rect)
        const petAreaTop = rectToFloor({ ...rect, bottom: rect.top } as DOMRect)
        const newX = Math.max(rect.left, Math.min(rect.right - catSize, ev.clientX - dragOffset.current.x))
        const rawY = Math.max(0, window.innerHeight - ev.clientY - 10)
        const newY = Math.max(floor, Math.min(floor + rect.height, rawY))
        setPosX(newX)
        setPosY(newY)
      } else {
        const newX = Math.max(0, Math.min(window.innerWidth - 140, ev.clientX - dragOffset.current.x))
        const newY = Math.max(0, window.innerHeight - ev.clientY - 10)
        setPosX(newX)
        setPosY(newY)
      }
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // Reset dragMoved after a tick so the click handler (which fires after mouseup) sees it
      setTimeout(() => {
        setIsDragging(false)
        dragMoved.current = false
      }, 0)
      // Only snap to floor if the user actually dragged (not just a click)
      if (!dragMoved.current) return
      const rect = getPetAreaRect()
      setPosY(rect ? rectToFloor(rect) : 0)
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

    // Toggle quick-action popover
    setShowPopover(prev => !prev)

    // Also show heart
    setShowHeart(true)
    if (heartRef.current) clearTimeout(heartRef.current)
    heartRef.current = setTimeout(() => setShowHeart(false), 1200)
  }, [minimized])

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
      case 'sleeping':   return { animation: 'didi-sleep-breathe 3.5s ease-in-out infinite', transformOrigin: 'center' }
      case 'yawning':    return { animation: 'didi-yawn-shake 0.55s ease-in-out 2', transformOrigin: 'center bottom' }
      case 'playing':    return { animation: 'didi-float 0.6s ease-in-out infinite', transformOrigin: 'center bottom' }
      case 'walking':    return { animation: 'didi-walk-bob 0.38s ease-in-out infinite', transformOrigin: 'center bottom' }
      case 'scratching': return { animation: 'didi-scratch 0.4s ease-in-out infinite', transformOrigin: 'center' }
      default:         return { animation: 'didi-float 3s ease-in-out infinite', transformOrigin: 'center bottom' }
    }
  })()

  const pose: DidiPose = behavior.pose === 'walking' ? walkFrame : behavior.pose

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
          transition: (isDragging || behavior.pose === 'walking' || suppressTransition) ? 'none' : 'left 0.4s cubic-bezier(0.34,1.56,0.64,1), bottom 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          animation: popIn && !isDragging ? 'didi-pop-in 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards' : undefined,
        }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => { handleHover(); setShowSizer(true) }}
        onMouseLeave={handleMouseLeave}
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
            <span>{petName ?? 'Didi'}</span>          </div>
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

            {/* Name tag — above the cat, hidden when showName is false */}
            {showName && (
            <div style={{
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#a07060',
              letterSpacing: '0.05em',
              marginBottom: 2,
              fontFamily: 'system-ui, sans-serif',
              opacity: 0.8,
            }}>
              {petName ?? 'Didi'} 🐾
            </div>
            )}

            {/* Cat image with animation */}
            <div style={{
              ...catAnim,
              position: 'relative',
              filter: isDragging ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))' : undefined,
              transform: isDragging ? 'scale(1.08)' : undefined,
            }}>
              <DidiSvg
                pose={pose}
                stage={petStage}
                size={catSize}
                facingLeft={behavior.pose === 'walking' ? facingLeft : false}
              />
            </div>

            {/* Gramophone — outside the animated div so it doesn't shake with Didi */}
            {!isEgg && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: catSize, pointerEvents: 'auto' }}>
                <MusicPlayer />
              </div>
            )}

            {/* Size slider — moved into popover; keep showSizer for popover toggle */}

            {/* Quick-action popover — opens on click, closes on outside click */}
            {showPopover && !isDragging && (
              <div
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  bottom: catSize + 28,
                  right: 0,
                  width: 200,
                  background: 'white',
                  border: '2px solid #f0e6d3',
                  borderRadius: 16,
                  padding: '12px 14px',
                  boxShadow: '0 8px 24px rgba(92,61,46,0.18)',
                  zIndex: 10003,
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                {/* Pet name + mood */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#5c3d2e' }}>
                    {petName ?? 'My Pet'} 🐾
                  </span>
                  <button
                    onClick={() => setShowPopover(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#a07060', padding: 0 }}
                  >×</button>
                </div>

                {/* Size slider inside popover */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#a07060', marginBottom: 3, fontWeight: 600 }}>Size</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', overflow: 'hidden' }}>
                    <span style={{ fontSize: 9, color: '#a07060', flexShrink: 0 }}>S</span>
                    <input
                      type="range"
                      min={60}
                      max={220}
                      step={10}
                      value={catSize}
                      onChange={e => setCatSize(Number(e.target.value))}
                      style={{ flex: 1, minWidth: 0, maxWidth: '100%', accentColor: '#a07060', cursor: 'ew-resize' }}
                    />
                    <span style={{ fontSize: 9, color: '#a07060', flexShrink: 0 }}>L</span>
                  </div>
                </div>

                {/* Name toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, cursor: 'pointer', fontSize: 12, color: '#5c3d2e', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showName}
                    onChange={e => {
                      setShowName(e.target.checked)
                      try { localStorage.setItem('didi-show-name', String(e.target.checked)) } catch {}
                    }}
                    style={{ accentColor: '#a07060' }}
                  />
                  Show name tag
                </label>

                {/* Streak */}
                {streak != null && (
                  <div style={{ fontSize: 12, color: '#5c3d2e', marginBottom: 6, fontWeight: 600 }}>
                    🔥 {streak} day streak
                  </div>
                )}

                {/* XP progress toward next stage */}
                {!isEgg && (
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#a07060', marginBottom: 2 }}>
                      <span>⭐ XP</span>
                      <span>{petStage === 'baby' ? `${xp ?? 0}/100 → teen` : petStage === 'teen' ? `${xp ?? 0}/300 → adult` : petStage === 'adult' ? `${xp ?? 0} XP` : `${xp ?? 0} XP`}</span>
                    </div>
                    <div style={{ height: 6, background: '#f0e6d3', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${petStage === 'baby' ? Math.min(((xp ?? 0) / 100) * 100, 100) : petStage === 'teen' ? Math.min((((xp ?? 0) - 100) / 200) * 100, 100) : 100}%`,
                        background: '#6366f1',
                        borderRadius: 3,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                )}

                {/* Happiness bar */}
                {happiness != null && (
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#a07060', marginBottom: 2 }}>
                      <span>❤️ Happiness</span><span>{happiness}/100</span>
                    </div>
                    <div style={{ height: 6, background: '#f0e6d3', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${happiness}%`, background: happiness > 60 ? '#22c55e' : happiness > 30 ? '#f97316' : '#ef4444', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )}

                {/* Hunger bar */}
                {hunger != null && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#a07060', marginBottom: 2 }}>
                      <span>🍖 Hunger</span><span>{hunger}/100</span>
                    </div>
                    <div style={{ height: 6, background: '#f0e6d3', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${hunger}%`, background: hunger > 60 ? '#22c55e' : hunger > 30 ? '#f97316' : '#ef4444', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )}

                {/* Contextual hint */}
                {!isEgg && (
                  <div style={{
                    fontSize: 10,
                    color: '#a07060',
                    textAlign: 'center',
                    marginBottom: 6,
                    lineHeight: 1.4,
                    fontStyle: 'italic',
                  }}>
                    {happiness != null && happiness < 40
                      ? '💡 Log in daily to make Didi happy & grow!'
                      : hunger != null && hunger < 40
                      ? '💡 Come back every day — Didi needs you!'
                      : streak != null && streak === 0
                      ? '💡 Daily logins give Didi XP to evolve ✨'
                      : streak != null && streak >= 7
                      ? `🌟 ${streak} day streak! Didi loves you!`
                      : '💡 Log in daily to help Didi grow stronger!'}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {isEgg && onHatch ? (
                    /* ── Egg: XP display + hatch button ── */
                    <>
                      {/* XP bar even for egg — shows progress toward hatching */}
                      {xp != null && (
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#a07060', marginBottom: 2 }}>
                            <span>⭐ XP</span>
                            <span>{xp} XP earned</span>
                          </div>
                          <div style={{ height: 6, background: '#f0e6d3', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min((xp / 100) * 100, 100)}%`, background: '#6366f1', borderRadius: 3, transition: 'width 0.3s' }} />
                          </div>
                          <div style={{ fontSize: 9, color: '#a07060', marginTop: 2, textAlign: 'center' }}>
                            Hatch at any time — XP carries over!
                          </div>
                        </div>
                      )}
                      <p style={{ fontSize: 11, color: '#a07060', textAlign: 'center', marginBottom: 6, fontWeight: 600 }}>
                        🥚 Your egg is ready to hatch!
                      </p>
                      {crackError && (
                        <p style={{ fontSize: 10, color: '#ef4444', textAlign: 'center', marginBottom: 4 }}>{crackError}</p>
                      )}
                      <button
                        disabled={cracking}
                        onClick={onHatch}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'center',
                          background: cracking ? '#f5f5f5' : '#fef3c7',
                          color: '#92400e',
                          fontSize: 13,
                          fontWeight: 700,
                          padding: '9px 0',
                          borderRadius: 10,
                          border: '2px solid #fcd34d',
                          cursor: cracking ? 'not-allowed' : 'pointer',
                          opacity: cracking ? 0.6 : 1,
                        }}
                      >
                        {cracking ? 'Hatching...' : '🐣 Hatch!'}
                      </button>
                    </>
                  ) : (
                    /* ── Hatched pet: quick actions ── */
                    <>
                      <a
                        href="/challenges"
                        style={{ display: 'block', textAlign: 'center', background: '#dcfce7', color: '#15803d', fontSize: 12, fontWeight: 700, padding: '6px 0', borderRadius: 10, textDecoration: 'none' }}
                        onClick={() => setShowPopover(false)}
                      >
                        🧮 Do today's challenge
                      </a>
                    </>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </>
  )
}
