-- Individual Student Assignment for Challenges
-- Allows teachers to assign challenges directly to specific students
-- (in addition to assigning to entire classes)

-- Create the table
CREATE TABLE IF NOT EXISTS challenge_student_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

-- RLS policies
ALTER TABLE challenge_student_assignments ENABLE ROW LEVEL SECURITY;

-- Teachers can see all individual assignments
CREATE POLICY "Teachers can view all student assignments"
  ON challenge_student_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND ur.class_id IS NULL
      AND r.name IN ('teacher', 'administrator')
    )
  );

-- Students can see their own assignments
CREATE POLICY "Students can view own assignments"
  ON challenge_student_assignments FOR SELECT
  USING (user_id = auth.uid());

-- Teachers can insert assignments
CREATE POLICY "Teachers can insert student assignments"
  ON challenge_student_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND ur.class_id IS NULL
      AND r.name IN ('teacher', 'administrator')
    )
  );

-- Teachers can delete assignments
CREATE POLICY "Teachers can delete student assignments"
  ON challenge_student_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND ur.class_id IS NULL
      AND r.name IN ('teacher', 'administrator')
    )
  );
