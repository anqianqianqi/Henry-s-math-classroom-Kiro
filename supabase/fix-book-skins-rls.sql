-- Fix: ensure book_skins table has correct RLS policies.
-- Run this if the cover image isn't showing for regular users.
-- The original policy name "book_skins_public_read" may have conflicted
-- with the storage.objects policy of the same name.

-- Drop & recreate with unique names to be safe
DROP POLICY IF EXISTS "book_skins_public_read"  ON book_skins;
DROP POLICY IF EXISTS "book_skins_admin_all"    ON book_skins;

-- All authenticated users can read active skins (needed on challenge page)
CREATE POLICY "book_skins_select_active"
  ON book_skins FOR SELECT
  USING (is_active = true);

-- Admins / teachers can INSERT, UPDATE, DELETE
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

-- Verify RLS is enabled
ALTER TABLE book_skins ENABLE ROW LEVEL SECURITY;
