-- Fix: Notify teacher on resubmission (UPDATE), not just first submission (INSERT)

CREATE OR REPLACE FUNCTION notify_submission_received()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, related_id)
  SELECT DISTINCT
    cm.user_id,
    'submission_received',
    CASE WHEN TG_OP = 'UPDATE' THEN 'Homework Resubmitted' ELSE 'New Homework Submission' END,
    p.full_name || CASE WHEN TG_OP = 'UPDATE' THEN ' resubmitted homework for "' ELSE ' submitted homework for "' END || ha.title || '"',
    '/classes/' || co.class_id || '/sessions/' || co.id,
    NEW.id
  FROM homework_assignments ha
  JOIN class_occurrences co ON ha.occurrence_id = co.id
  JOIN class_members cm ON co.class_id = cm.class_id
  JOIN profiles p ON NEW.student_id = p.id
  WHERE ha.id = NEW.assignment_id
    AND cm.role_id IN (SELECT id FROM roles WHERE name = 'teacher');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger to fire on both INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_notify_submission_received ON homework_submissions;

CREATE TRIGGER trigger_notify_submission_received
  AFTER INSERT OR UPDATE ON homework_submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_submission_received();
