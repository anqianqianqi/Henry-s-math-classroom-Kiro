-- TEMPORARY: Disable RLS on class_occurrences for testing
-- WARNING: This allows anyone to see all occurrences
-- Only use for testing, then re-enable with fix-occurrences-rls-simple.sql

ALTER TABLE class_occurrences DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'class_occurrences';

-- Now try to select occurrences
SELECT 
  co.session_number,
  co.topic,
  co.occurrence_date,
  co.status,
  c.name as class_name
FROM class_occurrences co
JOIN classes c ON c.id = co.class_id
ORDER BY co.session_number
LIMIT 10;
