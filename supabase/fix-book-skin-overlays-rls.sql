-- Fix book_skin_overlays RLS to match the pattern used elsewhere in this project
-- Run this in Supabase SQL editor if overlays aren't saving

-- First, ensure the table and has_overlays column exist
CREATE TABLE IF NOT EXISTS book_skin_overlays (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skin_id      UUID NOT NULL REFERENCES book_skins(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  image_url    TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  overlay_config JSONB DEFAULT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bso_skin ON book_skin_overlays(skin_id, sort_order);

ALTER TABLE book_skins ADD COLUMN IF NOT EXISTS has_overlays BOOLEAN NOT NULL DEFAULT false;

-- Drop old policies and recreate with the correct pattern for this project
ALTER TABLE book_skin_overlays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bso_authenticated_read" ON book_skin_overlays;
DROP POLICY IF EXISTS "bso_admin_write" ON book_skin_overlays;

-- Anyone authenticated can read
CREATE POLICY "bso_authenticated_read"
  ON book_skin_overlays FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins/teachers can insert, update, delete
-- Uses the same pattern as other working policies in this project
CREATE POLICY "bso_admin_insert"
  ON book_skin_overlays FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

CREATE POLICY "bso_admin_update"
  ON book_skin_overlays FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

CREATE POLICY "bso_admin_delete"
  ON book_skin_overlays FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );
