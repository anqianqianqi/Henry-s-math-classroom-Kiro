-- Simple fix: Just allow everyone to read occurrences for now
-- We can tighten security later

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read class occurrences" ON class_occurrences;
DROP POLICY IF EXISTS "Teachers can manage occurrences" ON class_occurrences;

-- Create simple read policy: Anyone can read occurrences for classes they have access to
CREATE POLICY "Users can read class occurrences"
  ON class_occurrences FOR SELECT
  USING (
    -- Class members can see
    EXISTS (
      SELECT 1 FROM class_members
      WHERE class_id = class_occurrences.class_id
        AND user_id = auth.uid()
    )
    OR
    -- Class creators can see
    EXISTS (
      SELECT 1 FROM classes
      WHERE id = class_occurrences.class_id
        AND created_by = auth.uid()
    )
  );

-- Create simple manage policy: Class creators can manage
CREATE POLICY "Teachers can manage occurrences"
  ON class_occurrences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE id = class_occurrences.class_id
        AND created_by = auth.uid()
    )
  );

-- Verify
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'class_occurrences';
