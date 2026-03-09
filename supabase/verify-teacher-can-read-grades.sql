-- Verify teacher can read grades through RLS policies

-- Step 1: Check the RLS policies
SELECT 
  policyname,
  cmd,
  qual as using_clause
FROM pg_policies 
WHERE tablename = 'homework_grades'
AND cmd = 'SELECT';

-- Step 2: Check if the teacher has the right permission
-- Replace 'TEACHER_USER_ID' with your actual teacher user ID
-- SELECT 
--   ur.user_id,
--   p.full_name,
--   r.name as role_name,
--   perm.name as permission_name
-- FROM user_roles ur
-- JOIN roles r ON ur.role_id = r.id
-- JOIN role_permissions rp ON r.id = rp.role_id
-- JOIN permissions perm ON rp.permission_id = perm.id
-- JOIN profiles p ON ur.user_id = p.id
-- WHERE ur.user_id = 'TEACHER_USER_ID'
-- AND perm.name LIKE '%grade%';

-- Step 3: Test the actual query that the UI uses
-- This simulates what happens when loading submissions with grades
SELECT 
  hs.id as submission_id,
  hs.student_id,
  p.full_name as student_name,
  hg.id as grade_id,
  hg.points_earned,
  hg.feedback,
  hg.status
FROM homework_submissions hs
LEFT JOIN homework_grades hg ON hs.id = hg.submission_id
JOIN profiles p ON hs.student_id = p.id
WHERE p.full_name LIKE '%Mike%Johnson%'
ORDER BY hs.submitted_at DESC;

-- If the above shows NULL for grade_id, it means RLS is blocking it
-- Try this to see all grades without RLS filtering:
-- SET ROLE postgres;
-- SELECT * FROM homework_grades WHERE submission_id IN (
--   SELECT id FROM homework_submissions hs
--   JOIN profiles p ON hs.student_id = p.id
--   WHERE p.full_name LIKE '%Mike%Johnson%'
-- );
-- RESET ROLE;
