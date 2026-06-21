// ─────────────────────────────────────────────────────────────────────────────
// Playlist configuration — add your MP3 files to /public/music/
// and list them here with display titles.
// Files will be served at /music/<filename>
// ─────────────────────────────────────────────────────────────────────────────

export interface Track {
  file: string   // filename inside /public/music/
  title: string  // displayed in the player
}

export const PLAYLIST: Track[] = [
  { file: 'alex-morgan-study-lofi-music-548638.mp3', title: 'Study Lofi' },
  { file: 'the_mountain-study-vibe-136087.mp3', title: 'Study Vibe' },
  { file: 'the_mountain-geography-study-141463.mp3', title: 'Geography Study' },
  { file: 'jazzy.mp3', title: 'Jazzy' },
  { file: 'relaxing-jazz.mp3', title: 'Relaxing Jazz' },
]
