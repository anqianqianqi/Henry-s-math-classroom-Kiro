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

/**
 * Which family a theme belongs to. Groups the chips in the admin pickers and
 * mirrors the /book-skins families.
 *
 * Lives here rather than in themes.ts because AxisVector below needs it and
 * themes.ts imports from this file — the other direction would be a cycle.
 * themes.ts re-exports it, so existing importers are unaffected.
 */
export type ThemeFamily = 'nature' | 'science' | 'fantasy' | 'history' | 'everyday'

/**
 * Coordinates in theme space — see lib/challengeRoom/axes.ts for what these
 * mean and why a recipe is rolled before it is written.
 *
 * Part of the persisted recipe, which is why the shape is declared here with
 * the other JSONB types. A saved room records the cell it came from, so the
 * coverage map can be rebuilt from the rooms themselves rather than from a
 * separate log that could drift out of step with them.
 */
export interface AxisVector {
  family: ThemeFamily
  substrate: 'paper' | 'stone' | 'metal' | 'wood' | 'textile' | 'synthetic'
  era: 'ancient' | 'period' | 'contemporary' | 'speculative'
  lightKey: 'high-key' | 'low-key' | 'mixed'
  temperature: 'warm' | 'cool' | 'split'
  ornament: 'sparse' | 'medium' | 'dense'
  motif: 'botanical' | 'marine' | 'celestial' | 'mechanical' | 'geometric' | 'culinary'
}

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
  /** Set only on invented recipes. Ignored by the prompt compiler. */
  axes?: AxisVector
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
  /** What the INNER PAGE is made of. Always a paper; see coverSurface above. */
  paper: string
  frame: string
  /** Exactly four: top-left, top-right, bottom-left, bottom-right. */
  cornerClusters: [string, string, string, string]
  notes: string

  /** Optional for the same reason as RoomSpec's — see the note there. */
  artStyle?: string
  /** The sparse motif edging the inner page. Absent keeps the botanical default. */
  innerAccent?: string

  /**
   * What the COVER is made of — cloth over board, leather, lacquer, veneer,
   * anodised metal. Texture and material only, never a colour.
   *
   * Split from `paper` because a bound book is not made of one material: the
   * boards are cloth or hide and the pages are paper, and collapsing the two
   * meant every cover rendered as a sheet of paper. `paper` below now means the
   * inner page alone.
   *
   * Optional so a recipe saved before the split still compiles — those fall
   * back to `paper`, which is exactly what they used to use for both halves.
   */
  coverSurface?: string

  /**
   * The sheet's colour — ONE colour name, carried by both halves.
   *
   * The cover takes it at full strength and the inner page takes a pale tint of
   * the same hue, so the pair reads as one set rather than two books. Paper
   * names feel only; this names colour.
   *
   * Optional for the reason given above: a recipe saved before it existed must
   * still compile, so the compiler falls back to the palette's deepest tone.
   */
  ground?: string
  /** Set only on invented recipes. Ignored by the prompt compiler. */
  axes?: AxisVector
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
  /**
   * How far behind the object its shadow falls, in world units.
   *
   * The shadow catcher used to sit at a fixed -1.2 for every room. Rooms are
   * painted at different scales, so on some of them the book's shadow landed
   * well behind where the tabletop appears to be and the book read as hovering
   * over it. Optional: absent means the old fixed distance, so every saved
   * room keeps exactly the look it was tuned to.
   */
  shadowDepth?: number
}

/**
 * Where the shadow catcher sits when a room does not say.
 *
 * Superseded by lightPosition below, which is the control an admin actually
 * has intuitions about. Still honoured, so a room tuned with it before the
 * light became adjustable does not shift.
 *
 * Lives here rather than beside the plane it positions: RoomPlacementStage
 * imports all of three.js, and the admin page loads that lazily on purpose. A
 * static import of one number from it would drag the whole renderer into the
 * page's first bundle.
 */
export const DEFAULT_SHADOW_DEPTH = -1.2

/**
 * The key light, in world units — the lamp that casts the shadows.
 *
 * Per room, because the plates are paintings with their own light in them: a
 * storm through a window on the left and a desk lamp on the right want the
 * shadow going opposite ways, and one hardcoded direction cannot serve both.
 * Moving the light is also the honest control — "shadow depth" was a number
 * with no physical meaning, and getting a believable shadow out of it was
 * guesswork.
 *
 * Shared by the book and the radio, as one lamp in one room should be.
 */
export interface LightPosition {
  x: number
  y: number
  z: number
}

/** Where the key light sat before it was adjustable. */
export const DEFAULT_LIGHT_POSITION: LightPosition = { x: -4, y: 6, z: 8 }

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
