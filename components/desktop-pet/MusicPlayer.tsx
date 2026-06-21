'use client'

// ─────────────────────────────────────────────────────────────────────────────
// MusicPlayer — floating, draggable, collapsible music widget
//
// Behaviour mirrors DesktopPet:
//   • Draggable anywhere on screen (drag the pill/header area)
//   • Collapsed: shows a small 🎵 pill with track name and play state
//   • Expanded: full player with progress, controls, volume, playlist
//   • Click the pill to expand/collapse
//   • × button to collapse back to pill
//
// Add MP3 files to /public/music/ and register in lib/music-playlist.ts
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PLAYLIST } from '@/lib/music-playlist'

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

export default function MusicPlayer({ anchorPos, groupMode = false }: { anchorPos?: { x: number; y: number }; groupMode?: boolean } = {}) {  // ── Audio engine ─────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [trackIndex, setTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying]   = useState(false)
  const [volume, setVolume]         = useState(0.6)
  const [progress, setProgress]     = useState(0)   // 0–1
  const [duration, setDuration]     = useState(0)

  // ── UI state ─────────────────────────────────────────────────────────────
  const [mounted,      setMounted]      = useState(false)
  const [collapsed,    setCollapsed]    = useState(true)   // pill vs full player
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [noteKey,      setNoteKey]      = useState(0)

  // ── Drag state (position = top-left corner of the widget) ────────────────
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragOffset  = useRef({ x: 0, y: 0 })
  const dragMoved   = useRef(false)
  const isDragging  = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const hasTracks    = PLAYLIST.length > 0
  const currentTrack = hasTracks ? PLAYLIST[trackIndex] : null

  // ── Mount ────────────────────────────────────────────────────────────────
  const userDraggedRef = useRef(false)  // true once user manually drags the pill

  useEffect(() => {
    setMounted(true)
    if (!anchorPos) {
      // Standalone (dashboard): bottom-right, left of where Didi would be
      setPos({ x: window.innerWidth - 164, y: window.innerHeight - 56 })
    }
    // If anchorPos is provided, wait for first anchorPos effect below
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Follow Didi's position when user hasn't manually dragged the pill ─────
  useEffect(() => {
    if (!anchorPos || userDraggedRef.current) return
    const PILL_WIDTH = 148
    const GAP = 4
    setPos({
      x: anchorPos.x - PILL_WIDTH - GAP,
      y: window.innerHeight - anchorPos.y - 56,  // convert bottom→top
    })
  }, [anchorPos])

  // ── Auto-play on first interaction (any page) ─────────────────────────────
  const pathname       = usePathname()
  const autoPlayedRef  = useRef(false)

  useEffect(() => {
    if (!hasTracks || autoPlayedRef.current) return
    const handleFirstInteraction = () => {
      if (autoPlayedRef.current || isPlaying) return
      autoPlayedRef.current = true
      document.removeEventListener('click',   handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
      const audio = audioRef.current
      const track = PLAYLIST[trackIndex]
      if (!audio || !track) return
      if (!audio.src || !audio.src.endsWith(track.file)) {
        audio.src = `/music/${track.file}`
        audio.load()
      }
      const tryPlay = () => audio.play().then(() => setIsPlaying(true)).catch(() => {})
      if (audio.readyState >= 3) { tryPlay() }
      else {
        const onCan = () => { audio.removeEventListener('canplay', onCan); tryPlay() }
        audio.addEventListener('canplay', onCan)
      }
    }
    document.addEventListener('click',   handleFirstInteraction)
    document.addEventListener('keydown', handleFirstInteraction)
    return () => {
      document.removeEventListener('click',   handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hasTracks])

  // ── Create audio element once ─────────────────────────────────────────────
  useEffect(() => {
    const audio = new Audio()
    audio.loop   = false
    audio.volume = volume
    audioRef.current = audio
    audio.addEventListener('timeupdate',    () => { if (audio.duration > 0) setProgress(audio.currentTime / audio.duration) })
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration))
    audio.addEventListener('ended',          () => setTrackIndex(prev => (prev + 1) % PLAYLIST.length))
    return () => { audio.pause(); audio.src = '' }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load track when index changes ─────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    const wasPlaying = isPlaying
    audio.src = `/music/${currentTrack.file}`
    audio.load()
    if (wasPlaying) {
      const onCan = () => { audio.removeEventListener('canplay', onCan); audio.play().catch(() => setIsPlaying(false)) }
      audio.addEventListener('canplay', onCan)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIndex, currentTrack?.file])

  // ── Sync volume ───────────────────────────────────────────────────────────
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume }, [volume])

  // ── Floating note effect ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return
    const t = setInterval(() => setNoteKey(k => k + 1), 1400)
    return () => clearInterval(t)
  }, [isPlaying])

  // ── Drag logic ─────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Don't start drag on interactive elements
    const tag = (e.target as HTMLElement).tagName.toLowerCase()
    if (['button', 'input'].includes(tag)) return
    e.preventDefault()
    dragMoved.current = false
    isDragging.current = true
    userDraggedRef.current = true  // user has taken control of position
    const current = pos ?? { x: window.innerWidth - 160, y: window.innerHeight - 56 }
    dragOffset.current = { x: e.clientX - current.x, y: e.clientY - current.y }

    const onMove = (ev: MouseEvent) => {
      dragMoved.current = true
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - 148, ev.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight -  40, ev.clientY - dragOffset.current.y)),
      })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
      setTimeout(() => { isDragging.current = false }, 0)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [pos])

  // ── Playback controls ─────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      if (!audio.src || !audio.src.endsWith(currentTrack.file)) {
        audio.src = `/music/${currentTrack.file}`
        audio.load()
      }
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }, [isPlaying, currentTrack])

  const playTrack = useCallback((idx: number) => {
    const audio = audioRef.current
    if (!audio) return
    setTrackIndex(idx)
    setShowPlaylist(false)
    const track = PLAYLIST[idx]
    audio.src = `/music/${track.file}`
    audio.load()
    const onCan = () => {
      audio.removeEventListener('canplay', onCan)
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
    audio.addEventListener('canplay', onCan)
  }, [])

  const prevTrack = () => playTrack((trackIndex - 1 + PLAYLIST.length) % PLAYLIST.length)
  const nextTrack = () => playTrack((trackIndex + 1) % PLAYLIST.length)

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audio.currentTime = ratio * audio.duration
    setProgress(ratio)
  }

  const fmt = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00'
    return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
  }

  const PLAYER_HEIGHT = 380 // approximate expanded height in px
  const PILL_HEIGHT   = 36

  const handleClick = () => {
    if (dragMoved.current) return
    setCollapsed(c => !c)
  }

  if (!mounted || !pos) return null

  // ── Collapsed pill ────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <>
        <style>{STYLES}</style>
        <div
          ref={containerRef}
          onMouseDown={groupMode ? undefined : handleDragStart}
          onClick={handleClick}
          style={{
            position: groupMode ? 'relative' : 'fixed',
            left: groupMode ? undefined : pos.x,
            top:  groupMode ? undefined : pos.y,
            zIndex: groupMode ? undefined : 9998,
            cursor: 'pointer',
            userSelect: 'none',
            animation: 'mp-pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
          }}        >
          {/* Floating note */}
          {isPlaying && (
            <div key={noteKey} style={{
              position: 'absolute', top: -18, left: 14,
              fontSize: 13, pointerEvents: 'none',
              animation: 'mp-note-float 1.4s ease-out forwards',
              color: '#7c3aed',
            }}>♪</div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: isPlaying
              ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
              : 'rgba(255,255,255,0.97)',
            border: isPlaying ? '2px solid #7c3aed' : '2px solid #d8b4fe',
            borderRadius: 24,
            padding: '5px 12px 5px 10px',
            boxShadow: isPlaying
              ? '0 0 12px rgba(124,58,237,0.4), 0 2px 8px rgba(0,0,0,0.15)'
              : '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: 12, fontWeight: 700,
            color: isPlaying ? 'white' : '#7c3aed',
            fontFamily: 'system-ui, sans-serif',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
          }}>
            <span style={{ fontSize: 15 }}>🎵</span>
            <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isPlaying ? (currentTrack?.title ?? 'Playing') : 'Music'}
            </span>
            {isPlaying && (
              <span style={{ fontSize: 11, animation: 'mp-disc-spin 1.5s linear infinite', display: 'inline-block' }}>◎</span>
            )}
          </div>
        </div>
      </>
    )
  }

  // ── Expanded player ───────────────────────────────────────────────────────
  // Anchors to the pill's position but grows upward so it never appears far away.
  // We compute where the pill's bottom edge is in viewport coords, then use that
  // as the bottom anchor for the expanded panel.
  const pillBottom = pos ? window.innerHeight - pos.y - PILL_HEIGHT : 0
  const playerLeft = pos ? Math.min(pos.x, window.innerWidth - 228) : 0

  // In groupMode, wrap in a relative container so the absolute panel pops above the pill
  const expandedContent = (
    <>
      <style>{STYLES}</style>
      <div
        ref={containerRef}
        style={{
          position: groupMode ? 'absolute' : 'fixed',
          left:   groupMode ? 0 : Math.max(8, playerLeft),
          bottom: groupMode ? PILL_HEIGHT + 4 : Math.max(8, pillBottom),
          zIndex: 99998,
          width: 224,
          background: 'white',
          border: '2px solid #e9d5ff',
          borderRadius: 18,
          boxShadow: '0 8px 28px rgba(124,58,237,0.18)',
          fontFamily: 'system-ui, sans-serif',
          overflow: 'hidden',
          userSelect: 'none',
          animation: 'mp-pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
      >
        {/* ── Drag handle / header ── */}
        <div
          onMouseDown={handleDragStart}
          style={{
            cursor: 'grab',
            background: isPlaying
              ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
              : 'linear-gradient(135deg, #f5f0ff, #ede9fe)',
            padding: '8px 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15 }}>🎵</span>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: isPlaying ? 'white' : '#7c3aed',
            }}>
              Study Music
            </span>
            {isPlaying && (
              <span style={{ fontSize: 10, animation: 'mp-disc-spin 1.5s linear infinite', display: 'inline-block', color: 'white' }}>◎</span>
            )}
          </div>
          {/* Collapse button */}
          <button
            onClick={e => { e.stopPropagation(); setCollapsed(true) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 16, lineHeight: 1, padding: 0,
              color: isPlaying ? 'rgba(255,255,255,0.8)' : '#a07060',
            }}
            title="Collapse"
          >
            ×
          </button>
        </div>

        {/* ── Player body ── */}
        <div style={{ padding: '10px 14px 12px', overflow: 'hidden' }}>
          {!hasTracks ? (
            <div style={{ fontSize: 11, color: '#a07060', textAlign: 'center', padding: '8px 0', lineHeight: 1.6 }}>
              No tracks yet.<br />
              Add MP3s to <code style={{ background: '#f5f5f5', padding: '1px 4px', borderRadius: 4 }}>/public/music/</code>
            </div>
          ) : (
            <>
              {/* Track title */}
              <div style={{
                fontSize: 12, fontWeight: 700, color: '#5c3d2e',
                textAlign: 'center', marginBottom: 8,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {currentTrack?.title ?? '—'}
                <span style={{ fontSize: 10, color: '#a07060', fontWeight: 400, marginLeft: 4 }}>
                  {trackIndex + 1}/{PLAYLIST.length}
                </span>
              </div>

              {/* Progress bar */}
              <div
                onClick={seek}
                style={{
                  height: 5, background: '#f0e6d3', borderRadius: 3,
                  marginBottom: 4, cursor: 'pointer', overflow: 'hidden',
                }}
              >
                <div style={{
                  height: '100%', width: `${progress * 100}%`,
                  background: '#7c3aed', borderRadius: 3, transition: 'width 0.3s',
                }} />
              </div>

              {/* Time */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#a07060', marginBottom: 10 }}>
                <span>{fmt(progress * duration)}</span>
                <span>{fmt(duration)}</span>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
                <button onClick={prevTrack} disabled={PLAYLIST.length < 2}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#7c3aed', padding: 2 }}>⏮</button>
                <button onClick={togglePlay}
                  style={{
                    background: '#7c3aed', border: 'none', borderRadius: '50%',
                    width: 36, height: 36, cursor: 'pointer', fontSize: 14, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
                  }}>
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button onClick={nextTrack} disabled={PLAYLIST.length < 2}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#7c3aed', padding: 2 }}>⏭</button>
              </div>

              {/* Volume */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, overflow: 'hidden' }}>
                <span style={{ fontSize: 12, flexShrink: 0 }}>🔈</span>
                <input type="range" min={0} max={1} step={0.05} value={volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  style={{ flex: 1, minWidth: 0, maxWidth: '100%', accentColor: '#7c3aed', cursor: 'pointer' }} />
                <span style={{ fontSize: 12, flexShrink: 0 }}>🔊</span>
              </div>

              {/* Playlist toggle */}
              <button
                onClick={() => setShowPlaylist(p => !p)}
                style={{
                  width: '100%', background: showPlaylist ? '#f5f0ff' : '#faf5ff',
                  border: '1px solid #e9d5ff', borderRadius: 8,
                  fontSize: 11, color: '#7c3aed', fontWeight: 600,
                  padding: '5px 0', cursor: 'pointer',
                  marginBottom: showPlaylist ? 8 : 0,
                }}>
                {showPlaylist ? '▲ Hide playlist' : '▼ Choose a song'}
              </button>

              {/* Playlist */}
              {showPlaylist && (
                <div style={{
                  maxHeight: 130, overflowY: 'auto',
                  border: '1px solid #f0e6d3', borderRadius: 8, background: '#fffbf7',
                }}>
                  {PLAYLIST.map((track, idx) => (
                    <div key={idx} onClick={() => playTrack(idx)}
                      style={{
                        padding: '7px 10px', fontSize: 11, cursor: 'pointer',
                        fontWeight: idx === trackIndex ? 700 : 400,
                        color: idx === trackIndex ? '#7c3aed' : '#5c3d2e',
                        background: idx === trackIndex ? '#f5f0ff' : 'transparent',
                        display: 'flex', alignItems: 'center', gap: 6,
                        borderBottom: idx < PLAYLIST.length - 1 ? '1px solid #f5ede0' : 'none',
                      }}
                      onMouseEnter={e => { if (idx !== trackIndex) (e.currentTarget as HTMLDivElement).style.background = '#fdf5ee' }}
                      onMouseLeave={e => { if (idx !== trackIndex) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                    >
                      {idx === trackIndex && isPlaying
                        ? <span>♪</span>
                        : <span style={{ width: 10, color: '#a07060', fontSize: 9 }}>{idx + 1}</span>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )

  if (groupMode) {
    return (
      <div style={{ position: 'relative' }}>
        {expandedContent}
      </div>
    )
  }
  return expandedContent
}
