-- ─────────────────────────────────────────────────────────────────────────────
-- Pet Room Backgrounds
-- Stores room background images for the pet area on the dashboard.
-- Each background can have frame_slots (JSONB) defining overlay zones
-- where shop-purchased wall art can be placed.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pet_room_backgrounds (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  image_url    TEXT NOT NULL,
  -- frame_slots: array of overlay zones defined as % of image dimensions
  -- e.g. [{"id":"frame1","x":62,"y":8,"w":18,"h":28,"z_index":2,"default_image_url":"..."}]
  frame_slots  JSONB NOT NULL DEFAULT '[]',
  is_default   BOOLEAN NOT NULL DEFAULT false,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one default at a time (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pet_room_bg_default
  ON pet_room_backgrounds(is_default)
  WHERE is_default = true;

-- User preference: which background each student has selected
CREATE TABLE IF NOT EXISTS user_pet_room (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  background_id  UUID REFERENCES pet_room_backgrounds(id) ON DELETE SET NULL,
  -- slot_overrides: {"frame1": "https://...user_art.png"}
  slot_overrides JSONB NOT NULL DEFAULT '{}',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE pet_room_backgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pet_room ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pet_room_bg_read" ON pet_room_backgrounds;
CREATE POLICY "pet_room_bg_read"
  ON pet_room_backgrounds FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "pet_room_bg_admin_write" ON pet_room_backgrounds;
CREATE POLICY "pet_room_bg_admin_write"
  ON pet_room_backgrounds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

DROP POLICY IF EXISTS "user_pet_room_own" ON user_pet_room;
CREATE POLICY "user_pet_room_own"
  ON user_pet_room FOR ALL
  USING (user_id = auth.uid());

-- Seed: insert the generated room background as the default
INSERT INTO pet_room_backgrounds (name, description, image_url, is_default, is_active, frame_slots)
VALUES (
  'Cozy Anime Room',
  'A warm Studio Ghibli-inspired living room with a bookshelf and a framed cat portrait.',
  'https://thgaokonzsabpvhfbfdy.supabase.co/storage/v1/object/public/challenge-images/pet-room-bg-v2.png',
  true,
  true,
  '[{"id":"wall_frame","x":60,"y":6,"w":20,"h":30,"z_index":2,"label":"Wall Picture","default_image_url":null}]'
)
ON CONFLICT DO NOTHING;
