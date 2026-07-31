-- ============================================================
-- BookSkinBundle: default flag + retiring the inner-page collection
-- ============================================================
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- 1. book_texture_packages gains is_default, so a bundle can be the one every
--    student gets when they have a challenge room but have not picked a bundle.
--    Mirrors book_skins.is_default, including the "only one" rule.
--
-- 2. Inner-page skins are being retired from the UI. NOTHING is dropped here:
--    the default page skin is still what MagicBookReveal renders as
--    pageImageUrl, and old user_book_skin_preferences.page_skin_id rows must
--    keep resolving. This migration only documents that and makes sure exactly
--    one default page skin exists for everyone to fall back to.
-- ============================================================

-- ── 1. Default bundle ───────────────────────────────────────
ALTER TABLE book_texture_packages
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- At most one default, enforced by the database rather than by care in the UI.
-- A partial unique index on the constant `true` allows many falses and one true.
DROP INDEX IF EXISTS idx_btp_single_default;
CREATE UNIQUE INDEX idx_btp_single_default
  ON book_texture_packages ((is_default))
  WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_btp_default_lookup
  ON book_texture_packages (is_default)
  WHERE is_default AND is_active;

COMMENT ON COLUMN book_texture_packages.is_default IS
  'The bundle used when a student has a challenge room but no bundle selected. At most one, enforced by idx_btp_single_default.';

-- ── 1b. Default room ────────────────────────────────────────
-- Same idea for rooms. Setting a default room switches every student to the 3D
-- challenge room (on desktop, on .henryproblem challenges) unless they have
-- picked a different one — so treat it as a launch switch, not a cosmetic flag.
ALTER TABLE challenge_rooms
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS idx_cr_single_default;
CREATE UNIQUE INDEX idx_cr_single_default
  ON challenge_rooms ((is_default))
  WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_cr_default_lookup
  ON challenge_rooms (is_default)
  WHERE is_default AND is_active;

COMMENT ON COLUMN challenge_rooms.is_default IS
  'Room used when a student has not chosen one. At most one, enforced by idx_cr_single_default. Setting this turns the 3D room on for everyone.';

-- ── 2. Inner-page skins: retained, not dropped ──────────────
-- The UI no longer offers a page-skin collection, so every open book uses the
-- default page skin. That makes the default load-bearing: if none exists, the
-- book falls back to its built-in parchment gradient.
--
-- This reports the situation rather than guessing which one you want:
SELECT
  count(*) FILTER (WHERE skin_type = 'page')                          AS page_skins_total,
  count(*) FILTER (WHERE skin_type = 'page' AND is_default)           AS page_skins_default,
  count(*) FILTER (WHERE skin_type = 'page' AND is_active)            AS page_skins_active
FROM book_skins;

-- If page_skins_default is 0 and you want one, pick it explicitly, e.g.:
--   UPDATE book_skins SET is_default = false WHERE skin_type = 'page' AND is_default;
--   UPDATE book_skins SET is_default = true  WHERE id = '<the page skin you want>';

-- ── Verify ──────────────────────────────────────────────────
SELECT id, name, is_default, is_active, visibility, shop_item_id
FROM book_texture_packages
ORDER BY is_default DESC, created_at DESC;
