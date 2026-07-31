-- ============================================================
-- Bubble Room: Expiry + Revival System
-- ============================================================
-- Rules:
--   - Bubbles auto-expire 10 days after creation (expires_at = created_at + 10 days)
--   - Author or teacher/admin can manually expire a bubble early
--   - Author or teacher/admin can revive an expired bubble (+10 days from now)
--   - revived_at tracks the last revival timestamp for audit/display
-- ============================================================

-- 1. Add expiry columns to bubble_room_questions
ALTER TABLE bubble_room_questions
  ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revived_at  TIMESTAMPTZ;

-- 2. Set expires_at for all existing rows (10 days from creation)
UPDATE bubble_room_questions
SET expires_at = created_at + INTERVAL '10 days'
WHERE expires_at IS NULL;

-- 3. Default for new rows: 10 days from creation
ALTER TABLE bubble_room_questions
  ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '10 days');

-- 4. Index for fast "fetch active/expired" queries
CREATE INDEX IF NOT EXISTS idx_brq_expires_at
  ON bubble_room_questions(expires_at);

CREATE INDEX IF NOT EXISTS idx_brq_user_expires
  ON bubble_room_questions(user_id, expires_at);

-- 5. UPDATE RLS policy — author or teacher/admin can expire/revive
--    (the global brq_update policy; brq_delete already exists)
DROP POLICY IF EXISTS "brq_update" ON bubble_room_questions;
CREATE POLICY "brq_update"
  ON bubble_room_questions FOR UPDATE
  USING (
    -- own bubble
    user_id = auth.uid()
    -- or global teacher/admin role
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );

-- 6. Enforce expiry at the RLS layer — expired bubbles are invisible to ALL users
--    This replaces the brq_select policy from make-bubble-room-global.sql.
--    Even if someone queries directly, they cannot see expired rows.
DROP POLICY IF EXISTS "brq_select" ON bubble_room_questions;
CREATE POLICY "brq_select"
  ON bubble_room_questions FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Exception: authors and teachers/admins can still see their own expired bubbles
-- (needed for My Bubbles management panel).
-- We achieve this by adding a separate policy for owners/admins:
CREATE POLICY "brq_select_own_expired"
  ON bubble_room_questions FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND ur.class_id IS NULL
          AND r.name IN ('teacher', 'administrator')
      )
    )
  );
