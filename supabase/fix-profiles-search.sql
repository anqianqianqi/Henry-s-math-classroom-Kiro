-- Fix Profiles Search for Teachers
-- Allow teachers and class creators to search all profiles to add students

-- Teachers (class creators) can search all profiles
CREATE POLICY IF NOT EXISTS "Teachers can search all profiles"
  ON profiles FOR SELECT
  USING (
    -- User is a teacher (has created at least one class)
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.created_by = auth.uid()
    )
    OR
    -- User has teacher/admin role
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'admin', 'administrator')
    )
  );

-- Verification query
-- SELECT id, full_name, email FROM profiles LIMIT 5;
