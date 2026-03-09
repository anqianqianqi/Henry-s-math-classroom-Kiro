-- Notification Preferences System
-- Allows users to customize which notifications they receive via email

-- ============================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Email notification preferences (default: all enabled)
  email_class_starting BOOLEAN DEFAULT TRUE,
  email_homework_graded BOOLEAN DEFAULT TRUE,
  email_new_comment BOOLEAN DEFAULT TRUE,
  email_homework_due_soon BOOLEAN DEFAULT TRUE,
  email_homework_assigned BOOLEAN DEFAULT TRUE,
  email_material_uploaded BOOLEAN DEFAULT TRUE,
  email_submission_received BOOLEAN DEFAULT TRUE,
  
  -- In-app notification preferences (default: all enabled)
  inapp_class_starting BOOLEAN DEFAULT TRUE,
  inapp_homework_graded BOOLEAN DEFAULT TRUE,
  inapp_new_comment BOOLEAN DEFAULT TRUE,
  inapp_homework_due_soon BOOLEAN DEFAULT TRUE,
  inapp_homework_assigned BOOLEAN DEFAULT TRUE,
  inapp_material_uploaded BOOLEAN DEFAULT TRUE,
  inapp_submission_received BOOLEAN DEFAULT TRUE,
  
  -- General settings
  email_enabled BOOLEAN DEFAULT TRUE,
  email_digest BOOLEAN DEFAULT FALSE, -- Future: daily digest option
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own preferences
CREATE POLICY "Users can read own preferences"
  ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
  ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get or create user preferences
CREATE OR REPLACE FUNCTION get_user_notification_preferences(p_user_id UUID)
RETURNS notification_preferences AS $$
DECLARE
  v_prefs notification_preferences;
BEGIN
  -- Try to get existing preferences
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id;
  
  -- If not found, create default preferences
  IF NOT FOUND THEN
    INSERT INTO notification_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_prefs;
  END IF;
  
  RETURN v_prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user wants email for a notification type
CREATE OR REPLACE FUNCTION should_send_email(
  p_user_id UUID,
  p_notification_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_prefs notification_preferences;
  v_should_send BOOLEAN := FALSE;
BEGIN
  -- Get user preferences
  v_prefs := get_user_notification_preferences(p_user_id);
  
  -- Check if email is globally enabled
  IF NOT v_prefs.email_enabled THEN
    RETURN FALSE;
  END IF;
  
  -- Check specific notification type preference
  CASE p_notification_type
    WHEN 'class_starting' THEN
      v_should_send := v_prefs.email_class_starting;
    WHEN 'homework_graded' THEN
      v_should_send := v_prefs.email_homework_graded;
    WHEN 'new_comment' THEN
      v_should_send := v_prefs.email_new_comment;
    WHEN 'homework_due_soon' THEN
      v_should_send := v_prefs.email_homework_due_soon;
    WHEN 'homework_assigned' THEN
      v_should_send := v_prefs.email_homework_assigned;
    WHEN 'material_uploaded' THEN
      v_should_send := v_prefs.email_material_uploaded;
    WHEN 'submission_received' THEN
      v_should_send := v_prefs.email_submission_received;
    ELSE
      v_should_send := FALSE;
  END CASE;
  
  RETURN v_should_send;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user wants in-app notification
CREATE OR REPLACE FUNCTION should_send_inapp(
  p_user_id UUID,
  p_notification_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_prefs notification_preferences;
  v_should_send BOOLEAN := TRUE; -- Default to true
BEGIN
  -- Get user preferences
  v_prefs := get_user_notification_preferences(p_user_id);
  
  -- Check specific notification type preference
  CASE p_notification_type
    WHEN 'class_starting' THEN
      v_should_send := v_prefs.inapp_class_starting;
    WHEN 'homework_graded' THEN
      v_should_send := v_prefs.inapp_homework_graded;
    WHEN 'new_comment' THEN
      v_should_send := v_prefs.inapp_new_comment;
    WHEN 'homework_due_soon' THEN
      v_should_send := v_prefs.inapp_homework_due_soon;
    WHEN 'homework_assigned' THEN
      v_should_send := v_prefs.inapp_homework_assigned;
    WHEN 'material_uploaded' THEN
      v_should_send := v_prefs.inapp_material_uploaded;
    WHEN 'submission_received' THEN
      v_should_send := v_prefs.inapp_submission_received;
    ELSE
      v_should_send := TRUE;
  END CASE;
  
  RETURN v_should_send;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UPDATE NOTIFICATION CREATION TO CHECK PREFERENCES
-- ============================================

-- Enhanced create_notification function that respects preferences
CREATE OR REPLACE FUNCTION create_notification_with_prefs(
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
  v_should_create BOOLEAN;
BEGIN
  -- Check if user wants this in-app notification
  v_should_create := should_send_inapp(p_user_id, p_type);
  
  IF v_should_create THEN
    INSERT INTO notifications (user_id, type, title, message, link, related_id)
    VALUES (p_user_id, p_type, p_title, p_message, p_link, p_related_id)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- EMAIL QUEUE TABLE (for sending emails)
-- ============================================

CREATE TABLE IF NOT EXISTS notification_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notification_emails_status ON notification_emails(status);
CREATE INDEX idx_notification_emails_user ON notification_emails(user_id);
CREATE INDEX idx_notification_emails_created ON notification_emails(created_at DESC);

-- RLS Policies
ALTER TABLE notification_emails ENABLE ROW LEVEL SECURITY;

-- Users can read their own email queue
CREATE POLICY "Users can read own email queue"
  ON notification_emails FOR SELECT
  USING (user_id = auth.uid());

-- System can insert emails (via service role)
CREATE POLICY "System can insert emails"
  ON notification_emails FOR INSERT
  WITH CHECK (true);

-- System can update emails (via service role)
CREATE POLICY "System can update emails"
  ON notification_emails FOR UPDATE
  USING (true);

-- ============================================
-- FUNCTION TO QUEUE EMAIL NOTIFICATION
-- ============================================

CREATE OR REPLACE FUNCTION queue_notification_email(
  p_user_id UUID,
  p_notification_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_email_id UUID;
  v_email_address TEXT;
  v_should_send BOOLEAN;
  v_subject TEXT;
  v_body TEXT;
BEGIN
  -- Check if user wants email for this notification type
  v_should_send := should_send_email(p_user_id, p_notification_type);
  
  IF NOT v_should_send THEN
    RETURN NULL;
  END IF;
  
  -- Get user's email address
  SELECT email INTO v_email_address
  FROM auth.users
  WHERE id = p_user_id;
  
  IF v_email_address IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Create email subject and body
  v_subject := 'Henry''s Math Classroom: ' || p_title;
  v_body := p_message;
  
  IF p_link IS NOT NULL THEN
    v_body := v_body || E'\n\nView details: ' || p_link;
  END IF;
  
  -- Queue the email
  INSERT INTO notification_emails (
    user_id,
    notification_id,
    email_address,
    notification_type,
    subject,
    body
  )
  VALUES (
    p_user_id,
    p_notification_id,
    v_email_address,
    p_notification_type,
    v_subject,
    v_body
  )
  RETURNING id INTO v_email_id;
  
  RETURN v_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UPDATE TRIGGERS TO USE NEW FUNCTIONS
-- ============================================

-- Update homework graded trigger
CREATE OR REPLACE FUNCTION notify_homework_graded()
RETURNS TRIGGER AS $$
DECLARE
  v_student_id UUID;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
  v_notification_id UUID;
BEGIN
  -- Only notify when grade is published
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status != 'published') THEN
    SELECT 
      hs.student_id,
      'Homework Graded',
      'Your homework "' || ha.title || '" has been graded: ' || NEW.points_earned || ' points',
      '/classes/' || co.class_id || '/sessions/' || co.id
    INTO v_student_id, v_title, v_message, v_link
    FROM homework_submissions hs
    JOIN homework_assignments ha ON hs.assignment_id = ha.id
    JOIN class_occurrences co ON ha.occurrence_id = co.id
    WHERE hs.id = NEW.submission_id;
    
    -- Create in-app notification (respects preferences)
    v_notification_id := create_notification_with_prefs(
      v_student_id,
      'homework_graded',
      v_title,
      v_message,
      v_link,
      NEW.id
    );
    
    -- Queue email notification (respects preferences)
    PERFORM queue_notification_email(
      v_student_id,
      v_notification_id,
      'homework_graded',
      v_title,
      v_message,
      v_link
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Similar updates would be needed for other triggers
-- For brevity, showing one example. Apply same pattern to:
-- - notify_new_comment
-- - notify_submission_received
-- - notify_homework_assigned
-- - notify_material_uploaded
-- - create_class_starting_notifications
-- - create_homework_due_notifications

-- ============================================
-- VERIFICATION
-- ============================================

-- Check preferences table
-- SELECT * FROM notification_preferences;

-- Check email queue
-- SELECT * FROM notification_emails WHERE status = 'pending' ORDER BY created_at DESC;

-- Test preference check
-- SELECT should_send_email('USER_ID', 'homework_graded');
-- SELECT should_send_inapp('USER_ID', 'homework_graded');

