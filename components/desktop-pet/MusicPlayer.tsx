'use client'

// ─────────────────────────────────────────────────────────────────────────────
// MusicPlayer — gramophone icon + mini player popup attached to the desktop pet
//
// Usage: drop <MusicPlayer /> inside the DesktopPet render, positioned
// near the cat's paw area.
//
// Add your MP3 files to /public/music/ and register them in lib/music-playlist.ts
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { PLAYLIST } from '@/lib/music-playlist'

const STYLES = `
@keyframes disc-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes note-float {
  0%   { opacity: 0; transform: translateY(0px) scale(0.7); }
  20%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(-28px) scale(1); }
}
`

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [trackIndex, setTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.6)
  const [progress, setProgress] = useState(0)   // 0–1
  const [duration, setDuration] = useState(0)
  const [open, setOpen] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [noteKey, setNoteKey] = useState(0)

  const hasTracks = PLAYLIST.length > 0
  const currentTrack = hasTracks ? PLAYLIST[trackIndex] : null

  // ── Create audio element once ────────────────────────────────────────────
  useEffect(() => {
    const audio = new Audio()
    audio.loop = false
    audio.volume = volume
    audioRef.current = audio

    audio.addEventListener('timeupdate', () => {
      if (audio.duration > 0) setProgress(audio.currentTime / audio.duration)
    })
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration)
    })
    audio.addEventListener('ended', () => {
      // Auto-advance to next track
      setTrackIndex(prev => {
        const next = (prev + 1) % PLAYLIST.length
        return next
      })
    })

    return () => {
      audio.pause()
      audio.src = ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load track when index changes ────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    const wasPlaying = isPlaying
    audio.src = `/music/${currentTrack.file}`
    audio.load()
    if (wasPlaying) {
      audio.play().catch(() => setIsPlaying(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIndex, currentTrack?.file])

  // ── Sync volume ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // ── Note float effect while playing ─────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => setNoteKey(k => k + 1), 1400)
    return () => clearInterval(interval)
  }, [isPlaying])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      if (!audio.src || audio.src === window.location.href) {
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
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
  }, [])

  const prevTrack = () => {
    const prev = (trackIndex - 1 + PLAYLIST.length) % PLAYLIST.length
    playTrack(prev)
  }

  const nextTrack = () => {
    const next = (trackIndex + 1) % PLAYLIST.length
    playTrack(next)
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audio.currentTime = ratio * audio.duration
    setProgress(ratio)
  }

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <>
      <style>{STYLES}</style>

      {/* ── Floating notes ── */}
      {isPlaying && (
        <div key={noteKey} style={{
          position: 'absolute',
          top: -8,
          left: -2,
          fontSize: 13,
          pointerEvents: 'none',
          animation: 'note-float 1.4s ease-out forwards',
          zIndex: 10004,
          color: '#7c3aed',
        }}>♪</div>
      )}

      {/* ── Gramophone button ── */}
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        onMouseDown={e => e.stopPropagation()}
        title={hasTracks ? 'Study music 🎵' : 'Add music to /public/music/ to enable player'}
        style={{
          position: 'absolute',
          bottom: -4,
          left: -28,
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: isPlaying ? '#7c3aed' : 'rgba(255,255,255,0.95)',
          border: isPlaying ? '2px solid #7c3aed' : '1.5px solid #e8d5c0',
          cursor: hasTracks ? 'pointer' : 'not-allowed',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isPlaying ? '0 0 8px rgba(124,58,237,0.4)' : '0 2px 6px rgba(0,0,0,0.12)',
          transition: 'all 0.2s',
          zIndex: 10002,
          opacity: hasTracks ? 1 : 0.5,
        }}
        aria-label="Toggle music player"
      >
        {/* Gramophone SVG icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isPlaying ? 'white' : '#a07060'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {/* Horn */}
          <path d="M9 18V6l3-1.5L15 6v4" />
          {/* Bell of horn */}
          <path d="M15 6c2 0 5 2 5 6s-3 6-5 6H9" />
          {/* Spinning disc */}
          <circle cx="6" cy="18" r="3" style={{ animation: isPlaying ? 'disc-spin 2s linear infinite' : 'none', transformOrigin: '6px 18px' }} />
          {/* Center dot */}
          <circle cx="6" cy="18" r="1" fill={isPlaying ? 'white' : '#a07060'} stroke="none" />
        </svg>
      </button>

      {/* ── Mini player popup ── */}
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 26,
            left: -170,
            width: 220,
            background: 'white',
            border: '2px solid #f0e6d3',
            borderRadius: 16,
            padding: '12px 14px 10px',
            boxShadow: '0 8px 24px rgba(92,61,46,0.18)',
            zIndex: 10005,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5c3d2e', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 14 }}>🎵</span> Study Music
            </span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#a07060', padding: 0, lineHeight: 1 }}>×</button>
          </div>

          {!hasTracks ? (
            <div style={{ fontSize: 11, color: '#a07060', textAlign: 'center', padding: '8px 0', lineHeight: 1.5 }}>
              No tracks yet.<br />
              Add MP3s to <code style={{ background: '#f5f5f5', padding: '1px 4px', borderRadius: 4 }}>/public/music/</code><br />
              and update <code style={{ background: '#f5f5f5', padding: '1px 4px', borderRadius: 4 }}>lib/music-playlist.ts</code>
            </div>
          ) : (
            <>
              {/* Track title */}
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#5c3d2e',
                textAlign: 'center',
                marginBottom: 8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
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
                  height: 5,
                  background: '#f0e6d3',
                  borderRadius: 3,
                  marginBottom: 4,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  height: '100%',
                  width: `${progress * 100}%`,
                  background: '#7c3aed',
                  borderRadius: 3,
                  transition: 'width 0.3s',
                }} />
              </div>

              {/* Time */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#a07060', marginBottom: 10 }}>
                <span>{formatTime(progress * duration)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
                <button onClick={prevTrack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#7c3aed', padding: 2, lineHeight: 1 }} title="Previous" disabled={PLAYLIST.length < 2}>
                  ⏮
                </button>
                <button
                  onClick={togglePlay}
                  style={{
                    background: '#7c3aed',
                    border: 'none',
                    borderRadius: '50%',
                    width: 34,
                    height: 34,
                    cursor: 'pointer',
                    fontSize: 14,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
                  }}
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button onClick={nextTrack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#7c3aed', padding: 2, lineHeight: 1 }} title="Next" disabled={PLAYLIST.length < 2}>
                  ⏭
                </button>
              </div>

              {/* Volume */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 12 }}>🔈</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#7c3aed', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 12 }}>🔊</span>
              </div>

              {/* Playlist toggle */}
              <button
                onClick={() => setShowPlaylist(p => !p)}
                style={{
                  width: '100%',
                  background: showPlaylist ? '#f5f0ff' : '#faf5ff',
                  border: '1px solid #e9d5ff',
                  borderRadius: 8,
                  fontSize: 11,
                  color: '#7c3aed',
                  fontWeight: 600,
                  padding: '5px 0',
                  cursor: 'pointer',
                  marginBottom: showPlaylist ? 8 : 0,
                }}
              >
                {showPlaylist ? '▲ Hide playlist' : '▼ Choose a song'}
              </button>

              {/* Playlist */}
              {showPlaylist && (
                <div style={{
                  maxHeight: 140,
                  overflowY: 'auto',
                  border: '1px solid #f0e6d3',
                  borderRadius: 8,
                  background: '#fffbf7',
                }}>
                  {PLAYLIST.map((track, idx) => (
                    <div
                      key={idx}
                      onClick={() => playTrack(idx)}
                      style={{
                        padding: '7px 10px',
                        fontSize: 11,
                        fontWeight: idx === trackIndex ? 700 : 400,
                        color: idx === trackIndex ? '#7c3aed' : '#5c3d2e',
                        background: idx === trackIndex ? '#f5f0ff' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        borderBottom: idx < PLAYLIST.length - 1 ? '1px solid #f5ede0' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (idx !== trackIndex) (e.currentTarget as HTMLDivElement).style.background = '#fdf5ee' }}
                      onMouseLeave={e => { if (idx !== trackIndex) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                    >
                      {idx === trackIndex && isPlaying ? '♪' : <span style={{ width: 10, display: 'inline-block', color: '#a07060', fontSize: 9 }}>{idx + 1}</span>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
