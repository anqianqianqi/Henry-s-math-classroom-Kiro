'use client'

// ─────────────────────────────────────────────────────────────────────────────
// MusicPlayer — self-contained floating music widget
//
// Always position:fixed. Can be rendered standalone or docked below Didi via
// the dockPos prop (x/y in viewport coords of where to anchor).
//
// Collapsed: 🎵 pill. Expanded: full player card above the pill.
// Both use portal so they're never clipped by parent stacking contexts.
//
// Audio state lives in module-level singletons so it survives React remounts
// during page navigation (Next.js layout re-renders).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ensureAudio,
  fetchUnlockedTracks,
  formatTime,
  getState,
  nextTrack as storeNext,
  playTrack as storePlay,
  prevTrack as storePrev,
  seekRatio,
  setVolume as storeSetVolume,
  subscribe,
  togglePlay as storeTogglePlay,
} from '@/lib/music/audioStore'

/*
  The audio itself now lives in lib/music/audioStore — see the note there.
  This component is one view onto it; the challenge room's radio is another.
  Its appearance and props are unchanged.
*/


const C = {
  panel:        '#fdf0e0',  // aged parchment
  panelBorder:  '#8b5e3c',  // vintage brown border
  headerIdle:   'linear-gradient(135deg,#a0522d,#7a3b1e)',  // sienna → dark mahogany
  headerPlaying:'linear-gradient(135deg,#7a3b1e,#5c2a0e)',  // dark mahogany playing
  text:         '#3d1c08',  // very dark brown text
  subtext:      '#6b3a1f',  // medium warm brown
  track:        '#e8c9a0',  // aged parchment track
  progressFill: '#8b5e3c',
  accent:       '#8b5e3c',
  idle:         '#8b5e3c',
  idleLight:    '#f5e6d0',
  idleBorder:   '#b8875a',  // warm tan border
  playBorder:   '#7a3b1e',
  playGrad:     'linear-gradient(135deg,#a0522d,#7a3b1e)',
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
  // When true, renders position:relative inside a flex container (FloatingGroup)
  groupMode?: boolean
}

export default function MusicPlayer({ dockPos, groupMode = false }: Props = {}) {
  // ── Sync React state from the store ───────────────────────────────────────
  // A single re-render trigger — whenever audio fires an event, we re-read it
  const [, forceUpdate] = useState(0)
  const rerender = useCallback(() => forceUpdate(n => n + 1), [])

  useEffect(() => {
    const unsubscribe = subscribe(rerender)
    ensureAudio()
    fetchUnlockedTracks()
    // Re-fetch when a new track is purchased from the shop
    const onUpdate = () => fetchUnlockedTracks(true)
    window.addEventListener('music-tracks-updated', onUpdate)
    return () => {
      unsubscribe()
      window.removeEventListener('music-tracks-updated', onUpdate)
    }
  }, [rerender])

  const { isPlaying, trackIndex, progress, duration, playlist, volume } = getState()

  // ── Local UI state ────────────────────────────────────────────────────────
  const [mounted,      setMounted]      = useState(false)
  const [collapsed,    setCollapsed]    = useState(true)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [noteKey,      setNoteKey]      = useState(0)

  // ── Position (only used when not docked) ──────────────────────────────────
  const [ownPos, setOwnPos] = useState<{ left: number; top: number } | null>(null)
  const pillRef    = useRef<HTMLDivElement | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const dragMoved  = useRef(false)

  const hasTracks   = playlist.length > 0
  const currentTrack = hasTracks ? playlist[trackIndex] : null
  const pillPos      = dockPos ?? ownPos

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true)
    if (!dockPos) {
      const vw = document.documentElement.clientWidth
      const vh = document.documentElement.clientHeight
      setOwnPos({ left: vw - 44 - 8, top: vh - 44 - 8 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { if (dockPos) setOwnPos(dockPos) }, [dockPos])

  // ── Floating note animation while playing ─────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return
    const t = setInterval(() => setNoteKey(k => k + 1), 1400)
    return () => clearInterval(t)
  }, [isPlaying])

  const setVolume = (v: number) => storeSetVolume(v)

  // ── Drag (standalone mode only) ───────────────────────────────────────────
  const PILL_W = 44
  const PILL_H_DRAG = 44

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (dockPos) return
    const tag = (e.target as HTMLElement).tagName.toLowerCase()
    if (['button', 'input'].includes(tag)) return
    e.preventDefault()
    dragMoved.current = false
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const cur = ownPos ?? { left: vw - PILL_W - 8, top: vh - PILL_H_DRAG - 8 }
    dragOffset.current = { x: e.clientX - cur.left, y: e.clientY - cur.top }
    const onMove = (ev: MouseEvent) => {
      dragMoved.current = true
      setOwnPos({
        left: Math.max(0, Math.min(vw - PILL_W, ev.clientX - dragOffset.current.x)),
        top:  Math.max(0, Math.min(vh - PILL_H_DRAG, ev.clientY - dragOffset.current.y)),
      })
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [dockPos, ownPos])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (dockPos || groupMode) return
    const tag = (e.target as HTMLElement).tagName.toLowerCase()
    if (['button', 'input'].includes(tag)) return
    dragMoved.current = false
    const touch = e.touches[0]
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const cur = ownPos ?? { left: vw - PILL_W - 8, top: vh - PILL_H_DRAG - 8 }
    dragOffset.current = { x: touch.clientX - cur.left, y: touch.clientY - cur.top }
    const onMove = (ev: TouchEvent) => {
      ev.preventDefault()
      dragMoved.current = true
      const t = ev.touches[0]
      setOwnPos({
        left: Math.max(0, Math.min(vw - PILL_W, t.clientX - dragOffset.current.x)),
        top:  Math.max(0, Math.min(vh - PILL_H_DRAG, t.clientY - dragOffset.current.y)),
      })
    }
    const onEnd = () => { window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd) }
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend',  onEnd)
  }, [dockPos, groupMode, ownPos])

  // ── Playback controls — all of them the store's ───────────────────────────
  const togglePlay = useCallback(() => storeTogglePlay(), [])

  const playTrack = useCallback((idx: number) => {
    setShowPlaylist(false)
    storePlay(idx)
  }, [])

  const prevTrack = () => storePrev()
  const nextTrack = () => storeNext()

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    seekRatio((e.clientX - rect.left) / rect.width)
  }

  const fmt = formatTime

  if (!mounted || (!pillPos && !groupMode)) return <style>{STYLES}</style>

  const PANEL_W = 224
  // Panel height estimate: ~320px max (with playlist open). Use actual rect when available.
  const PANEL_H_EST = 340

  // Compute expanded panel position — clamp all 4 edges so panel stays fully on screen
  const pillRect = pillRef.current?.getBoundingClientRect()
  const vw = typeof window !== 'undefined' ? document.documentElement.clientWidth  : 400
  const vh = typeof window !== 'undefined' ? document.documentElement.clientHeight : 800

  // Anchor panel left-edge to pill left, but clamp so right edge stays on screen
  const rawPanelLeft = pillRect ? pillRect.left : (pillPos?.left ?? 0)
  const panelLeft = Math.max(8, Math.min(rawPanelLeft, vw - PANEL_W - 8))

  // Anchor panel bottom to just above the pill, but clamp so top edge stays on screen
  const pillTop = pillRect ? pillRect.top : (pillPos?.top ?? vh - 60)
  const rawPanelBottom = vh - pillTop + 8  // distance from bottom of viewport to top of pill + gap
  const panelBottom = Math.max(8, Math.min(rawPanelBottom, vh - PANEL_H_EST - 8))

  return (
    <>
      <style>{STYLES}</style>

      {/* ── Pill ── */}
      <div
        ref={pillRef}
        data-no-drag
        onMouseDown={handleDragStart}
        onTouchStart={handleTouchStart}
        onClick={() => { if (!dragMoved.current) setCollapsed(c => !c) }}
        style={{
          position: groupMode ? 'relative' : 'fixed',
          right: groupMode ? undefined : undefined,
          left: groupMode ? undefined : pillPos?.left,
          top: groupMode ? undefined : undefined,
          ...((!groupMode && pillPos) && { top: pillPos.top }),
          zIndex: groupMode ? 10001 : 10000,
          cursor: (dockPos || groupMode) ? 'pointer' : 'grab',
          userSelect: 'none',
          touchAction: (dockPos || groupMode) ? 'auto' : 'none',
        }}
      >
        {isPlaying && (
          <div key={noteKey} style={{
            position: 'absolute', top: -18, left: 14, fontSize: 13,
            pointerEvents: 'none', animation: 'mp-note-float 1.4s ease-out forwards', color: C.accent,
          }}>♪</div>
        )}
        {/* CSS-only vinyl record icon — no images */}
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          // Vintage brown outer ring (the 留声机 base/platter edge)
          background: 'radial-gradient(circle, #a0622a 55%, #7a3d18 78%, #5c2a0e 100%)',
          boxShadow: isPlaying
            ? '0 0 10px rgba(139,69,19,0.6), 0 2px 6px rgba(0,0,0,0.4)'
            : '0 2px 6px rgba(0,0,0,0.3)',
          transition: 'box-shadow 0.2s',
        }}>
          {/* Spinning vinyl disc — 68% of outer size, centered */}
          <div style={{
            width: '68%', height: '68%', borderRadius: '50%',
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `
              radial-gradient(circle at center,
                #2a2a2a 0%, #2a2a2a 15%,
                #1a1a1a 15%, #1a1a1a 16%,
                #222 16%, #222 30%,
                #181818 30%, #181818 31%,
                #222 31%, #222 50%,
                #1c1c1c 50%, #1c1c1c 51%,
                #222 51%, #222 70%,
                #1a1a1a 70%, #1a1a1a 71%,
                #222 71%, #222 100%
              )
            `,
            animation: isPlaying ? 'mp-disc-spin 4s linear infinite' : 'none',
            animationPlayState: isPlaying ? 'running' : 'paused',
            transformOrigin: 'center',
            willChange: 'transform',
            boxShadow: 'inset 0 0 4px rgba(0,0,0,0.5)',
          }}>
            {/* Center label — larger, ~50% of disc, with bigger music icon */}
            <div style={{
              width: '50%', height: '50%', borderRadius: '50%',
              background: 'radial-gradient(circle, #4a4a4a, #333)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 14, color: '#bbb', lineHeight: 1, userSelect: 'none' }}>♫</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Expanded panel — portal so it's never clipped ── */}
      {!collapsed && mounted && createPortal(
        <div
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            left:   panelLeft,
            bottom: panelBottom,
            width: PANEL_W, zIndex: 99999,
            maxHeight: `calc(100dvh - ${panelBottom + 8}px)`,
            background: 'white', border: `2px solid ${C.panelBorder}`,
            borderRadius: 18, boxShadow: '0 8px 28px rgba(124,58,237,0.18)',
            fontFamily: 'system-ui,sans-serif', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
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
              <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>Study Music</span>
              {isPlaying && <span style={{ fontSize: 10, animation: 'mp-disc-spin 1.5s linear infinite', display: 'inline-block', color: 'white' }}>◎</span>}
            </div>
            <button onClick={() => setCollapsed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px', color: isPlaying ? 'rgba(255,255,255,0.95)' : '#3d1c08', fontWeight: 700 }}>×</button>
          </div>

          <div style={{ padding: '10px 14px 12px', overflow: 'auto', flex: 1 }}>
            {!hasTracks ? (
              <div style={{ fontSize: 11, color: '#a07060', textAlign: 'center', padding: '8px 0', lineHeight: 1.6 }}>
                No tracks yet. Add MP3s to <code style={{ background: '#f5f5f5', padding: '1px 4px', borderRadius: 4 }}>/public/music/</code>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, textAlign: 'center', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentTrack?.title ?? '—'}
                  <span style={{ fontSize: 10, color: C.subtext, fontWeight: 400, marginLeft: 4 }}>{trackIndex + 1}/{playlist.length}</span>
                </div>
                <div onClick={seek} style={{ height: 5, background: C.track, borderRadius: 3, marginBottom: 4, cursor: 'pointer', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress * 100}%`, background: C.progressFill, borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.subtext, marginBottom: 10 }}>
                  <span>{fmt(progress * duration)}</span><span>{fmt(duration)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
                  <button onClick={prevTrack} disabled={playlist.length < 2} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.idle, padding: 2, lineHeight: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 3h1.5v10H3V3zm2.5 5L12 13V3L5.5 8z"/></svg>
                  </button>
                  <button onClick={togglePlay} style={{ background: C.idle, border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 14, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px rgba(122,59,30,0.5)` }}>
                    {isPlaying
                      ? <svg width="14" height="14" viewBox="0 0 14 14" fill="white"><rect x="2" y="1" width="4" height="12"/><rect x="8" y="1" width="4" height="12"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 14 14" fill="white"><path d="M3 1l10 6-10 6V1z"/></svg>
                    }
                  </button>
                  <button onClick={nextTrack} disabled={playlist.length < 2} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.idle, padding: 2, lineHeight: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 3h1.5v10h-1.5V3zm-8 5L10 3v10L3.5 8z"/></svg>
                  </button>
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
                  <div style={{ maxHeight: 130, overflowY: 'auto', border: `1px solid ${C.idleBorder}`, borderRadius: 8, background: C.panel, touchAction: 'pan-y' }}>
                    {playlist.map((track, idx) => (
                      <div key={idx} onClick={() => playTrack(idx)}
                        style={{ padding: '7px 10px', fontSize: 11, cursor: 'pointer', fontWeight: idx === trackIndex ? 700 : 400, color: idx === trackIndex ? C.idle : C.text, background: idx === trackIndex ? C.idleLight : 'transparent', display: 'flex', alignItems: 'center', gap: 6, borderBottom: idx < playlist.length - 1 ? `1px solid ${C.idleBorder}` : 'none' }}
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
