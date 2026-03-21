-- ============================================
-- Class Join Request System
-- Allows students to request to join classes
-- ============================================

-- ============================================
-- 1. CREATE JOIN REQUESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS class_join_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'denied')) DEFAULT 'pending',
  teacher_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES profiles(id),
  UNIQUE(class_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_join_requests_class ON class_join_requests(class_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON class_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON class_join_requests(status);
CREATE INDEX IF NOT EXISTS idx_join_requests_created ON class_join_requests(created_at DESC);

-- ============================================
-- 2. ENABLE RLS
-- ============================================

ALTER TABLE class_join_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. CREATE RLS POLICIES
-- ============================================

-- Users can create join requests
CREATE POLICY "Users can create join requests"
  ON class_join_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can view their own join requests
CREATE POLICY "Users can view own join requests"
  ON class_join_requests FOR SELECT
  USING (user_id = auth.uid());

-- Teachers can view requests for their classes
CREATE POLICY "Teachers can view class join requests"
  ON class_join_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_join_requests.class_id
        AND classes.created_by = auth.uid()
    )
  );

-- Admins can view all join requests
CREATE POLICY "Admins can view all join requests"
  ON class_join_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Teachers can update requests for their classes
CREATE POLICY "Teachers can update class join requests"
  ON class_join_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_join_requests.class_id
        AND classes.created_by = auth.uid()
    )
  );

-- Admins can update all join requests
CREATE POLICY "Admins can update all join requests"
  ON class_join_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- ============================================
-- 4. CREATE TRIGGER FOR NOTIFICATIONS
-- ============================================

-- Function to create notification when join request is created
CREATE OR REPLACE FUNCTION notify_teacher_of_join_request()
RETURNS TRIGGER AS $
DECLARE
  v_teacher_id UUID;
  v_class_name TEXT;
  v_student_name TEXT;
BEGIN
  -- Get teacher ID and class name
  SELECT created_by, name INTO v_teacher_id, v_class_name
  FROM classes
  WHERE id = NEW.class_id;
  
  -- Get student name
  SELECT full_name INTO v_student_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Create notification for teacher
  INSERT INTO notifications (user_id, type, title, message, link, read)
  VALUES (
    v_teacher_id,
    'join_request',
    'New Join Request',
    v_student_name || ' has requested to join ' || v_class_name,
    '/classes/' || NEW.class_id || '/requests',
    FALSE
  );
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new join requests
DROP TRIGGER IF EXISTS join_request_notification ON class_join_requests;
CREATE TRIGGER join_request_notification
  AFTER INSERT ON class_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_teacher_of_join_request();

-- Function to notify student when request is approved/denied
CREATE OR REPLACE FUNCTION notify_student_of_request_response()
RETURNS TRIGGER AS $
DECLARE
  v_class_name TEXT;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Only notify if status changed
  IF NEW.status != OLD.status AND NEW.status IN ('approved', 'denied') THEN
    -- Get class name
    SELECT name INTO v_class_name
    FROM classes
    WHERE id = NEW.class_id;
    
    -- Set notification content based on status
    IF NEW.status = 'approved' THEN
      v_notification_title := 'Join Request Approved';
      v_notification_message := 'Your request to join ' || v_class_name || ' has been approved!';
    ELSE
      v_notification_title := 'Join Request Denied';
      v_notification_message := 'Your request to join ' || v_class_name || ' was not approved.';
      IF NEW.teacher_response IS NOT NULL THEN
        v_notification_message := v_notification_message || ' Reason: ' || NEW.teacher_response;
      END IF;
    END IF;
    
    -- Create notification for student
    INSERT INTO notifications (user_id, type, title, message, link, read)
    VALUES (
      NEW.user_id,
      'join_request_response',
      v_notification_title,
      v_notification_message,
      '/classes/' || NEW.class_id,
      FALSE
    );
    
    -- If approved, add student to class
    IF NEW.status = 'approved' THEN
      -- Get student role ID
      DECLARE v_student_role_id UUID;
      SELECT id INTO v_student_role_id FROM roles WHERE name = 'student';
      
      INSERT INTO class_members (class_id, user_id, role_id)
      VALUES (NEW.class_id, NEW.user_id, v_student_role_id)
      ON CONFLICT (class_id, user_id, role_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for request responses
DROP TRIGGER IF EXISTS join_request_response_notification ON class_join_requests;
CREATE TRIGGER join_request_response_notification
  AFTER UPDATE ON class_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_student_of_request_response();

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_join_request_timestamp()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status != OLD.status THEN
    NEW.responded_at = NOW();
    NEW.responded_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger for timestamp updates
DROP TRIGGER IF EXISTS join_request_update_timestamp ON class_join_requests;
CREATE TRIGGER join_request_update_timestamp
  BEFORE UPDATE ON class_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_join_request_timestamp();

-- ============================================
-- 5. ADD JOIN_REQUEST TO NOTIFICATION TYPES
-- ============================================

-- Update notification preferences to include join_request type
INSERT INTO notification_preferences (user_id, notification_type, in_app_enabled, email_enabled)
SELECT 
  id,
  'join_request',
  TRUE,
  TRUE
FROM profiles
WHERE NOT EXISTS (
  SELECT 1 FROM notification_preferences np
  WHERE np.user_id = profiles.id
    AND np.notification_type = 'join_request'
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE class_join_requests IS 'Student requests to join classes';
COMMENT ON COLUMN class_join_requests.status IS 'pending, approved, or denied';
COMMENT ON COLUMN class_join_requests.message IS 'Optional message from student';
COMMENT ON COLUMN class_join_requests.teacher_response IS 'Optional response from teacher';

-- ============================================
-- VERIFICATION
-- ============================================

-- Check table created
-- SELECT COUNT(*) FROM class_join_requests;

-- Check policies
-- SELECT policyname FROM pg_policies WHERE tablename = 'class_join_requests';

-- Check triggers
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'class_join_requests'::regclass;
