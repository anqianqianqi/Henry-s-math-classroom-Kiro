-- ─────────────────────────────────────────────────────────────────────────────
-- Book Skin Overlay Objects
--
-- When a cover is saved with "Extract overlay objects" enabled:
--   • book_skins.image_url  → the stripped cover (objects removed)
--   • book_skin_overlays    → one row per extracted object PNG (transparent bg)
--
-- The admin animation editor writes overlay_config (position + animation)
-- which MagicBookReveal reads to composite the animated overlays on top of
-- the static stripped cover at render time.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS book_skin_overlays (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skin_id      UUID NOT NULL REFERENCES book_skins(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,          -- human-readable object name, e.g. "dragon"
  image_url    TEXT NOT NULL,          -- transparent-bg PNG in book-skins bucket
  sort_order   INTEGER NOT NULL DEFAULT 0,
  -- Animation config set by admin editor:
  -- { x: 50, y: 20, scale: 1.0, animation: 'float' | 'pulse' | 'rotate' | 'shimmer' | 'bounce' | 'none' }
  overlay_config JSONB DEFAULT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bso_skin ON book_skin_overlays(skin_id, sort_order);

ALTER TABLE book_skin_overlays ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read overlays (needed on challenge page)
CREATE POLICY "bso_authenticated_read"
  ON book_skin_overlays FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins/teachers can write
CREATE POLICY "bso_admin_write"
  ON book_skin_overlays FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Track whether a skin has overlays so the renderer knows to fetch them
ALTER TABLE book_skins
  ADD COLUMN IF NOT EXISTS has_overlays BOOLEAN NOT NULL DEFAULT false;
