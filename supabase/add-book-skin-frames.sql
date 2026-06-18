-- ─────────────────────────────────────────────────────────────────────────────
-- Book skin animation frames
-- When a cover skin has frames, MagicBookReveal plays them sequentially
-- on click instead of using the CSS flip animation.
--
-- Frame 0  = the idle cover (what the user sees before clicking)
-- Frame N  = the final frame shown just before the pages appear
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS book_skin_frames (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skin_id      UUID NOT NULL REFERENCES book_skins(id) ON DELETE CASCADE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  image_url    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bsf_skin ON book_skin_frames(skin_id, sort_order);

ALTER TABLE book_skin_frames ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (safe to re-run)
DROP POLICY IF EXISTS "bsf_authenticated_read" ON book_skin_frames;
DROP POLICY IF EXISTS "bsf_admin_write" ON book_skin_frames;

-- Anyone authenticated can read frames (needed on challenge page)
CREATE POLICY "bsf_authenticated_read"
  ON book_skin_frames FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins / teachers can write
CREATE POLICY "bsf_admin_write"
  ON book_skin_frames FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Also mark the skin as animated so we know to fetch frames
ALTER TABLE book_skins
  ADD COLUMN IF NOT EXISTS is_animated BOOLEAN NOT NULL DEFAULT false;
