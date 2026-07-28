-- Make Bubble Room global: remove class_id requirement.
-- Questions are now user-scoped, visible to all authenticated users.
-- Run this in the Supabase SQL editor.

-- 1. Make class_id nullable (existing rows keep their value)
ALTER TABLE bubble_room_questions
  ALTER COLUMN class_id DROP NOT NULL;

-- 2. Replace RLS policies — no class membership required

-- SELECT: any authenticated user can read all questions
DROP POLICY IF EXISTS "brq_select" ON bubble_room_questions;
CREATE POLICY "brq_select"
  ON bubble_room_questions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: any authenticated user can post; class_id is optional
DROP POLICY IF EXISTS "brq_insert" ON bubble_room_questions;
CREATE POLICY "brq_insert"
  ON bubble_room_questions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND auth.uid() IS NOT NULL
  );

-- DELETE: own question OR teacher/admin role
DROP POLICY IF EXISTS "brq_delete" ON bubble_room_questions;
CREATE POLICY "brq_delete"
  ON bubble_room_questions FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );

-- 3. Responses: any authenticated user can read/post
DROP POLICY IF EXISTS "brr_select" ON bubble_room_responses;
CREATE POLICY "brr_select"
  ON bubble_room_responses FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "brr_insert" ON bubble_room_responses;
CREATE POLICY "brr_insert"
  ON bubble_room_responses FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND auth.uid() IS NOT NULL
  );

-- 4. Views: any authenticated user can upsert their own view records
DROP POLICY IF EXISTS "brvw_select" ON bubble_room_question_views;
CREATE POLICY "brvw_select"
  ON bubble_room_question_views FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "brvw_upsert" ON bubble_room_question_views;
CREATE POLICY "brvw_upsert"
  ON bubble_room_question_views FOR INSERT
  WITH CHECK (user_id = auth.uid());
