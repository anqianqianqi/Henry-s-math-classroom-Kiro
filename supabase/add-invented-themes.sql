-- ============================================================
-- Invented themes — Database Migration
-- ============================================================
-- Lets a room or bundle recipe an admin liked be promoted into a
-- reusable THEME, so the generator's library grows instead of
-- discarding every good roll.
--
-- Creates:
--   challenge_room_themes  — the RoomTheme shape, one row per world
--   book_bundle_themes     — the BookTheme shape
--
-- Both mirror the TypeScript constants in lib/challengeRoom/themes.ts
-- and bookThemes.ts. Those constants are NOT migrated in: they stay
-- the seed set, and the read path returns constants UNION rows. That
-- way a bad row can be deactivated without losing the originals, and
-- the originals stay reviewable in code.
--
-- Every list column is JSONB holding an array of strings. A theme is
-- lists, not strings, on purpose — see the header of themes.ts. A row
-- whose lists are single-element is a theme that can only ever make
-- one room, which is the bug that file exists to prevent, so
-- promotion APPENDS to a matching name rather than inserting a rival.
--
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS throughout).
-- ============================================================

CREATE TABLE IF NOT EXISTS challenge_room_themes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- UNIQUE is load-bearing: promotion looks a theme up by name and folds
  -- the new recipe into it. Two rows with one name would silently split a
  -- world in half and each would stay one-room-sized.
  name          TEXT NOT NULL UNIQUE,

  family        TEXT NOT NULL DEFAULT 'everyday'
                  CHECK (family IN ('nature','science','fantasy','history','everyday')),

  -- ART_STYLES ids this world can carry without falling apart.
  styles        JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- The two that decide whether a re-roll gives a different ROOM or the
  -- same room with different trinkets.
  architectures JSONB NOT NULL DEFAULT '[]'::jsonb,
  material_sets JSONB NOT NULL DEFAULT '[]'::jsonb,

  palettes      JSONB NOT NULL DEFAULT '[]'::jsonb,
  moods         JSONB NOT NULL DEFAULT '[]'::jsonb,
  lighting      JSONB NOT NULL DEFAULT '[]'::jsonb,
  apertures     JSONB NOT NULL DEFAULT '[]'::jsonb,
  views         JSONB NOT NULL DEFAULT '[]'::jsonb,
  accents       JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Four are dealt per roll, so four is the floor. Below it the prompt
  -- compiler reads objects[3] as undefined.
  objects       JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- The classification vector this world was first invented from, if any.
  -- Feeds the coverage map: which of the 19,440 cells has the site visited?
  axes          JSONB,

  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crt_active ON challenge_room_themes(is_active);

CREATE TABLE IF NOT EXISTS book_bundle_themes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,

  family        TEXT NOT NULL DEFAULT 'everyday'
                  CHECK (family IN ('nature','science','fantasy','history','everyday')),

  styles        JSONB NOT NULL DEFAULT '[]'::jsonb,
  palettes      JSONB NOT NULL DEFAULT '[]'::jsonb,
  moods         JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- What the COVER is bound in: cloth, leather, lacquer, veneer, metal.
  -- A bound book is not made of one substance, so this is separate from the
  -- inner page's paper below; the two match on colour, never on texture.
  cover_surfaces JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- What the INNER PAGE is. Always a paper. Never a colour — a colour word
  -- in either material list takes the ground back from `grounds` below.
  papers        JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- What colour the sheet IS. One name per entry, carried by both halves:
  -- full strength on the cover, a pale tint of the same hue on the inner page.
  grounds       JSONB NOT NULL DEFAULT '[]'::jsonb,

  frames        JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Must stay quiet: problem text is printed over the inner page.
  inner_accents JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Four dealt per roll, same floor as objects above.
  clusters      JSONB NOT NULL DEFAULT '[]'::jsonb,

  axes          JSONB,

  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bbt_active ON book_bundle_themes(is_active);

-- `grounds` was added after this file had already been applied once, and
-- CREATE TABLE IF NOT EXISTS will not add a column to a table that exists.
-- Themes promoted before it are left with an empty list, which the prompt
-- compiler handles by falling back to the palette's deepest tone.
ALTER TABLE book_bundle_themes
  ADD COLUMN IF NOT EXISTS grounds JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE book_bundle_themes
  ADD COLUMN IF NOT EXISTS cover_surfaces JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ============================================================
-- RLS
-- ============================================================
-- Unlike challenge_rooms and book_texture_packages, these are never read
-- by a student: a theme is an ingredient for the admin designer, not an
-- asset anybody owns or selects. So there is no public-visibility branch
-- and no shop_item_id — teachers and administrators only, both ways.
ALTER TABLE challenge_room_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_bundle_themes    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crt_admin_all" ON challenge_room_themes;
CREATE POLICY "crt_admin_all"
  ON challenge_room_themes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );

DROP POLICY IF EXISTS "bbt_admin_all" ON book_bundle_themes;
CREATE POLICY "bbt_admin_all"
  ON book_bundle_themes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );
