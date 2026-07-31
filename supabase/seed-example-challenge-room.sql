-- ============================================================
-- Seed the example ChallengeRoom + book texture package
-- ============================================================
-- Creates one of each so the 3D path can be evaluated end to end:
--   challenge_rooms       <- moonlit-tide-observatory.storyframe
--   book_texture_packages <- little-celestial-herbarium.storyframe-book
--
-- Values are taken verbatim from the storyframe manifests, EXCEPT loop
-- (see the note on the animation block below).
--
-- PREREQUISITE — upload these 4 files first, via the Supabase dashboard
-- (Storage -> book-skins). The dashboard uses the service role, so it is not
-- subject to the `${uid}/...` path rule that the app's uploads must follow:
--
--   seed-assets/room.png        -> book-skins bucket, examples/room.png
--   seed-assets/front-cover.png -> book-skins bucket, examples/front-cover.png
--   seed-assets/other-pages.png -> book-skins bucket, examples/other-pages.png
--
-- The GLB is NOT referenced here — it is named only by the env var
-- NEXT_PUBLIC_CHALLENGE_ROOM_MODEL_URL, and now lives in its own public
-- `models` bucket because book-skins rejects non-image MIME types.
-- model_key below is just a text label recording which bake was tuned against.
--
-- Storage paths are CASE-SENSITIVE.
--
-- Requires add-bundle-default-and-retire-page-skins.sql to have been run first
-- (this seeds is_default, which that migration adds).
--
-- (seed-assets/ is in the ChallengeRoomGeneration folder.)
--
-- The URLs below are already filled in for project thgaokonzsabpvhfbfdy. Verify each
-- matches what the dashboard shows before running this.
--
-- The bucket must allow PUBLIC READS or the browser cannot fetch the GLB or the
-- textures. The app already calls getPublicUrl() on book-skins, so this is very
-- likely already true — confirm before blaming the code for a blank book.
-- ============================================================

-- Both inserts are attributed to the first global administrator/teacher.
-- Adjust if you want them owned by a specific account.
WITH owner AS (
  SELECT ur.user_id
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.class_id IS NULL
    AND r.name IN ('administrator', 'teacher')
  ORDER BY r.name
  LIMIT 1
)

-- ── The book texture package (cover + inner page pair) ──────
INSERT INTO book_texture_packages
  (name, description, cover_url, inner_url, recipe, visibility, is_active, is_default, created_by)
SELECT
  'Little Celestial Herbarium',
  'Example package imported from storyframe — watercolour cover with matching blank inner page.',
  'https://thgaokonzsabpvhfbfdy.supabase.co/storage/v1/object/public/book-skins/examples/front-cover.png',
  'https://thgaokonzsabpvhfbfdy.supabase.co/storage/v1/object/public/book-skins/examples/other-pages.png',
  '{
    "name": "Little Celestial Herbarium",
    "mood": "curious, refined, magical",
    "palette": "vellum cream, indigo, sage, plum, antique gold",
    "paper": "warm vellum-toned watercolor paper with restrained botanical grain",
    "frame": "precise antique-gold botanical linework dotted with tiny constellations",
    "cornerClusters": [
      "a poppy seed head with a tiny moon compass",
      "figs and rosemary with a dotted porcelain teacup",
      "a luna moth on an oak leaf with an acorn and berries",
      "a violet pansy with a miniature brass telescope"
    ],
    "notes": ""
  }'::jsonb,
  -- admin_only so students cannot select it until you have looked at it
  'admin_only',
  true,
  -- The one instance, so anyone in a room gets this book art without choosing.
  true,
  owner.user_id
FROM owner;

-- ── The challenge room ─────────────────────────────────────
WITH owner AS (
  SELECT ur.user_id
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.class_id IS NULL
    AND r.name IN ('administrator', 'teacher')
  ORDER BY r.name
  LIMIT 1
)
INSERT INTO challenge_rooms
  (name, description, room_url, recipe, placement, animation, model_key,
   visibility, is_active, is_default, created_by)
SELECT
  'Moonlit Tide Observatory',
  'Example room imported from storyframe — dark-wood observatory with an underwater kelp view.',
  'https://thgaokonzsabpvhfbfdy.supabase.co/storage/v1/object/public/book-skins/examples/room.png',
  '{
    "name": "Moonlit Tide Observatory",
    "mood": "hushed, enchanted, contemplative",
    "palette": "deep teal, midnight blue, antique brass, warm amber",
    "architecture": "an intimate dark-wood observatory-library with carved arches and restrained climbing ivy",
    "materials": "walnut, aged brass, smoky glass, woven linen",
    "lighting": "warm pools of lamplight balanced against cool underwater moonlight",
    "outsideView": "a luminous kelp forest beneath a moonlit ocean surface",
    "leftObjects": ["a compact brass armillary sphere", "an amber stained-glass desk lamp"],
    "rightObjects": ["a small inkwell with a gold quill", "a precision celestial dial"],
    "accent": "tiny constellations etched into the brass details",
    "notes": ""
  }'::jsonb,
  -- Straight from the manifest. These numbers only transfer because the port
  -- kept storyframe's normalisation identical: MODEL_TARGET_SIZE 2.35 and an
  -- orthographic viewHeight of 4. Change either and every saved placement moves.
  '{
    "x": 0.9419784646370749,
    "y": -1.2262003253544038,
    "scale": 1.31,
    "tilt": 58,
    "turn": 0,
    "roll": 0
  }'::jsonb,
  -- The manifest says loop:true, which is right for storyframe's continuous
  -- flip preview. Seeded false here so the book comes to rest on the frame-203
  -- spread, which is the pose students work on.
  '{
    "clip": "Scene",
    "startFrame": 1,
    "endFrame": 203,
    "playbackFps": 80,
    "loop": false,
    "sourceFps": 24
  }'::jsonb,
  'pageflix-web-smooth-203',
  -- admin_only while you evaluate. NOTE: is_default below only takes effect for
  -- students once this is 'public' and active, so seeding it default here does
  -- not switch the 3D room on for the class.
  'admin_only',
  true,
  true,
  owner.user_id
FROM owner;

-- ── Select them for YOUR account ───────────────────────────
-- Creating the rows is not enough: the challenge page reads the student's
-- user_book_skin_preferences, and there is no student-facing picker UI yet.
-- Without this step challengeScene stays null and you get the old 2D book.
--
-- Replace the email with your own login. Both columns must be set together --
-- ubsp_package_requires_room rejects a package without a room.
INSERT INTO user_book_skin_preferences (user_id, challenge_room_id, texture_package_id)
SELECT
  p.id,
  (SELECT id FROM challenge_rooms       WHERE name = 'Moonlit Tide Observatory'   LIMIT 1),
  (SELECT id FROM book_texture_packages WHERE name = 'Little Celestial Herbarium' LIMIT 1)
FROM profiles p
WHERE p.email = 'shinnyih1@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  challenge_room_id  = EXCLUDED.challenge_room_id,
  texture_package_id = EXCLUDED.texture_package_id,
  updated_at         = now();

-- To go back to the 2D book at any time:
--   UPDATE user_book_skin_preferences
--      SET texture_package_id = NULL, challenge_room_id = NULL
--    WHERE user_id = (SELECT id FROM profiles WHERE email = 'shinnyih1@gmail.com');

-- ── Verify ─────────────────────────────────────────────────
SELECT 'challenge_rooms' AS table_name, name, model_key,
       placement->>'tilt' AS tilt, animation->>'endFrame' AS end_frame
FROM challenge_rooms
UNION ALL
SELECT 'book_texture_packages', name, NULL, NULL, NULL
FROM book_texture_packages;

-- Confirm the selection took, and that the URLs are reachable
SELECT p.email, cr.name AS room, btp.name AS package,
       cr.room_url, btp.cover_url, btp.inner_url
FROM user_book_skin_preferences u
JOIN profiles p ON p.id = u.user_id
LEFT JOIN challenge_rooms cr ON cr.id = u.challenge_room_id
LEFT JOIN book_texture_packages btp ON btp.id = u.texture_package_id
WHERE u.challenge_room_id IS NOT NULL;
