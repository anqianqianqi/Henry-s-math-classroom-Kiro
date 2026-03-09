-- Debug homework grades RLS policies
-- Run this to check if grades are being saved and if RLS is blocking access

-- 1. Check if grades exist in the database
SELECT 
  hg.id,
  hg.submission_id,
  hg.points_earned,
  hg.feedback,
  hg.status,
  hg.published_at,
  hg.graded_at,
  hs.student_id,
  p.full_name as student_name,
  ha.title as assignment_title
FROM homework_grades hg
JOIN homework_submissions hs ON hg.submission_id = hs.id
JOIN profiles p ON hs.student_id = p.id
JOIN homework_assignments ha ON hs.assignment_id = ha.id
ORDER BY hg.graded_at DESC
LIMIT 10;

-- 2. Check RLS policies on homework_grades
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'homework_grades';

-- 3. Test if a specific student can see their grade
-- Replace 'STUDENT_USER_ID' with actual student user ID
-- SELECT * FROM homework_grades hg
-- JOIN homework_submissions hs ON hg.submission_id = hs.id
-- WHERE hs.student_id = 'STUDENT_USER_ID'
-- AND hg.status = 'published';
