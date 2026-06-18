'use client'

// InlinePet — animated, interactive, but non-floating version of the pet.
// Anchored to the bottom of its container (position: absolute).
// No drag, no fixed positioning — scrolls naturally with the page.
// Includes: behavior cycling, CSS animations, click popover.

import { useCallback, useEffect, useRef, useState } from 'react'
import DidiSvg, { type DidiStage } from './DidiSvg'

interface PetStatus {
  hasPet: boolean
  isEgg?: boolean
  stage?: string
  petName?: string | null
  happiness?: number | null
  hunger?: number | null
  streak?: number | null
  xp?: number | null
}

// Same keyframes as DesktopPet
const STYLES = `
@keyframes inline-pet-float {
  0%   { transform: translateY(0px); }
  50%  { transform: translateY(-6px); }
  100% { transform: translateY(0px); }
}
@keyframes inline-pet-breathe {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.025); }
  100% { transform: scale(1); }
}
@keyframes inline-pet-zzz {
  0%   { opacity: 0; transform: translate(0px,0px) scale(0.5); }
  30%  { opacity: 1; }
  100% { opacity: 0; transform: translate(12px,-24px) scale(1.2); }
}
`

type Pose = 'idle' | 'sleeping' | 'playing' | 'yawning'

function nextPose(cur: Pose): Pose {
  const r = Math.random()
  if (cur === 'sleeping') return r < 0.7 ? 'yawning' : 'idle'
  if (cur === 'yawning') return r < 0.5 ? 'sleeping' : 'idle'
  if (cur === 'playing') return r < 0.7 ? 'idle' : 'yawning'
  // idle
  if (r < 0.35) return 'sleeping'
  if (r < 0.6) return 'playing'
  if (r < 0.8) return 'yawning'
  return 'idle'
}

function poseMs(pose: Pose): number {
  if (pose === 'sleeping') return 60000 + Math.random() * 30000
  if (pose === 'yawning') return 3200
  if (pose === 'playing') return 2500
  return 2000 + Math.random() * 2000
}

export default function InlinePet() {
  const [status, setStatus] = useState<PetStatus | null>(null)
  const [pose, setPose] = useState<Pose>('sleeping')
  const [speech, setSpeech] = useState<string | null>(null)
  const [showPopover, setShowPopover] = useState(false)
  const [xpGainToast, setXpGainToast] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevXp = useRef<number | null>(null)

  useEffect(() => {
    fetch('/api/pet/status')
      .then(r => r.json())
      .then((d: PetStatus) => {
        setStatus(d)
        prevXp.current = d.xp ?? null
      })
      .catch(() => setStatus({ hasPet: false }))

    function handleRefresh(e: Event) {
      const detail = (e as CustomEvent).detail
      if (detail?.xp != null) {
        setStatus(prev => prev ? { ...prev, xp: detail.xp, happiness: detail.happiness ?? prev.happiness, hunger: detail.hunger ?? prev.hunger, stage: detail.stage ?? prev.stage } : prev)
      } else {
        fetch('/api/pet/status').then(r => r.json()).then((d: PetStatus) => setStatus(d)).catch(() => {})
      }
    }
    window.addEventListener('didi-pet-refresh', handleRefresh)
    return () => window.removeEventListener('didi-pet-refresh', handleRefresh)
  }, [])

  // Detect XP gains
  useEffect(() => {
    const cur = status?.xp ?? null
    if (cur === null || prevXp.current === null) { prevXp.current = cur; return }
    const gained = cur - prevXp.current
    if (gained > 0) { setXpGainToast(gained); setTimeout(() => setXpGainToast(null), 3500) }
    prevXp.current = cur
  }, [status?.xp])

  // Behavior cycling
  const advance = useCallback((cur: Pose) => {
    const next = nextPose(cur)
    setPose(next)
    if (next === 'sleeping') say('Zzz...')
    if (next === 'yawning') say('yaaawn~')
    if (next === 'playing') say('meow!')
    timerRef.current = setTimeout(() => advance(next), poseMs(next))
  }, [])

  useEffect(() => {
    timerRef.current = setTimeout(() => advance('sleeping'), poseMs('sleeping'))
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [advance])

  function say(msg: string) {
    setSpeech(msg)
    if (speechRef.current) clearTimeout(speechRef.current)
    speechRef.current = setTimeout(() => setSpeech(null), 3200)
  }

  function handleClick() {
    setShowPopover(v => !v)
    say('( ´ ▽ ` )')
    if (timerRef.current) clearTimeout(timerRef.current)
    setPose('playing')
    timerRef.current = setTimeout(() => advance('playing'), poseMs('playing'))
  }

  if (!status?.hasPet) return null

  const stage = (status.stage ?? 'adult') as DidiStage
  const size = 120
  const didiPose = status.isEgg ? 'idle' : pose

  const catAnim: React.CSSProperties = (() => {
    if (pose === 'sleeping') return { animation: 'inline-pet-breathe 3s ease-in-out infinite', transformOrigin: 'center bottom' }
    if (pose === 'playing') return { animation: 'inline-pet-float 0.6s ease-in-out infinite', transformOrigin: 'center bottom' }
    return { animation: 'inline-pet-float 3s ease-in-out infinite', transformOrigin: 'center bottom' }
  })()

  return (
    <>
      <style>{STYLES}</style>
      <div
        style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', cursor: 'pointer', userSelect: 'none' }}
        onClick={handleClick}
      >
        {/* XP gain toast */}
        {xpGainToast != null && (
          <div style={{ position: 'absolute', bottom: size + 20, left: '50%', transform: 'translateX(-50%)', background: '#fef08a', border: '2px solid #fbbf24', borderRadius: 12, padding: '4px 10px', fontSize: 13, fontWeight: 700, color: '#92400e', whiteSpace: 'nowrap', zIndex: 20 }}>
            +{xpGainToast} XP ⭐
          </div>
        )}

        {/* Speech bubble */}
        {speech && (
          <div style={{ position: 'absolute', bottom: size + 8, left: '50%', transform: 'translateX(-50%)', background: 'white', border: '2px solid #f0e6d3', borderRadius: 14, padding: '5px 12px', fontSize: 13, fontWeight: 700, color: '#5c3d2e', whiteSpace: 'nowrap', zIndex: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
            {speech}
          </div>
        )}

        {/* Sleeping ZZZ */}
        {pose === 'sleeping' && !status.isEgg && (
          <div style={{ position: 'absolute', top: 10, right: -10, fontSize: 16, fontWeight: 800, color: '#8b9dc3', animation: 'inline-pet-zzz 2s ease-in-out infinite', pointerEvents: 'none' }}>z</div>
        )}

        {/* Name tag */}
        {status.petName && (
          <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#a07060', letterSpacing: '0.05em', marginBottom: 2, fontFamily: 'system-ui, sans-serif', opacity: 0.85 }}>
            {status.petName} 🐾
          </div>
        )}

        {/* Cat */}
        <div style={catAnim}>
          <DidiSvg pose={didiPose} stage={status.isEgg ? 'egg' : stage} size={size} facingLeft={false} />
        </div>

        {/* Popover — rendered as fixed so it escapes overflow:hidden */}
        {showPopover && (
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: 'fixed', bottom: 180, right: '26%', width: 220, background: 'white', border: '2px solid #f0e6d3', borderRadius: 16, padding: '12px 14px', boxShadow: '0 8px 24px rgba(92,61,46,0.18)', zIndex: 9999, fontFamily: 'system-ui, sans-serif' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#5c3d2e' }}>{status.petName ?? 'My Pet'} 🐾</span>
              <button onClick={() => setShowPopover(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#a07060' }}>×</button>
            </div>
            {status.streak != null && <div style={{ fontSize: 12, color: '#5c3d2e', marginBottom: 6, fontWeight: 600 }}>🔥 {status.streak} day streak</div>}
            {status.happiness != null && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#a07060', marginBottom: 2 }}><span>❤️ Happiness</span><span>{status.happiness}/100</span></div>
                <div style={{ height: 6, background: '#f0e6d3', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${status.happiness}%`, background: status.happiness > 60 ? '#22c55e' : '#f97316', borderRadius: 3 }} /></div>
              </div>
            )}
            {status.hunger != null && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#a07060', marginBottom: 2 }}><span>🍖 Hunger</span><span>{status.hunger}/100</span></div>
                <div style={{ height: 6, background: '#f0e6d3', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${status.hunger}%`, background: status.hunger > 60 ? '#22c55e' : '#f97316', borderRadius: 3 }} /></div>
              </div>
            )}
            <a href="/challenges" style={{ display: 'block', textAlign: 'center', background: '#dcfce7', color: '#15803d', fontSize: 12, fontWeight: 700, padding: '6px 0', borderRadius: 10, textDecoration: 'none' }} onClick={() => setShowPopover(false)}>
              🧮 Do today's challenge
            </a>
          </div>
        )}
      </div>
    </>
  )
}
