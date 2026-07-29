-- Fix: allow questions linked to ANY challenge_id (including bank challenges
-- that may not appear in challenge_assignments).
-- The challenge FK (ON DELETE SET NULL) already ensures referential integrity.
-- Run this in the Supabase SQL editor.

DROP POLICY IF EXISTS "brq_insert" ON bubble_room_questions;
CREATE POLICY "brq_insert"
  ON bubble_room_questions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- Student path: must be an active class member
      EXISTS (
        SELECT 1 FROM class_members cm
        WHERE cm.class_id = bubble_room_questions.class_id
          AND cm.user_id  = auth.uid()
      )
      OR
      -- Teacher path: must be the class creator
      EXISTS (
        SELECT 1 FROM classes c
        WHERE c.id = bubble_room_questions.class_id
          AND c.created_by = auth.uid()
      )
      OR
      -- Global admin/teacher role path
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND ur.class_id IS NULL
          AND r.name IN ('teacher', 'administrator')
      )
    )
    -- challenge_id constraint removed: bank challenges may not be in challenge_assignments
  );
