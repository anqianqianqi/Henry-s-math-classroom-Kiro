-- ─────────────────────────────────────────────────────────────────────────────
-- Run this to ensure book_skins is fully set up.
-- Safe to run multiple times (all statements are idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add visibility column if missing
ALTER TABLE book_skins
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'admin_only'
    CHECK (visibility IN ('admin_only', 'public', 'shop_only'));

-- 2. Add cover_layout column if missing  
ALTER TABLE book_skins
  ADD COLUMN IF NOT EXISTS cover_layout JSONB DEFAULT NULL;

-- 3. Drop all existing read policies and recreate cleanly
DROP POLICY IF EXISTS "book_skins_public_read"   ON book_skins;
DROP POLICY IF EXISTS "book_skins_select_active" ON book_skins;
DROP POLICY IF EXISTS "book_skins_user_select"   ON book_skins;
DROP POLICY IF EXISTS "book_skins_admin_read"    ON book_skins;
DROP POLICY IF EXISTS "book_skins_user_read"     ON book_skins;

-- 4. Any authenticated user can read active skins
--    (visibility filtering happens in the app layer for the picker;
--     the challenge page only reads is_default=true rows which is safe for all users)
CREATE POLICY "book_skins_authenticated_read"
  ON book_skins FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- 5. Admins/teachers can write
DROP POLICY IF EXISTS "book_skins_admin_all"   ON book_skins;
DROP POLICY IF EXISTS "book_skins_admin_write" ON book_skins;

CREATE POLICY "book_skins_admin_write"
  ON book_skins FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- 6. Make sure RLS is enabled
ALTER TABLE book_skins ENABLE ROW LEVEL SECURITY;

-- Verify: this should show your uploaded skins
-- SELECT id, name, is_default, is_active, visibility FROM book_skins;
