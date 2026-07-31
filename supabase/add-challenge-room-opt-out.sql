-- ============================================================
-- Explicit "no challenge room" opt-out
-- ============================================================
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- challenge_room_id IS NULL was being asked to mean two different things:
--
--   never chose anything      -> should get the default room
--   chose to have no room     -> should get the flat book
--
-- They are indistinguishable, so once an admin set a default room a student had
-- no way to opt out — clearing their choice just fell back to the default. Row
-- existence cannot stand in for the difference either, since the prefs row is
-- created as soon as someone picks a cover skin on /book-skins.
--
-- This column carries the second meaning explicitly.
-- ============================================================

ALTER TABLE user_book_skin_preferences
  ADD COLUMN IF NOT EXISTS challenge_room_opt_out BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN user_book_skin_preferences.challenge_room_opt_out IS
  'true = student has chosen to have no challenge room; the challenge page skips both their selection and the default. false = fall through to selection, then default.';

-- Deliberately NOT clearing challenge_room_id when this is set: keeping the
-- selection means toggling the room back on restores the room they had, rather
-- than dropping them onto the default.

-- ── Verify ──────────────────────────────────────────────────
SELECT
  count(*)                                            AS prefs_rows,
  count(*) FILTER (WHERE challenge_room_opt_out)      AS opted_out,
  count(*) FILTER (WHERE challenge_room_id IS NOT NULL) AS has_room_selected
FROM user_book_skin_preferences;
