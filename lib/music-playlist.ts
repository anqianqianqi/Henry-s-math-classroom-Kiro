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
  // Add your tracks here once you upload the files:
  // { file: 'study-1.mp3', title: '晨光' },
  // { file: 'calm-piano.mp3', title: 'Calm Piano' },
  // { file: 'rainy-afternoon.mp3', title: 'Rainy Afternoon' },
]
