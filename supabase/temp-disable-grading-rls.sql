-- =====================================================
-- TEMPORARY: Disable RLS on Homework and Grading Tables
-- =====================================================
-- WARNING: This is for development/testing only!
-- Re-enable with proper policies before production.

-- Disable RLS on homework_submissions
ALTER TABLE homework_submissions DISABLE ROW LEVEL SECURITY;

-- Disable RLS on homework_grades
ALTER TABLE homework_grades DISABLE ROW LEVEL SECURITY;

-- Disable RLS on homework_assignments (if needed)
ALTER TABLE homework_assignments DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('homework_submissions', 'homework_grades', 'homework_assignments')
  AND schemaname = 'public';

