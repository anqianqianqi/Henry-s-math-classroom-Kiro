-- Fix: Add UPDATE and DELETE policies for daily_challenges
-- Teachers and admins need to be able to edit and delete challenges they created

-- Allow teachers/admins to update any challenge
CREATE POLICY "Teachers can update challenges"
  ON daily_challenges FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );

-- Allow teachers/admins to delete challenges
CREATE POLICY "Teachers can delete challenges"
  ON daily_challenges FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );

-- Also ensure teachers can read ALL challenges (not just assigned ones)
CREATE POLICY "Teachers can read all challenges"
  ON daily_challenges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );
