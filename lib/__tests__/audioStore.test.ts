import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetForTests,
  currentTrack,
  ensureAudio,
  formatTime,
  getState,
  nextTrack,
  playTrack,
  prevTrack,
  seekRatio,
  setVolume,
  subscribe,
  togglePlay,
} from '../music/audioStore'

/**
 * The point of this module is that the pill and the room radio are two views of
 * ONE player, not two players. Everything here is that claim: state is shared,
 * every subscriber hears about every change, and nothing needs React or a real
 * DOM to be true.
 */

/** Enough of HTMLAudioElement to exercise the store. */
class FakeAudio {
  src = ''
  volume = 1
  duration = 120
  currentTime = 0
  loop = false
  paused = true
  private handlers: Record<string, Array<() => void>> = {}

  addEventListener(type: string, fn: () => void) {
    (this.handlers[type] ||= []).push(fn)
  }
  removeEventListener(type: string, fn: () => void) {
    this.handlers[type] = (this.handlers[type] ?? []).filter(h => h !== fn)
  }
  emit(type: string) { for (const fn of [...(this.handlers[type] ?? [])]) fn() }

  load() { /* no-op; tests drive `canplay` explicitly */ }
  play() { this.paused = false; this.emit('play'); return Promise.resolve() }
  pause() { this.paused = true; this.emit('pause') }
}

let fake: FakeAudio

beforeEach(() => {
  fake = new FakeAudio()
  vi.stubGlobal('Audio', function () { return fake } as unknown as typeof Audio)
  vi.stubGlobal('window', globalThis)
  __resetForTests({
    playlist: [
      { file: 'a.mp3', title: 'A' },
      { file: 'b.mp3', title: 'B' },
      { file: 'c.mp3', title: 'C' },
    ],
  })
})

describe('one player, many views', () => {
  it('notifies every subscriber of a change', () => {
    // The pill and the radio are exactly this: two subscribers.
    const pill = vi.fn()
    const radio = vi.fn()
    subscribe(pill)
    subscribe(radio)

    setVolume(0.25)

    expect(pill).toHaveBeenCalled()
    expect(radio).toHaveBeenCalled()
    expect(getState().volume).toBe(0.25)
  })

  it('stops notifying after unsubscribe', () => {
    const gone = vi.fn()
    const unsubscribe = subscribe(gone)
    unsubscribe()
    setVolume(0.3)
    expect(gone).not.toHaveBeenCalled()
  })

  it('lets one view start a track and the other read it back', () => {
    ensureAudio()
    playTrack(2)
    fake.emit('canplay')
    expect(getState().trackIndex).toBe(2)
    expect(currentTrack()?.file).toBe('c.mp3')
    expect(getState().isPlaying).toBe(true)
  })
})

describe('controls', () => {
  it('toggles play and pause on the same element', () => {
    ensureAudio()
    togglePlay()
    expect(getState().isPlaying).toBe(true)
    togglePlay()
    expect(getState().isPlaying).toBe(false)
  })

  it('does not restart the current track when resuming', () => {
    // Re-setting src on the track already loaded would jump back to 0:00,
    // which is the wrong thing for a pause/resume.
    ensureAudio()
    togglePlay()
    fake.currentTime = 42
    togglePlay()          // pause
    togglePlay()          // resume
    expect(fake.currentTime).toBe(42)
  })

  it('wraps forwards and backwards through the playlist', () => {
    ensureAudio()
    playTrack(0)
    prevTrack()
    expect(getState().trackIndex).toBe(2)
    nextTrack()
    expect(getState().trackIndex).toBe(0)
  })

  it('advances by itself when a track ends', () => {
    // Background music: stopping every few minutes would mean clicking again.
    ensureAudio()
    playTrack(0)
    fake.emit('ended')
    expect(getState().trackIndex).toBe(1)
  })

  it('seeks by ratio and clamps out-of-range input', () => {
    ensureAudio()
    playTrack(0)
    seekRatio(0.5)
    expect(fake.currentTime).toBe(60)
    seekRatio(2)
    expect(fake.currentTime).toBe(120)
    seekRatio(-1)
    expect(fake.currentTime).toBe(0)
  })

  it('clamps volume and pushes it to the element', () => {
    ensureAudio()
    setVolume(1.5)
    expect(getState().volume).toBe(1)
    expect(fake.volume).toBe(1)
    setVolume(-0.2)
    expect(getState().volume).toBe(0)
  })

  it('ignores controls on an empty playlist rather than throwing', () => {
    __resetForTests({ playlist: [] })
    ensureAudio()
    expect(() => { togglePlay(); nextTrack(); prevTrack() }).not.toThrow()
  })
})

describe('formatTime', () => {
  it('renders m:ss and survives junk', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(5)).toBe('0:05')
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(600)).toBe('10:00')
    expect(formatTime(NaN)).toBe('0:00')
  })
})
