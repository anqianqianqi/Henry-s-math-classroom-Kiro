/**
 * Resolves the URL of the baked book GLB.
 *
 * Unlike the storyframe studio, admins never upload a model — there is exactly
 * one, shared by every challenge room. Upload it once to the `book-skins`
 * bucket and point NEXT_PUBLIC_CHALLENGE_ROOM_MODEL_URL at its public URL.
 *
 * The asset is PageFlix-web-smooth-203-notex.glb (2.63 MiB): baked shape-key
 * animation trimmed to frame 203, with the unused embedded textures stripped.
 * Do not substitute a model with embedded textures — it is ~4x larger for no
 * visual gain, since every page material's map is replaced at load time.
 */

export function bookModelUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_CHALLENGE_ROOM_MODEL_URL
  return url && url.trim() ? url.trim() : null
}

export const MODEL_SETUP_HINT =
  'Upload PageFlix-web-smooth-203-notex.glb to the book-skins storage bucket, ' +
  'then set NEXT_PUBLIC_CHALLENGE_ROOM_MODEL_URL to its public URL and restart the dev server.'
