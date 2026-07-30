-- ============================================================
-- ChallengeRoom + Book Texture Packages — Database Migration
-- ============================================================
-- Adds the 3D challenge-room rendering path alongside the existing
-- 2D book-skin path. Nothing here alters or drops existing tables'
-- data; book_skins / book_skin_frames / book_skin_overlays and all
-- past purchases keep working exactly as before.
--
-- Creates:
--   book_texture_packages  — cover + inner-page UV texture PAIR (type 2)
--   challenge_rooms        — room background plate + book placement/animation
--
-- Extends:
--   user_book_skin_preferences — adds challenge_room_id + texture_package_id
--
-- Ownership reuses the existing pattern: shop_item_id on the asset table,
-- purchases resolved through redemptions.item_id -> shop_items.id.
--
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS throughout).
-- ============================================================

-- ── Book texture packages (type 2: cover + inner page) ─────
-- Distinct from book_skins.skin_type='cover' (type 1), which is a
-- book-shaped TRANSPARENT png composited in the DOM with a title
-- layout + overlay objects. These are full-bleed 3:4 UV textures
-- (1536x2048) mapped onto GLB materials in the 3D path.
CREATE TABLE IF NOT EXISTS book_texture_packages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,

  -- Both are required: a package is atomic, generated from one recipe.
  cover_url    TEXT NOT NULL,   -- 1536x2048 full-bleed cover texture
  inner_url    TEXT NOT NULL,   -- 1536x2048 matching inner-page texture

  -- The BookSpec used to generate the pair, so it can be re-rolled/refined:
  -- { name, mood, palette, paper, frame, cornerClusters[4], notes }
  recipe       JSONB,

  visibility   TEXT NOT NULL DEFAULT 'admin_only'
                 CHECK (visibility IN ('admin_only', 'public')),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  shop_item_id UUID REFERENCES shop_items(id) ON DELETE SET NULL,
  created_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_btp_active     ON book_texture_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_btp_shop_item  ON book_texture_packages(shop_item_id);

-- ── Challenge rooms (the 3D scene) ──────────────────────────
CREATE TABLE IF NOT EXISTS challenge_rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,

  room_url     TEXT NOT NULL,   -- 1536x1024 room background plate

  -- The RoomSpec used to generate the plate:
  -- { name, mood, palette, architecture, materials, lighting,
  --   outsideView, leftObjects[2], rightObjects[2], accent, notes }
  recipe       JSONB,

  -- 6-DOF book placement tuned by the admin against THIS plate.
  -- Shape matches the storyframe manifest exactly so an exported
  -- .storyframe package can be imported verbatim.
  -- e.g. { "x": 0.94, "y": -1.23, "scale": 1.31, "tilt": 58, "turn": 0, "roll": 0 }
  placement    JSONB NOT NULL,

  -- Playback window over the baked GLB clip.
  -- e.g. { "clip": "Scene", "startFrame": 1, "endFrame": 203,
  --        "playbackFps": 80, "loop": false, "sourceFps": 24 }
  animation    JSONB NOT NULL,

  -- Which baked GLB this room was tuned against. One model today; the
  -- column exists so a future re-bake can coexist with rooms tuned
  -- against the old one instead of silently shifting their placement.
  model_key    TEXT NOT NULL DEFAULT 'pageflix-web-smooth-203',

  visibility   TEXT NOT NULL DEFAULT 'admin_only'
                 CHECK (visibility IN ('admin_only', 'public')),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  shop_item_id UUID REFERENCES shop_items(id) ON DELETE SET NULL,
  created_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cr_active    ON challenge_rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_cr_shop_item ON challenge_rooms(shop_item_id);

-- ── User selection ──────────────────────────────────────────
-- Added to the EXISTING prefs table rather than a new one, because the
-- challenge page already loads this row in its first query round — so the
-- 3D path costs no extra round trip.
ALTER TABLE user_book_skin_preferences
  ADD COLUMN IF NOT EXISTS challenge_room_id  UUID REFERENCES challenge_rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS texture_package_id UUID REFERENCES book_texture_packages(id) ON DELETE SET NULL;

-- A texture package is only meaningful in the 3D path: its textures are
-- full-bleed UV art with no title zone and no transparent book silhouette,
-- so it cannot render in the DOM book. Enforce "package requires room"
-- in the database so no code path can produce the invalid state.
ALTER TABLE user_book_skin_preferences
  DROP CONSTRAINT IF EXISTS ubsp_package_requires_room;
ALTER TABLE user_book_skin_preferences
  ADD CONSTRAINT ubsp_package_requires_room
  CHECK (texture_package_id IS NULL OR challenge_room_id IS NOT NULL);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE book_texture_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_rooms       ENABLE ROW LEVEL SECURITY;

-- Helper predicate used below: is the current user a teacher/admin?
-- (Written inline rather than as a function to match the style of the
--  surrounding migrations in this folder.)

-- ── book_texture_packages ──────────────────────────────────

-- SELECT: public+active to everyone signed in; admin_only visible to
-- teachers/admins; and always visible if the user OWNS it (so a
-- deactivated purchased package still renders, matching how
-- app/book-skins/page.tsx deliberately shows owned-but-inactive skins).
DROP POLICY IF EXISTS "btp_select" ON book_texture_packages;
CREATE POLICY "btp_select"
  ON book_texture_packages FOR SELECT
  USING (
    (visibility = 'public' AND is_active)
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
    OR (
      shop_item_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM redemptions rd
        WHERE rd.user_id = auth.uid()
          AND rd.item_id = book_texture_packages.shop_item_id
      )
    )
  );

DROP POLICY IF EXISTS "btp_admin_write" ON book_texture_packages;
CREATE POLICY "btp_admin_write"
  ON book_texture_packages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );

-- ── challenge_rooms ────────────────────────────────────────
DROP POLICY IF EXISTS "cr_select" ON challenge_rooms;
CREATE POLICY "cr_select"
  ON challenge_rooms FOR SELECT
  USING (
    (visibility = 'public' AND is_active)
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
    OR (
      shop_item_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM redemptions rd
        WHERE rd.user_id = auth.uid()
          AND rd.item_id = challenge_rooms.shop_item_id
      )
    )
  );

DROP POLICY IF EXISTS "cr_admin_write" ON challenge_rooms;
CREATE POLICY "cr_admin_write"
  ON challenge_rooms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );

-- ============================================================
-- NOTE ON INNER PAGE SKINS
-- ============================================================
-- book_skins.skin_type = 'page' rows are intentionally LEFT IN PLACE.
-- The default page skin is still read by the challenge page and passed to
-- MagicBookReveal as pageImageUrl. Retiring "Inner Page management" is a
-- UI-only change (hide the admin upload option and the user picker);
-- do NOT drop the rows, the 'page' enum value, or
-- user_book_skin_preferences.page_skin_id, or the existing 2D book loses
-- its page background and old prefs rows break.
-- ============================================================
