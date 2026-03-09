-- Test grade visibility for students
-- This helps debug why students can't see their published grades

-- Step 1: Check all grades in the system
SELECT 
  hg.id as grade_id,
  hg.status,
  hg.points_earned,
  hg.published_at,
  hs.id as submission_id,
  hs.student_id,
  p.full_name as student_name,
  p.email as student_email,
  ha.title as assignment_title
FROM homework_grades hg
JOIN homework_submissions hs ON hg.submission_id = hs.id
JOIN profiles p ON hs.student_id = p.id
JOIN homework_assignments ha ON hs.assignment_id = ha.id
ORDER BY hg.graded_at DESC;

-- Step 2: Check RLS policies
SELECT 
  policyname,
  cmd,
  qual as using_clause,
  with_check
FROM pg_policies 
WHERE tablename = 'homework_grades'
ORDER BY policyname;

-- Step 3: Test as a specific student (replace with actual student ID)
-- This simulates what the student would see
-- SET LOCAL ROLE authenticated;
-- SET LOCAL request.jwt.claims TO '{"sub": "STUDENT_USER_ID_HERE"}';
-- SELECT * FROM homework_grades hg
-- JOIN homework_submissions hs ON hg.submission_id = hs.id
-- WHERE hs.student_id = 'STUDENT_USER_ID_HERE';
-- RESET ROLE;

-- Step 4: Check if grades have status = 'published'
SELECT 
  COUNT(*) as total_grades,
  COUNT(CASE WHEN status = 'published' THEN 1 END) as published_grades,
  COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_grades
FROM homework_grades;

-- Step 5: Check a specific submission and its grade
-- Replace SUBMISSION_ID with actual submission ID
-- SELECT 
--   hs.*,
--   hg.id as grade_id,
--   hg.points_earned,
--   hg.status,
--   hg.published_at
-- FROM homework_submissions hs
-- LEFT JOIN homework_grades hg ON hs.id = hg.submission_id
-- WHERE hs.id = 'SUBMISSION_ID_HERE';
