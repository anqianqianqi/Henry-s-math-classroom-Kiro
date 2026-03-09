-- Check homework grades in the database
SELECT 
  hg.id,
  hg.points_earned,
  hg.feedback,
  hg.status,
  hg.published_at,
  hg.graded_at,
  hs.id as submission_id,
  p_student.full_name as student_name,
  p_grader.full_name as graded_by_name,
  ha.title as assignment_title
FROM homework_grades hg
JOIN homework_submissions hs ON hg.submission_id = hs.id
JOIN profiles p_student ON hs.student_id = p_student.id
JOIN profiles p_grader ON hg.graded_by = p_grader.id
JOIN homework_assignments ha ON hs.assignment_id = ha.id
ORDER BY hg.graded_at DESC
LIMIT 20;
