/**
 * Types for the ChallengeRoom 3D scene.
 *
 * A challenge room is a 2.5D composite: a flat AI-generated room plate as the
 * page background, with only the book rendered in WebGL on top. The room image
 * is never 3D — see components/challenge-room/RoomPlacementStage.tsx.
 *
 * Shapes intentionally mirror the storyframe manifest so a .storyframe export
 * can be imported verbatim. Stored as JSONB in challenge_rooms.
 */

/** The art-direction spec fed to the image prompt compiler. */
export interface RoomSpec {
  name: string
  mood: string
  palette: string
  architecture: string
  materials: string
  lighting: string
  outsideView: string
  /** Exactly two objects on the left of the table */
  leftObjects: [string, string]
  /** Exactly two objects on the right of the table */
  rightObjects: [string, string]
  accent: string
  notes: string

  /*
   * Added after the first rooms were made, so both are OPTIONAL and must stay
   * that way. A RoomSpec is persisted as challenge_rooms.recipe (JSONB) and
   * validated both in the admin page and again in the API route — making
   * either one required would 400 every existing recipe the moment somebody
   * hit regenerate.
   */

  /** An ART_STYLES id. Absent, blank or unknown all fall back to the old look. */
  artStyle?: string
  /** The window's form — "brass-ringed observation port". Absent keeps the arch. */
  aperture?: string
}

/**
 * Art direction for a cover + inner-page pair.
 *
 * Distinct from a book_skins cover: those are book-shaped transparent PNGs
 * composited in the DOM with a title layout and overlay objects. These are
 * full-bleed 3:4 UV textures mapped onto the GLB, so the two are not
 * interchangeable — which is why they live in their own table.
 */
export interface BookSpec {
  name: string
  mood: string
  palette: string
  paper: string
  frame: string
  /** Exactly four: top-left, top-right, bottom-left, bottom-right. */
  cornerClusters: [string, string, string, string]
  notes: string

  /** Optional for the same reason as RoomSpec's — see the note there. */
  artStyle?: string
  /** The sparse motif edging the inner page. Absent keeps the botanical default. */
  innerAccent?: string
}

/** A book_texture_packages row. */
export interface BookTexturePackage {
  id: string
  name: string
  description: string | null
  cover_url: string
  inner_url: string
  recipe: BookSpec | null
  visibility: 'admin_only' | 'public'
  is_active: boolean
  /** At most one, enforced by idx_btp_single_default. Used when the student
   *  has a room but has not chosen a bundle. */
  is_default: boolean
  shop_item_id: string | null
  created_by: string
  created_at: string
}

/** 6-DOF book placement, tuned by an admin against one specific room plate. */
export interface Placement {
  /** horizontal offset in world units */
  x: number
  /** vertical offset in world units */
  y: number
  scale: number
  /** degrees — around -55..+58 lays the book onto the tabletop */
  tilt: number
  turn: number
  roll: number
}

/** Playback window over the baked GLB clip. */
export interface AnimationConfig {
  clip: string
  startFrame: number
  endFrame: number
  playbackFps: number
  loop: boolean
  sourceFps: number
}

/** A challenge_rooms row. */
export interface ChallengeRoom {
  id: string
  name: string
  description: string | null
  room_url: string
  recipe: RoomSpec | null
  placement: Placement
  animation: AnimationConfig
  model_key: string
  visibility: 'admin_only' | 'public'
  is_active: boolean
  /** At most one, enforced by idx_cr_single_default. Setting it turns the 3D
   *  room on for every student who has not chosen one. */
  is_default: boolean
  shop_item_id: string | null
  created_by: string
  created_at: string
}

// ── Defaults ────────────────────────────────────────────────────────────────

/**
 * The book model is a fixed app asset — admins never upload a GLB.
 * Baked from PageFlix-web-smooth.blend, trimmed to frame 203 with the unused
 * embedded textures stripped (9.86 MiB -> 2.63 MiB).
 */
export const BOOK_MODEL_KEY = 'pageflix-web-smooth-203'

/**
 * Frame 203 is the settled two-page spread: Page-2 has landed on the left and
 * Page-3 has not yet lifted. Playing past it starts flipping the right page away.
 */
export const SPREAD_FRAME = 203

export const DEFAULT_ANIMATION: AnimationConfig = {
  clip: 'Scene',
  startFrame: 1,
  endFrame: SPREAD_FRAME,
  playbackFps: 80,
  // Stops on the spread instead of looping the flip.
  loop: false,
  sourceFps: 24,
}

export const DEFAULT_PLACEMENT: Placement = {
  x: 0,
  y: -0.78,
  scale: 1,
  tilt: -55,
  turn: 0,
  roll: 0,
}

// ── Material mapping ────────────────────────────────────────────────────────

/**
 * Which GLB material shows what. Determined empirically by evaluating the
 * baked mesh at frame 203 (see the z-heights: Page-2's back face sits above
 * Page-1's on the left stack, so it is the visible left page).
 *
 * Material names carry no semantics — they are Blender's auto-suffixed
 * duplicates — so they are matched by exact name, never by index or regex.
 */
export const BOOK_MATERIALS = {
  /** Page-1 front face — what you see with the book closed */
  cover: 'page_material_1.016',
  /** Page-2 back face — the visible LEFT page at frame 203 */
  leftPage: 'page_material_2.015',
  /** Page-3 front face — the visible RIGHT page at frame 203 */
  rightPage: 'page_material_3.006',
  /** Everything else textured; gets the generic inner-page art */
  otherPages: [
    'page_material_1.017',
    'page_material_2.014',
    'page_material_3.007',
  ],
} as const

/**
 * Faces that render horizontally mirrored unless corrected.
 *
 * The original GLB compensated with KHR_texture_transform scale [-1, 1], but
 * three.js writes that onto the texture object, so replacing material.map drops
 * it. We reapply it via repeat.x = -1 (with RepeatWrapping — ClampToEdge
 * ignores a negative repeat).
 *
 * ONLY the left page belongs here, confirmed visually by rendering the
 * asymmetric cover art onto both page faces and comparing corner clusters
 * against the recipe: the right page matched, the left was flipped.
 *
 * Do not add entries from a UV-vs-world-X measurement alone. That reading flips
 * sign purely because a sheet rotates over during the flip, so it reports the
 * cover as mirrored at frame 203 (where Page-1 faces away) and not mirrored at
 * frame 1 (where it faces the camera). Only a face that is actually toward the
 * camera can be judged, and the reliable way to judge it is to look.
 */
export const MIRRORED_U_MATERIALS: string[] = [
  'page_material_2.015',
]
