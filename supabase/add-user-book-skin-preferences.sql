-- ─────────────────────────────────────────────────────────────────────────────
-- User book skin preferences
-- One row per user. Tracks which cover and page skin they have selected.
-- NULL means "use the sitewide default set by admin".
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_book_skin_preferences (
  user_id         UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  cover_skin_id   UUID REFERENCES book_skins(id) ON DELETE SET NULL,
  page_skin_id    UUID REFERENCES book_skins(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_book_skin_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read and write only their own row
CREATE POLICY "ubsp_own_row" ON user_book_skin_preferences
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins/teachers can read all rows (e.g. for debugging)
CREATE POLICY "ubsp_admin_read" ON user_book_skin_preferences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );
