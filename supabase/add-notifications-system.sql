-- Notifications System
-- Provides in-app notifications for students and teachers

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'class_starting',
    'homework_graded',
    'new_comment',
    'homework_due_soon',
    'homework_assigned',
    'material_uploaded',
    'submission_received'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- System can insert notifications (via service role)
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, related_id)
  VALUES (p_user_id, p_type, p_title, p_message, p_link, p_related_id)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE
  WHERE id = p_notification_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE
  WHERE user_id = auth.uid()
    AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS FOR AUTOMATIC NOTIFICATIONS
-- ============================================

-- Notify student when homework is graded
CREATE OR REPLACE FUNCTION notify_homework_graded()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify when grade is published (not draft)
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status != 'published') THEN
    INSERT INTO notifications (user_id, type, title, message, link, related_id)
    SELECT 
      hs.student_id,
      'homework_graded',
      'Homework Graded',
      'Your homework "' || ha.title || '" has been graded: ' || NEW.points_earned || ' points',
      '/classes/' || co.class_id || '/sessions/' || co.id,
      NEW.id
    FROM homework_submissions hs
    JOIN homework_assignments ha ON hs.assignment_id = ha.id
    JOIN class_occurrences co ON ha.occurrence_id = co.id
    WHERE hs.id = NEW.submission_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_homework_graded
  AFTER INSERT OR UPDATE ON homework_grades
  FOR EACH ROW
  EXECUTE FUNCTION notify_homework_graded();

-- Notify when new comment is added
CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify submission owner if commenter is different
  INSERT INTO notifications (user_id, type, title, message, link, related_id)
  SELECT 
    hs.student_id,
    'new_comment',
    'New Comment',
    p.full_name || ' commented on your homework submission',
    '/classes/' || co.class_id || '/sessions/' || co.id,
    NEW.id
  FROM homework_submissions hs
  JOIN homework_assignments ha ON hs.assignment_id = ha.id
  JOIN class_occurrences co ON ha.occurrence_id = co.id
  JOIN profiles p ON NEW.user_id = p.id
  WHERE hs.id = NEW.submission_id
    AND hs.student_id != NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_new_comment
  AFTER INSERT ON homework_submission_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_comment();

-- Notify teacher when student submits homework
CREATE OR REPLACE FUNCTION notify_submission_received()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify teacher(s) of the class
  INSERT INTO notifications (user_id, type, title, message, link, related_id)
  SELECT DISTINCT
    cm.user_id,
    'submission_received',
    'New Homework Submission',
    p.full_name || ' submitted homework for "' || ha.title || '"',
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

CREATE TRIGGER trigger_notify_submission_received
  AFTER INSERT ON homework_submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_submission_received();

-- Notify students when new homework is assigned
CREATE OR REPLACE FUNCTION notify_homework_assigned()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify all students in the class
  INSERT INTO notifications (user_id, type, title, message, link, related_id)
  SELECT 
    cm.user_id,
    'homework_assigned',
    'New Homework Assigned',
    'New homework: "' || NEW.title || '" - Due ' || TO_CHAR(NEW.due_date, 'Mon DD at HH:MI AM'),
    '/classes/' || co.class_id || '/sessions/' || co.id,
    NEW.id
  FROM class_occurrences co
  JOIN class_members cm ON co.class_id = cm.class_id
  WHERE co.id = NEW.occurrence_id
    AND cm.role_id IN (SELECT id FROM roles WHERE name = 'student');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_homework_assigned
  AFTER INSERT ON homework_assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_homework_assigned();

-- Notify students when new material is uploaded
CREATE OR REPLACE FUNCTION notify_material_uploaded()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify all students in the class
  INSERT INTO notifications (user_id, type, title, message, link, related_id)
  SELECT 
    cm.user_id,
    'material_uploaded',
    'New Material Available',
    'New material uploaded: "' || NEW.title || '"',
    '/classes/' || co.class_id || '/sessions/' || co.id,
    NEW.id
  FROM class_occurrences co
  JOIN class_members cm ON co.class_id = cm.class_id
  WHERE co.id = NEW.occurrence_id
    AND cm.role_id IN (SELECT id FROM roles WHERE name = 'student');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_material_uploaded
  AFTER INSERT ON session_materials
  FOR EACH ROW
  EXECUTE FUNCTION notify_material_uploaded();

-- ============================================
-- SCHEDULED NOTIFICATIONS (Run via cron job)
-- ============================================

-- Function to create class starting notifications
-- This should be called by a cron job every 5 minutes
CREATE OR REPLACE FUNCTION create_class_starting_notifications()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Find classes starting in 15 minutes
  INSERT INTO notifications (user_id, type, title, message, link, related_id)
  SELECT 
    cm.user_id,
    'class_starting',
    'Class Starting Soon',
    c.name || ' starts in 15 minutes' || COALESCE(' - ' || co.topic, ''),
    '/classes/' || c.id || '/sessions/' || co.id,
    co.id
  FROM class_occurrences co
  JOIN classes c ON co.class_id = c.id
  JOIN class_members cm ON c.id = cm.class_id
  WHERE co.occurrence_date = CURRENT_DATE
    AND co.start_time BETWEEN (CURRENT_TIME + INTERVAL '15 minutes') 
                          AND (CURRENT_TIME + INTERVAL '20 minutes')
    AND co.status = 'upcoming'
    -- Don't create duplicate notifications
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = cm.user_id
        AND n.type = 'class_starting'
        AND n.related_id = co.id
        AND n.created_at > NOW() - INTERVAL '1 hour'
    );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create homework due soon notifications
-- This should be called by a cron job once per day
CREATE OR REPLACE FUNCTION create_homework_due_notifications()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Find homework due in 24 hours
  INSERT INTO notifications (user_id, type, title, message, link, related_id)
  SELECT DISTINCT
    cm.user_id,
    'homework_due_soon',
    'Homework Due Tomorrow',
    '"' || ha.title || '" is due tomorrow at ' || TO_CHAR(ha.due_date, 'HH:MI AM'),
    '/classes/' || co.class_id || '/sessions/' || co.id,
    ha.id
  FROM homework_assignments ha
  JOIN class_occurrences co ON ha.occurrence_id = co.id
  JOIN class_members cm ON co.class_id = cm.class_id
  WHERE ha.due_date BETWEEN NOW() + INTERVAL '23 hours' 
                        AND NOW() + INTERVAL '25 hours'
    AND cm.role_id IN (SELECT id FROM roles WHERE name = 'student')
    -- Only notify if student hasn't submitted yet
    AND NOT EXISTS (
      SELECT 1 FROM homework_submissions hs
      WHERE hs.assignment_id = ha.id
        AND hs.student_id = cm.user_id
    )
    -- Don't create duplicate notifications
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = cm.user_id
        AND n.type = 'homework_due_soon'
        AND n.related_id = ha.id
        AND n.created_at > NOW() - INTERVAL '12 hours'
    );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check notifications table
-- SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;

-- Check unread count for a user
-- SELECT COUNT(*) FROM notifications WHERE user_id = 'USER_ID' AND is_read = FALSE;
