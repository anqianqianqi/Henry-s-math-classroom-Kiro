-- Fix RLS policies for class_occurrences to include admin access

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read class occurrences" ON class_occurrences;
DROP POLICY IF EXISTS "Teachers can manage occurrences" ON class_occurrences;

-- Create new policy: Users can read occurrences if they are:
-- 1. Members of the class, OR
-- 2. Creators of the class, OR
-- 3. Admins
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
    OR
    -- Admins can see all
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name = 'admin'
    )
  );

-- Create new policy: Teachers and admins can manage occurrences
CREATE POLICY "Teachers can manage occurrences"
  ON class_occurrences FOR ALL
  USING (
    -- Class creators can manage
    EXISTS (
      SELECT 1 FROM classes
      WHERE id = class_occurrences.class_id
        AND created_by = auth.uid()
    )
    OR
    -- Admins can manage all
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name = 'admin'
    )
  );

-- Verify policies were created
SELECT 
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'class_occurrences';

-- Test: Check if current user is admin
SELECT 
  auth.uid() as user_id,
  auth.email() as email,
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role_name = 'admin'
  ) as is_admin;

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
