-- Add visibility control to book_skins
-- admin_only : only admins/teachers can see and use it (testing/drafts)
-- public     : all users can see and select it freely
-- shop_only  : visible only to users who have purchased/redeemed it

ALTER TABLE book_skins
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('admin_only', 'public', 'shop_only'));

COMMENT ON COLUMN book_skins.visibility IS
  'admin_only = drafts/internal; public = free for all users; shop_only = must be purchased';

-- Fix the public read policy to respect visibility
DROP POLICY IF EXISTS "book_skins_select_active"  ON book_skins;
DROP POLICY IF EXISTS "book_skins_public_read"     ON book_skins;

-- Admins/teachers can always see everything
CREATE POLICY "book_skins_admin_read" ON book_skins
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

-- Regular users only see active + public skins (or shop_only if they own it — handled in app layer)
CREATE POLICY "book_skins_user_read" ON book_skins
  FOR SELECT
  USING (
    is_active = true
    AND visibility IN ('public', 'shop_only')
  );
