-- Check homework submission comments
SELECT 
  hs.id,
  hs.assignment_id,
  hs.student_id,
  p.full_name as student_name,
  p.email as student_email,
  hs.comments,
  hs.submission_type,
  hs.submitted_at,
  ha.title as assignment_title
FROM homework_submissions hs
JOIN profiles p ON hs.student_id = p.id
JOIN homework_assignments ha ON hs.assignment_id = ha.id
ORDER BY hs.submitted_at DESC
LIMIT 20;
