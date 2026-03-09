-- Check Mike Johnson's submission and grade
SELECT 
  p.full_name,
  p.email,
  hs.id as submission_id,
  hs.submitted_at,
  hs.version,
  ha.title as assignment_title,
  hg.id as grade_id,
  hg.points_earned,
  hg.feedback,
  hg.status,
  hg.published_at,
  hg.graded_at
FROM profiles p
JOIN homework_submissions hs ON p.id = hs.student_id
JOIN homework_assignments ha ON hs.assignment_id = ha.id
LEFT JOIN homework_grades hg ON hs.id = hg.submission_id
WHERE p.full_name LIKE '%Mike%Johnson%'
ORDER BY hs.submitted_at DESC;

-- If no results, check all submissions
-- SELECT 
--   p.full_name,
--   COUNT(hs.id) as submission_count
-- FROM profiles p
-- JOIN homework_submissions hs ON p.id = hs.student_id
-- GROUP BY p.id, p.full_name
-- ORDER BY p.full_name;
