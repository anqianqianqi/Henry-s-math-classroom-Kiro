-- ─────────────────────────────────────────────────────────────────────────────
-- A radio on the challenge room's window sill.
--
-- Two additive, nullable columns. Nothing is backfilled and nothing changes for
-- an existing room: NULL radio_placement means "this room has no radio", which
-- is every room until an admin places one. The feature therefore ships dark and
-- turns on room by room, rather than appearing everywhere the moment it merges.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- Where the radio stands, in the same 6-DOF shape as challenge_rooms.placement:
--   { "x": 1.6, "y": 0.72, "scale": 0.9, "tilt": 0, "turn": -18, "roll": 0 }
--
-- Per room because the window is painted into the plate at a different spot in
-- every one — the prompt guarantees a centred aperture with a broad sill, not a
-- fixed pixel position. Tuned in the admin tool against that room's own art.
ALTER TABLE challenge_rooms
  ADD COLUMN IF NOT EXISTS radio_placement JSONB;

-- The student's chosen colourway, as an id from lib/challengeRoom/radio.ts
-- (original-walnut, forest-room, atlantic-blue, bordeaux, pistachio).
--
-- Stored as TEXT rather than a foreign key: the palettes are baked files in the
-- repo, not rows, so there is no table to point at. An unknown id falls back to
-- walnut at read time, which is why there is no CHECK constraint here — adding
-- one would turn a renamed palette into a save failure instead of a default.
ALTER TABLE user_book_skin_preferences
  ADD COLUMN IF NOT EXISTS radio_palette TEXT;

COMMENT ON COLUMN challenge_rooms.radio_placement IS
  'Optional 6-DOF placement for the vintage radio. NULL = this room has no radio.';
COMMENT ON COLUMN user_book_skin_preferences.radio_palette IS
  'Baked radio colourway id from lib/challengeRoom/radio.ts. NULL = default walnut.';
