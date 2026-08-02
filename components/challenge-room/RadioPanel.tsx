'use client'

/**
 * The radio's control surface, opened by clicking the radio in the room.
 *
 * ── WHY A PANEL AND NOT THE MESH ────────────────────────────
 * Clicking the model is the affordance; it is not a complete control. On a
 * window sill the radio renders around 100-150px wide, which puts a knob at a
 * few pixels — and seek and volume are continuous, which a raycast handles
 * badly at any size. The handoff's own AGENTS.md reaches the same conclusion
 * for its UI: "keyboard-accessible region buttons alongside direct model
 * picking". So everything is reachable here, and the mesh is a shortcut.
 *
 * Reads and writes lib/music/audioStore, exactly as the floating pill does —
 * two views, one player. Nothing here owns any audio.
 */

import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import {
  ensureAudio,
  fetchUnlockedTracks,
  formatTime,
  getState,
  nextTrack,
  playTrack,
  prevTrack,
  seekRatio,
  setVolume,
  subscribe,
  togglePlay,
} from '@/lib/music/audioStore'

/** Warm parchment, matching the pill so the two read as one instrument. */
const C = {
  panel: '#fdf0e0',
  border: '#8b5e3c',
  text: '#3d1c08',
  subtext: '#6b3a1f',
  track: '#e8c9a0',
  ink: '#8b5e3c',
  inkLight: '#f5e6d0',
}

export interface RadioPanelProps {
  open: boolean
  onClose: () => void
  /** Opened straight onto the track list — the dial does this. */
  playlistOpen?: boolean
  onPlaylistOpenChange?: (open: boolean) => void
}

export function RadioPanel({ open, onClose, playlistOpen, onPlaylistOpenChange }: RadioPanelProps) {
  const { t } = useLanguage()
  const [, forceUpdate] = useState(0)
  const rerender = useCallback(() => forceUpdate(n => n + 1), [])

  useEffect(() => {
    const unsubscribe = subscribe(rerender)
    ensureAudio()
    fetchUnlockedTracks()
    const onUpdate = () => fetchUnlockedTracks(true)
    window.addEventListener('music-tracks-updated', onUpdate)
    return () => {
      unsubscribe()
      window.removeEventListener('music-tracks-updated', onUpdate)
    }
  }, [rerender])

  // Escape closes, so the panel is not a trap for anyone on a keyboard.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const { isPlaying, trackIndex, progress, duration, playlist, volume } = getState()
  const showList = !!playlistOpen
  const current = playlist[trackIndex] ?? null

  if (!open) return null

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    seekRatio((e.clientX - rect.left) / rect.width)
  }

  return (
    <div
      className="absolute z-20 w-56 rounded-xl shadow-2xl"
      style={{ background: C.panel, border: `1px solid ${C.border}`, right: '4%', bottom: '6%', padding: 12 }}
      // The stage below opens the book on click; a click in here must not.
      onClick={e => e.stopPropagation()}
      role="dialog"
      aria-label={t('radio.title')}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold" style={{ color: C.text }}>📻 {t('radio.title')}</span>
        <button
          onClick={onClose}
          aria-label={t('radio.close')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.subtext, fontSize: 16, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      <p className="truncate text-[11px] mb-2" style={{ color: C.subtext }}>
        {/* Track titles are author-written content, shown as typed. */}
        {current ? current.title : t('radio.noTracks')}
      </p>

      <div onClick={seek} style={{ height: 5, background: C.track, borderRadius: 3, marginBottom: 4, cursor: 'pointer', overflow: 'hidden' }}>
        <div style={{ width: `${progress * 100}%`, height: '100%', background: C.ink }} />
      </div>
      <div className="flex justify-between text-[10px] mb-2" style={{ color: C.subtext }}>
        <span>{formatTime(progress * duration)}</span><span>{formatTime(duration)}</span>
      </div>

      <div className="flex items-center justify-center gap-3 mb-2">
        <button onClick={prevTrack} disabled={playlist.length < 2} aria-label={t('radio.previous')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.ink, padding: 2, lineHeight: 1 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 3h1.5v10H3V3zm2.5 5L12 13V3L5.5 8z" /></svg>
        </button>
        <button onClick={togglePlay} aria-label={isPlaying ? t('radio.pause') : t('radio.play')}
          style={{ background: C.ink, border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isPlaying
            ? <svg width="13" height="13" viewBox="0 0 14 14" fill="white"><rect x="2" y="1" width="4" height="12" /><rect x="8" y="1" width="4" height="12" /></svg>
            : <svg width="13" height="13" viewBox="0 0 14 14" fill="white"><path d="M3 1l10 6-10 6V1z" /></svg>}
        </button>
        <button onClick={nextTrack} disabled={playlist.length < 2} aria-label={t('radio.next')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.ink, padding: 2, lineHeight: 1 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 3h1.5v10h-1.5V3zm-8 5L10 3v10L3.5 8z" /></svg>
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] shrink-0">🔈</span>
        <input
          type="range" min={0} max={1} step={0.05} value={volume}
          aria-label={t('radio.volume')}
          onChange={e => setVolume(Number(e.target.value))}
          style={{ flex: 1, minWidth: 0, accentColor: C.ink, cursor: 'pointer' }}
        />
        <span className="text-[11px] shrink-0">🔊</span>
      </div>

      <button
        onClick={() => onPlaylistOpenChange?.(!showList)}
        style={{ width: '100%', background: showList ? C.inkLight : C.panel, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.ink, fontWeight: 600, padding: '5px 0', cursor: 'pointer' }}
      >
        {showList ? `▲ ${t('radio.hidePlaylist')}` : `▼ ${t('radio.choosePlaylist')}`}
      </button>

      {showList && (
        <div className="mt-2 overflow-y-auto rounded-lg" style={{ maxHeight: 120, border: `1px solid ${C.border}` }}>
          {playlist.map((track, idx) => (
            <button
              key={`${track.file}-${idx}`}
              onClick={() => { playTrack(idx); onPlaylistOpenChange?.(false) }}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px]"
              style={{
                fontWeight: idx === trackIndex ? 700 : 400,
                color: idx === trackIndex ? C.ink : C.text,
                background: idx === trackIndex ? C.inkLight : 'transparent',
                border: 'none', cursor: 'pointer',
              }}
            >
              {idx === trackIndex && isPlaying
                ? <span style={{ color: C.ink }}>♪</span>
                : <span style={{ width: 10, color: C.subtext, fontSize: 9 }}>{idx + 1}</span>}
              <span className="truncate">{track.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
