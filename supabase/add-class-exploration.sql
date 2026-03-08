-- ============================================
-- Class Exploration & Trial Request System
-- Database Migration
-- ============================================

-- ============================================
-- 1. CREATE NEW TABLES
-- ============================================

-- Trial Requests Table
CREATE TABLE IF NOT EXISTS trial_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  parent_name TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_phone TEXT,
  student_name TEXT NOT NULL,
  student_age TEXT NOT NULL,
  message TEXT,
  preferred_date DATE,
  status TEXT CHECK (status IN ('pending', 'approved', 'denied', 'completed')) DEFAULT 'pending',
  teacher_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES profiles(id)
);

-- Indexes for trial_requests
CREATE INDEX IF NOT EXISTS idx_trial_requests_class ON trial_requests(class_id);
CREATE INDEX IF NOT EXISTS idx_trial_requests_status ON trial_requests(status);
CREATE INDEX IF NOT EXISTS idx_trial_requests_created ON trial_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_requests_email ON trial_requests(parent_email);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ============================================
-- 2. ADD COLUMNS TO EXISTING TABLES
-- ============================================

-- Add marketing/discovery fields to classes table
ALTER TABLE classes 
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS target_audience TEXT,
  ADD COLUMN IF NOT EXISTS age_range TEXT,
  ADD COLUMN IF NOT EXISTS skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  ADD COLUMN IF NOT EXISTS prerequisites TEXT,
  ADD COLUMN IF NOT EXISTS syllabus TEXT,
  ADD COLUMN IF NOT EXISTS learning_objectives TEXT[],
  ADD COLUMN IF NOT EXISTS materials_provided TEXT,
  ADD COLUMN IF NOT EXISTS homework_expectations TEXT,
  ADD COLUMN IF NOT EXISTS teacher_bio TEXT,
  ADD COLUMN IF NOT EXISTS teaching_style TEXT,
  ADD COLUMN IF NOT EXISTS max_students INTEGER,
  ADD COLUMN IF NOT EXISTS current_students INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS faq JSONB;

-- Indexes for classes discovery
CREATE INDEX IF NOT EXISTS idx_classes_public ON classes(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_classes_age_range ON classes(age_range) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_classes_skill_level ON classes(skill_level) WHERE is_public = TRUE;

-- ============================================
-- 3. CREATE ADMINISTRATOR ROLE & PERMISSIONS
-- ============================================

-- Add administrator role
INSERT INTO roles (name, description, is_system)
VALUES ('administrator', 'System administrator with full access', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Add admin permissions
INSERT INTO permissions (name, description, resource, action) VALUES
  ('admin:full_access', 'Full system access', 'system', 'manage'),
  ('trial:view_all', 'View all trial requests', 'trial_requests', 'read'),
  ('trial:manage', 'Manage trial requests', 'trial_requests', 'manage'),
  ('user:manage_all', 'Manage all users', 'users', 'manage'),
  ('class:view_all', 'View all classes', 'classes', 'read'),
  ('notification:send', 'Send notifications', 'notifications', 'create')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to administrator role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'administrator'
  AND p.name IN ('admin:full_access', 'trial:view_all', 'trial:manage', 'user:manage_all', 'class:view_all', 'notification:send')
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. ENABLE RLS ON NEW TABLES
-- ============================================

ALTER TABLE trial_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. CREATE RLS POLICIES
-- ============================================

-- ============================================
-- Trial Requests Policies
-- ============================================

-- Anyone can create trial requests (public form)
CREATE POLICY "Anyone can create trial requests"
  ON trial_requests FOR INSERT
  WITH CHECK (true);

-- Teachers can view requests for their classes
CREATE POLICY "Teachers can view own class trial requests"
  ON trial_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = trial_requests.class_id
        AND classes.created_by = auth.uid()
    )
  );

-- Administrators can view all trial requests
CREATE POLICY "Admins can view all trial requests"
  ON trial_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'administrator'
        AND ur.class_id IS NULL
    )
  );

-- Teachers can update requests for their classes
CREATE POLICY "Teachers can update own class trial requests"
  ON trial_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = trial_requests.class_id
        AND classes.created_by = auth.uid()
    )
  );

-- Administrators can update all trial requests
CREATE POLICY "Admins can update all trial requests"
  ON trial_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'administrator'
        AND ur.class_id IS NULL
    )
  );

-- ============================================
-- Notifications Policies
-- ============================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- System/Admins can create notifications
CREATE POLICY "Authenticated users can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- Classes Policies (Add public access)
-- ============================================

-- Anyone can view public classes
CREATE POLICY "Anyone can view public classes"
  ON classes FOR SELECT
  USING (is_public = TRUE);

-- ============================================
-- 6. CREATE HELPER FUNCTIONS
-- ============================================

-- Function to update trial request timestamp
CREATE OR REPLACE FUNCTION update_trial_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status != OLD.status THEN
    NEW.responded_at = NOW();
    NEW.responded_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for trial request updates
DROP TRIGGER IF EXISTS trial_request_update_timestamp ON trial_requests;
CREATE TRIGGER trial_request_update_timestamp
  BEFORE UPDATE ON trial_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_trial_request_timestamp();

-- ============================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE trial_requests IS 'Stores trial class requests from parents/guardians';
COMMENT ON TABLE notifications IS 'In-app notifications for users';
COMMENT ON COLUMN classes.is_public IS 'Whether class is visible in public directory';
COMMENT ON COLUMN classes.cover_image_url IS 'Cover image for class marketing';
COMMENT ON COLUMN classes.target_audience IS 'Description of ideal students';
COMMENT ON COLUMN classes.age_range IS 'Age or grade range (e.g., "Grades 3-5")';
COMMENT ON COLUMN classes.skill_level IS 'Beginner, intermediate, or advanced';
COMMENT ON COLUMN classes.syllabus IS 'Course curriculum and topics';
COMMENT ON COLUMN classes.learning_objectives IS 'Array of learning goals';
COMMENT ON COLUMN classes.max_students IS 'Maximum enrollment capacity';
COMMENT ON COLUMN classes.current_students IS 'Current enrollment count';
COMMENT ON COLUMN classes.price IS 'Class price (optional)';
COMMENT ON COLUMN classes.faq IS 'Frequently asked questions (JSON)';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- To verify the migration:
-- SELECT COUNT(*) FROM trial_requests;
-- SELECT COUNT(*) FROM notifications;
-- SELECT name FROM roles WHERE name = 'administrator';
-- SELECT * FROM permissions WHERE resource IN ('trial_requests', 'notifications', 'system');
