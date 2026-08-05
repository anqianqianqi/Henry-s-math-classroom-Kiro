/**
 * The one piece of audio on the site, and the state around it.
 *
 * ── WHY THIS IS A MODULE AND NOT A HOOK OR A CONTEXT ────────
 * Playback has to survive React remounting. The root layout re-renders on every
 * client-side navigation, so anything owning the <audio> element inside a
 * component tree would stop the music every time a student opened a challenge.
 * Module scope outlives all of that. This was already true when the singletons
 * lived inside MusicPlayer.tsx; moving them here changes nothing about their
 * lifetime.
 *
 * ── WHY IT MOVED OUT OF THE PET ─────────────────────────────
 * The floating pill is docked to Didi, and the challenge room now wants a
 * second control — a radio on the window sill. Two UIs, one piece of audio.
 * Neither can own it, so neither does: both subscribe here.
 *
 * Deliberately free of React and of the DOM beyond `Audio`, so the behaviour
 * can be tested directly.
 */

import { PLAYLIST, type Track } from '@/lib/music-playlist'

export interface MusicState {
  playlist: Track[]
  trackIndex: number
  isPlaying: boolean
  volume: number
  /** 0–1 through the current track. */
  progress: number
  /** Seconds, or 0 before metadata arrives. */
  duration: number
}

/** Shuffled once per browser session, so the order is stable while browsing. */
function buildShuffledPlaylist(): Track[] {
  const arr = [...PLAYLIST]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
  }
  return arr
}

let audio: HTMLAudioElement | null = null
let playlist = buildShuffledPlaylist()
let trackIndex = 0
let isPlaying = false
let volume = 0.6
let progress = 0
let duration = 0

type Listener = () => void
const listeners = new Set<Listener>()

function notifyAll() { listeners.forEach(fn => fn()) }

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getState(): MusicState {
  return { playlist, trackIndex, isPlaying, volume, progress, duration }
}

export function currentTrack(): Track | null {
  return playlist[trackIndex] ?? null
}

const srcFor = (track: Track) => `/music/${track.file}`

/**
 * Creates the element on first use.
 *
 * Lazy because this module is imported during SSR, where `Audio` does not
 * exist. Every entry point goes through here rather than touching `audio`.
 */
export function ensureAudio(): HTMLAudioElement | null {
  if (audio) return audio
  if (typeof window === 'undefined') return null

  const el = new Audio()
  el.loop = false
  el.volume = volume
  audio = el

  el.addEventListener('timeupdate', () => {
    if (el.duration > 0) { progress = el.currentTime / el.duration; notifyAll() }
  })
  el.addEventListener('loadedmetadata', () => { duration = el.duration; notifyAll() })
  el.addEventListener('play',  () => { isPlaying = true;  notifyAll() })
  el.addEventListener('pause', () => { isPlaying = false; notifyAll() })
  el.addEventListener('ended', () => {
    // Roll straight into the next track — the playlist is background music, and
    // stopping at the end of each one would mean clicking every few minutes.
    trackIndex = (trackIndex + 1) % playlist.length
    const next = playlist[trackIndex]
    if (next) {
      el.src = srcFor(next)
      el.load()
      el.addEventListener('canplay', function onCan() {
        el.removeEventListener('canplay', onCan)
        el.play().catch(() => { isPlaying = false; notifyAll() })
      })
    }
    notifyAll()
  })

  return el
}

// ── Shop-unlocked tracks ────────────────────────────────────────────────────

let unlockedFetched = false

/**
 * Merges tracks the student has bought into the playlist.
 *
 * The guard is load-bearing now in a way it was not before: with the pill and
 * the room radio both mounting, an unguarded fetch runs once per view rather
 * than once per session.
 */
export function fetchUnlockedTracks(force = false): void {
  if (unlockedFetched && !force) return
  unlockedFetched = true
  fetch('/api/music/unlocked')
    .then(r => r.json())
    .then(({ tracks }: { tracks: Track[] }) => {
      if (!tracks?.length) return
      const existing = new Set(playlist.map(t => t.file))
      const added = tracks.filter(t => !existing.has(t.file))
      if (!added.length) return
      playlist = [...playlist, ...added]
      notifyAll()
    })
    .catch(() => { /* silent — the student may not be signed in */ })
}

// ── Controls ────────────────────────────────────────────────────────────────

export function togglePlay(): void {
  const el = ensureAudio()
  const track = currentTrack()
  if (!el || !track) return
  if (isPlaying) {
    el.pause()
    return
  }
  // Only reload when the element is pointed somewhere else; re-setting src on
  // the current track would restart it instead of resuming.
  if (!el.src || !el.src.endsWith(track.file)) {
    el.src = srcFor(track)
    el.load()
  }
  el.play().catch(() => { isPlaying = false; notifyAll() })
}

export function playTrack(index: number): void {
  const el = ensureAudio()
  if (!el) return
  const track = playlist[index]
  if (!track) return
  trackIndex = index
  el.src = srcFor(track)
  el.load()
  const onCan = () => {
    el.removeEventListener('canplay', onCan)
    el.play().catch(() => { isPlaying = false; notifyAll() })
  }
  el.addEventListener('canplay', onCan)
  notifyAll()
}

export function nextTrack(): void {
  if (playlist.length === 0) return
  playTrack((trackIndex + 1) % playlist.length)
}

export function prevTrack(): void {
  if (playlist.length === 0) return
  playTrack((trackIndex - 1 + playlist.length) % playlist.length)
}

/** Ratio 0–1 through the current track. */
export function seekRatio(ratio: number): void {
  if (!audio || !audio.duration) return
  const clamped = Math.max(0, Math.min(1, ratio))
  audio.currentTime = clamped * audio.duration
  progress = clamped
  notifyAll()
}

export function setVolume(next: number): void {
  volume = Math.max(0, Math.min(1, next))
  if (audio) audio.volume = volume
  notifyAll()
}

/** m:ss, for both the pill and the radio card. */
export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

/**
 * Test seam only. Nothing in the app resets a session's audio, and calling this
 * in the browser would orphan the element rather than stop it.
 */
export function __resetForTests(next?: Partial<MusicState>): void {
  audio = null
  playlist = next?.playlist ?? buildShuffledPlaylist()
  trackIndex = next?.trackIndex ?? 0
  isPlaying = next?.isPlaying ?? false
  volume = next?.volume ?? 0.6
  progress = next?.progress ?? 0
  duration = next?.duration ?? 0
  unlockedFetched = false
  listeners.clear()
}
