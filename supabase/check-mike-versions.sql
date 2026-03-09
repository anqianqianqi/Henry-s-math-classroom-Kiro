-- Check Mike Johnson's submission versions
SELECT 
  hs.id as submission_id,
  hs.version,
  hs.submitted_at,
  hg.id as grade_id,
  hg.points_earned,
  hg.status
FROM homework_submissions hs
LEFT JOIN homework_grades hg ON hs.id = hg.submission_id
JOIN profiles p ON hs.student_id = p.id
WHERE p.full_name LIKE '%Mike%Johnson%'
ORDER BY hs.version DESC, hs.submitted_at DESC;
