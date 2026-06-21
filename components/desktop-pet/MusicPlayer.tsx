'use client'

// ─────────────────────────────────────────────────────────────────────────────
// MusicPlayer — self-contained floating music widget
//
// Always position:fixed. Can be rendered standalone or docked below Didi via
// the dockPos prop (x/y in viewport coords of where to anchor).
//
// Collapsed: 🎵 pill. Expanded: full player card above the pill.
// Both use portal so they're never clipped by parent stacking contexts.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { PLAYLIST } from '@/lib/music-playlist'

// Theme colors — vintage brown palette matching the music icon
const C = {
  // Panel / expanded player
  panel:        '#fdf6ee',  // warm cream background
  panelBorder:  '#b45309',  // amber-700 border
  headerIdle:   'linear-gradient(135deg,#d97706,#b45309)',  // amber gradient
  headerPlaying:'linear-gradient(135deg,#92400e,#78350f)',  // dark brown gradient
  text:         '#44200a',  // deep brown
  subtext:      '#78350f',  // amber-800
  // Progress / controls
  track:        '#fde68a',  // amber-200
  progressFill: '#b45309',  // amber-700
  accent:       '#b45309',
  idle:         '#92400e',  // amber-800 (for icons/borders when idle)
  idleLight:    '#fef3c7',  // amber-100
  idleBorder:   '#fbbf24',  // amber-400
  playBorder:   '#78350f',
  playGrad:     'linear-gradient(135deg,#d97706,#b45309)',
}

const STYLES = `
@keyframes mp-disc-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes mp-note-float {
  0%   { opacity: 0; transform: translateY(0px) scale(0.7); }
  20%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(-24px) scale(1); }
}
@keyframes mp-pop-in {
  0%   { transform: scale(0.4); opacity: 0; }
  70%  { transform: scale(1.06); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
`

interface Props {
  // When provided, the pill snaps to this position (used when docked below Didi).
  // When null/undefined, pill uses its own drag position.
  dockPos?: { left: number; top: number } | null
}

export default function MusicPlayer({ dockPos }: Props = {}) {
  // ── Audio ─────────────────────────────────────────────────────────────────
  const audioRef     = useRef<HTMLAudioElement | null>(null)
  const [trackIndex, setTrackIndex] = useState(0)
  const [isPlaying,  setIsPlaying]  = useState(false)
  const [volume,     setVolume]     = useState(0.6)
  const [progress,   setProgress]   = useState(0)
  const [duration,   setDuration]   = useState(0)

  // ── UI ────────────────────────────────────────────────────────────────────
  const [mounted,      setMounted]      = useState(false)
  const [collapsed,    setCollapsed]    = useState(true)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [noteKey,      setNoteKey]      = useState(0)

  // ── Position (only used when not docked) ──────────────────────────────────
  const [ownPos, setOwnPos] = useState<{ left: number; top: number } | null>(null)
  const pillRef    = useRef<HTMLDivElement | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const dragMoved  = useRef(false)

  const hasTracks    = PLAYLIST.length > 0
  const currentTrack = hasTracks ? PLAYLIST[trackIndex] : null

  // The actual pill position — docked wins over own
  const pillPos = dockPos ?? ownPos

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true)
    if (!dockPos) {
      setOwnPos({ left: window.innerWidth - 164, top: window.innerHeight - 56 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When dockPos changes, update ownPos fallback (so if docking stops we remember last pos)
  useEffect(() => {
    if (dockPos) setOwnPos(dockPos)
  }, [dockPos])

  // ── Auto-play on first interaction ────────────────────────────────────────
  const pathname      = usePathname()
  const autoPlayedRef = useRef(false)

  useEffect(() => {
    if (!hasTracks || autoPlayedRef.current) return
    const go = () => {
      if (autoPlayedRef.current || isPlaying) return
      autoPlayedRef.current = true
      document.removeEventListener('click',   go)
      document.removeEventListener('keydown', go)
      const audio = audioRef.current
      const track = PLAYLIST[trackIndex]
      if (!audio || !track) return
      if (!audio.src || !audio.src.endsWith(track.file)) { audio.src = `/music/${track.file}`; audio.load() }
      const play = () => audio.play().then(() => setIsPlaying(true)).catch(() => {})
      if (audio.readyState >= 3) { play() }
      else { const onCan = () => { audio.removeEventListener('canplay', onCan); play() }; audio.addEventListener('canplay', onCan) }
    }
    document.addEventListener('click',   go)
    document.addEventListener('keydown', go)
    return () => { document.removeEventListener('click', go); document.removeEventListener('keydown', go) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hasTracks])

  // ── Create audio ──────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = new Audio()
    audio.loop = false; audio.volume = volume
    audioRef.current = audio
    audio.addEventListener('timeupdate',    () => { if (audio.duration > 0) setProgress(audio.currentTime / audio.duration) })
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration))
    audio.addEventListener('ended',          () => setTrackIndex(p => (p + 1) % PLAYLIST.length))
    return () => { audio.pause(); audio.src = '' }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load on track change ──────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    const was = isPlaying
    audio.src = `/music/${currentTrack.file}`; audio.load()
    if (was) {
      const onCan = () => { audio.removeEventListener('canplay', onCan); audio.play().catch(() => setIsPlaying(false)) }
      audio.addEventListener('canplay', onCan)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIndex, currentTrack?.file])

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume }, [volume])
  useEffect(() => {
    if (!isPlaying) return
    const t = setInterval(() => setNoteKey(k => k + 1), 1400)
    return () => clearInterval(t)
  }, [isPlaying])

  // ── Drag (only when not docked) ───────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (dockPos) return  // docked — drag handled by parent
    const tag = (e.target as HTMLElement).tagName.toLowerCase()
    if (['button', 'input'].includes(tag)) return
    e.preventDefault()
    dragMoved.current = false
    const cur = ownPos ?? { left: window.innerWidth - 164, top: window.innerHeight - 56 }
    dragOffset.current = { x: e.clientX - cur.left, y: e.clientY - cur.top }
    const onMove = (ev: MouseEvent) => {
      dragMoved.current = true
      setOwnPos({
        left: Math.max(0, Math.min(window.innerWidth  - 148, ev.clientX - dragOffset.current.x)),
        top:  Math.max(0, Math.min(window.innerHeight - 40,  ev.clientY - dragOffset.current.y)),
      })
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [dockPos, ownPos])

  // ── Playback controls ─────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    if (isPlaying) { audio.pause(); setIsPlaying(false) }
    else {
      if (!audio.src || !audio.src.endsWith(currentTrack.file)) { audio.src = `/music/${currentTrack.file}`; audio.load() }
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }, [isPlaying, currentTrack])

  const playTrack = useCallback((idx: number) => {
    const audio = audioRef.current; if (!audio) return
    setTrackIndex(idx); setShowPlaylist(false)
    const track = PLAYLIST[idx]
    audio.src = `/music/${track.file}`; audio.load()
    const onCan = () => { audio.removeEventListener('canplay', onCan); audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false)) }
    audio.addEventListener('canplay', onCan)
  }, [])

  const prevTrack = () => playTrack((trackIndex - 1 + PLAYLIST.length) % PLAYLIST.length)
  const nextTrack = () => playTrack((trackIndex + 1) % PLAYLIST.length)

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current; if (!audio || !audio.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audio.currentTime = ratio * audio.duration; setProgress(ratio)
  }

  const fmt = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00'
    return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
  }

  if (!mounted || !pillPos) return <style>{STYLES}</style>

  const PILL_H = 48

  // Compute expanded panel position: anchors to pill's bottom edge, grows upward
  const panelLeft   = Math.max(8, Math.min(pillPos.left, window.innerWidth - 232))
  const panelBottom = Math.max(8, window.innerHeight - pillPos.top - PILL_H)

  return (
    <>
      <style>{STYLES}</style>

      {/* ── Pill ── */}
      <div
        ref={pillRef}
        data-no-drag
        onMouseDown={handleDragStart}
        onClick={() => { if (!dragMoved.current) setCollapsed(c => !c) }}
        style={{
          position: 'fixed',
          left: pillPos.left,
          top:  pillPos.top,
          zIndex: 10000,  // above FloatingGroup (9998) so clicks always register
          cursor: dockPos ? 'pointer' : 'grab',
          userSelect: 'none',
        }}
      >
        {isPlaying && (
          <div key={noteKey} style={{
            position: 'absolute', top: -18, left: 14, fontSize: 13,
            pointerEvents: 'none', animation: 'mp-note-float 1.4s ease-out forwards', color: C.accent,
          }}>♪</div>
        )}
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: isPlaying
            ? '0 0 10px rgba(146,64,14,0.5), 0 2px 6px rgba(0,0,0,0.3)'
            : '0 2px 6px rgba(0,0,0,0.25)',
          transition: 'box-shadow 0.2s',
          background: '#111',
        }}>
          {/* Layer 1: wooden base — static */}
          <img src="/music/bottom.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'screen', pointerEvents: 'none' }} />
          {/* Layer 2: vinyl disc — spins when playing */}
          <img src="/music/circle.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'screen', pointerEvents: 'none', animation: isPlaying ? 'mp-disc-spin 4s linear infinite' : 'none', transformOrigin: 'center' }} />
          {/* Layer 3: needle/tonearm — static on top */}
          <img src="/music/needle.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'screen', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* ── Expanded panel — portal so it's never clipped ── */}
      {!collapsed && mounted && createPortal(
        <div
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            left:   panelLeft,
            bottom: panelBottom,
            width: 224, zIndex: 99999,
            background: 'white', border: `2px solid ${C.panelBorder}`,
            borderRadius: 18, boxShadow: '0 8px 28px rgba(124,58,237,0.18)',
            fontFamily: 'system-ui,sans-serif', overflow: 'hidden',
            animation: 'mp-pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
          }}
        >
          {/* Header / drag handle */}
          <div style={{
            cursor: 'default',
            background: isPlaying ? C.headerPlaying : C.headerIdle,
            padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15 }}>🎵</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: isPlaying ? 'white' : C.idle }}>Study Music</span>
              {isPlaying && <span style={{ fontSize: 10, animation: 'mp-disc-spin 1.5s linear infinite', display: 'inline-block', color: 'white' }}>◎</span>}
            </div>
            <button onClick={() => setCollapsed(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, color: isPlaying ? 'rgba(255,255,255,0.8)' : C.subtext }}>×</button>
          </div>

          <div style={{ padding: '10px 14px 12px', overflow: 'hidden' }}>
            {!hasTracks ? (
              <div style={{ fontSize: 11, color: '#a07060', textAlign: 'center', padding: '8px 0', lineHeight: 1.6 }}>
                No tracks yet. Add MP3s to <code style={{ background: '#f5f5f5', padding: '1px 4px', borderRadius: 4 }}>/public/music/</code>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, textAlign: 'center', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentTrack?.title ?? '—'}
                  <span style={{ fontSize: 10, color: C.subtext, fontWeight: 400, marginLeft: 4 }}>{trackIndex + 1}/{PLAYLIST.length}</span>
                </div>
                <div onClick={seek} style={{ height: 5, background: C.track, borderRadius: 3, marginBottom: 4, cursor: 'pointer', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress * 100}%`, background: C.progressFill, borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.subtext, marginBottom: 10 }}>
                  <span>{fmt(progress * duration)}</span><span>{fmt(duration)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
                  <button onClick={prevTrack} disabled={PLAYLIST.length < 2} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.idle, padding: 2 }}>⏮</button>
                  <button onClick={togglePlay} style={{ background: C.idle, border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 14, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px rgba(22,163,74,0.4)` }}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <button onClick={nextTrack} disabled={PLAYLIST.length < 2} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.idle, padding: 2 }}>⏭</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, overflow: 'hidden' }}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>🔈</span>
                  <input type="range" min={0} max={1} step={0.05} value={volume} onChange={e => setVolume(Number(e.target.value))}
                    style={{ flex: 1, minWidth: 0, maxWidth: '100%', accentColor: C.idle, cursor: 'pointer' }} />
                  <span style={{ fontSize: 12, flexShrink: 0 }}>🔊</span>
                </div>
                <button onClick={() => setShowPlaylist(p => !p)}
                  style={{ width: '100%', background: showPlaylist ? C.idleLight : C.panel, border: `1px solid ${C.idleBorder}`, borderRadius: 8, fontSize: 11, color: C.idle, fontWeight: 600, padding: '5px 0', cursor: 'pointer', marginBottom: showPlaylist ? 8 : 0 }}>
                  {showPlaylist ? '▲ Hide playlist' : '▼ Choose a song'}
                </button>
                {showPlaylist && (
                  <div style={{ maxHeight: 130, overflowY: 'auto', border: `1px solid ${C.idleBorder}`, borderRadius: 8, background: C.panel }}>
                    {PLAYLIST.map((track, idx) => (
                      <div key={idx} onClick={() => playTrack(idx)}
                        style={{ padding: '7px 10px', fontSize: 11, cursor: 'pointer', fontWeight: idx === trackIndex ? 700 : 400, color: idx === trackIndex ? C.idle : C.text, background: idx === trackIndex ? C.idleLight : 'transparent', display: 'flex', alignItems: 'center', gap: 6, borderBottom: idx < PLAYLIST.length - 1 ? `1px solid ${C.idleBorder}` : 'none' }}
                        onMouseEnter={e => { if (idx !== trackIndex) (e.currentTarget as HTMLDivElement).style.background = C.panel }}
                        onMouseLeave={e => { if (idx !== trackIndex) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        {idx === trackIndex && isPlaying ? <span style={{ color: C.idle }}>♪</span> : <span style={{ width: 10, color: C.subtext, fontSize: 9 }}>{idx + 1}</span>}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
