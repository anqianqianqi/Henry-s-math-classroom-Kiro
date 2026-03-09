-- TEMPORARY: Disable RLS on session_materials for testing
-- WARNING: This allows anyone to insert/read materials
-- Only use for testing, then re-enable with proper policies

-- Disable RLS on session_materials
ALTER TABLE session_materials DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'session_materials';

-- Also disable on homework tables for complete testing
ALTER TABLE homework_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE homework_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE homework_grades DISABLE ROW LEVEL SECURITY;

-- Verify all are disabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN (
  'session_materials',
  'homework_assignments', 
  'homework_submissions',
  'homework_grades'
);
