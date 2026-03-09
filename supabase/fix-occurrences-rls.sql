-- Fix RLS policies for class_occurrences
-- The issue: Teachers who created the class might not be in class_members table
-- Solution: Allow class creators to see their class occurrences

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read class occurrences" ON class_occurrences;
DROP POLICY IF EXISTS "Teachers can manage occurrences" ON class_occurrences;

-- Create new policy: Users can read occurrences for classes they're members of OR created
CREATE POLICY "Users can read class occurrences"
  ON class_occurrences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members
      WHERE class_id = class_occurrences.class_id
        AND user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM classes
      WHERE id = class_occurrences.class_id
        AND created_by = auth.uid()
    )
  );

-- Create new policy: Teachers can manage occurrences for their classes
CREATE POLICY "Teachers can manage occurrences"
  ON class_occurrences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE id = class_occurrences.class_id
        AND created_by = auth.uid()
    )
  );

-- Verify policies were created
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'class_occurrences';

-- Test: Try to select occurrences
SELECT 
  co.id,
  co.class_id,
  co.session_number,
  co.topic,
  co.occurrence_date,
  co.status,
  c.name as class_name
FROM class_occurrences co
JOIN classes c ON c.id = co.class_id
ORDER BY co.occurrence_date
LIMIT 10;
