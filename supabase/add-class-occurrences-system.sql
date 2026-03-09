-- ============================================
-- CLASS OCCURRENCES & MATERIALS SYSTEM
-- Migration to add learning management features
-- ============================================

-- This migration adds:
-- 1. class_occurrences - Individual class sessions
-- 2. session_materials - Materials per session
-- 3. homework_assignments - Homework per session
-- 4. homework_submissions - Student submissions
-- 5. homework_grades - Grading with feedback
-- 6. Storage buckets for materials and submissions
-- 7. New permissions and RLS policies

-- ============================================
-- TABLES
-- ============================================

-- Class occurrences (individual sessions)
CREATE TABLE class_occurrences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  occurrence_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  session_number INTEGER NOT NULL,
  topic TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' 
    CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_occurrences_class ON class_occurrences(class_id);
CREATE INDEX idx_occurrences_date ON class_occurrences(occurrence_date);
CREATE INDEX idx_occurrences_status ON class_occurrences(status);

-- Session materials
CREATE TABLE session_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  occurrence_id UUID REFERENCES class_occurrences(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  material_type TEXT NOT NULL DEFAULT 'document'
    CHECK (material_type IN ('document', 'link', 'note', 'recording')),
  is_available BOOLEAN DEFAULT TRUE,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_materials_occurrence ON session_materials(occurrence_id);
CREATE INDEX idx_materials_uploaded_by ON session_materials(uploaded_by);

-- Homework assignments
CREATE TABLE homework_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  occurrence_id UUID REFERENCES class_occurrences(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  points_possible INTEGER NOT NULL DEFAULT 100,
  submission_type TEXT NOT NULL DEFAULT 'file'
    CHECK (submission_type IN ('file', 'text', 'link')),
  assignment_file_url TEXT,
  allow_late BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assignments_occurrence ON homework_assignments(occurrence_id);
CREATE INDEX idx_assignments_due_date ON homework_assignments(due_date);

-- Homework submissions
CREATE TABLE homework_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES homework_assignments(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  submission_type TEXT NOT NULL
    CHECK (submission_type IN ('file', 'text', 'link')),
  file_url TEXT,
  text_content TEXT,
  link_url TEXT,
  comments TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  is_late BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  UNIQUE(assignment_id, student_id, version)
);

CREATE INDEX idx_submissions_assignment ON homework_submissions(assignment_id);
CREATE INDEX idx_submissions_student ON homework_submissions(student_id);
CREATE INDEX idx_submissions_late ON homework_submissions(is_late);

-- Homework grades
CREATE TABLE homework_grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES homework_submissions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  graded_by UUID REFERENCES profiles(id) NOT NULL,
  points_earned INTEGER NOT NULL,
  feedback TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  graded_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_grades_submission ON homework_grades(submission_id);
CREATE INDEX idx_grades_status ON homework_grades(status);

-- ============================================
-- PERMISSIONS
-- ============================================

INSERT INTO permissions (name, description, resource, action) VALUES
  ('occurrence:manage', 'Manage class occurrences', 'occurrence', 'manage'),
  ('material:upload', 'Upload session materials', 'material', 'upload'),
  ('material:read', 'View session materials', 'material', 'read'),
  ('material:delete', 'Delete session materials', 'material', 'delete'),
  ('homework:create', 'Create homework assignments', 'homework', 'create'),
  ('homework:read', 'View homework assignments', 'homework', 'read'),
  ('homework:update', 'Update homework assignments', 'homework', 'update'),
  ('homework:delete', 'Delete homework assignments', 'homework', 'delete'),
  ('submission:create', 'Submit homework', 'submission', 'create'),
  ('submission:read_own', 'View own submissions', 'submission', 'read_own'),
  ('submission:read_all', 'View all submissions', 'submission', 'read_all'),
  ('grade:create', 'Grade submissions', 'grade', 'create'),
  ('grade:read_own', 'View own grades', 'grade', 'read_own'),
  ('grade:read_all', 'View all grades', 'grade', 'read_all')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to teacher role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'teacher'
  AND p.name IN (
    'occurrence:manage',
    'material:upload',
    'material:read',
    'material:delete',
    'homework:create',
    'homework:read',
    'homework:update',
    'homework:delete',
    'submission:read_all',
    'grade:create',
    'grade:read_all'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to student role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'student'
  AND p.name IN (
    'material:read',
    'homework:read',
    'submission:create',
    'submission:read_own',
    'grade:read_own'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to administrator role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'administrator'
  AND p.name IN (
    'occurrence:manage',
    'material:upload',
    'material:read',
    'material:delete',
    'homework:create',
    'homework:read',
    'homework:update',
    'homework:delete',
    'submission:read_all',
    'grade:create',
    'grade:read_all'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE class_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_grades ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - CLASS OCCURRENCES
-- ============================================

-- Users can read occurrences for their classes
CREATE POLICY "Users can read class occurrences"
  ON class_occurrences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members
      WHERE class_id = class_occurrences.class_id
        AND user_id = auth.uid()
    )
  );

-- Teachers can manage occurrences for their classes
CREATE POLICY "Teachers can insert occurrences"
  ON class_occurrences FOR INSERT
  WITH CHECK (
    user_has_permission(auth.uid(), 'occurrence:manage', class_id)
  );

CREATE POLICY "Teachers can update occurrences"
  ON class_occurrences FOR UPDATE
  USING (
    user_has_permission(auth.uid(), 'occurrence:manage', class_id)
  );

CREATE POLICY "Teachers can delete occurrences"
  ON class_occurrences FOR DELETE
  USING (
    user_has_permission(auth.uid(), 'occurrence:manage', class_id)
  );

-- ============================================
-- RLS POLICIES - SESSION MATERIALS
-- ============================================

-- Users can read available materials for their class sessions
CREATE POLICY "Users can read session materials"
  ON session_materials FOR SELECT
  USING (
    is_available = TRUE
    AND EXISTS (
      SELECT 1 FROM class_occurrences co
      JOIN class_members cm ON co.class_id = cm.class_id
      WHERE co.id = session_materials.occurrence_id
        AND cm.user_id = auth.uid()
    )
  );

-- Teachers can upload materials
CREATE POLICY "Teachers can upload materials"
  ON session_materials FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM class_occurrences co
      WHERE co.id = occurrence_id
        AND user_has_permission(auth.uid(), 'material:upload', co.class_id)
    )
  );

-- Teachers can update their materials
CREATE POLICY "Teachers can update materials"
  ON session_materials FOR UPDATE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM class_occurrences co
      WHERE co.id = occurrence_id
        AND user_has_permission(auth.uid(), 'material:upload', co.class_id)
    )
  );

-- Teachers can delete their materials
CREATE POLICY "Teachers can delete materials"
  ON session_materials FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM class_occurrences co
      WHERE co.id = occurrence_id
        AND user_has_permission(auth.uid(), 'material:delete', co.class_id)
    )
  );

-- ============================================
-- RLS POLICIES - HOMEWORK ASSIGNMENTS
-- ============================================

-- Users can read assignments for their class sessions
CREATE POLICY "Users can read homework assignments"
  ON homework_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_occurrences co
      JOIN class_members cm ON co.class_id = cm.class_id
      WHERE co.id = homework_assignments.occurrence_id
        AND cm.user_id = auth.uid()
    )
  );

-- Teachers can create assignments
CREATE POLICY "Teachers can create assignments"
  ON homework_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM class_occurrences co
      WHERE co.id = occurrence_id
        AND user_has_permission(auth.uid(), 'homework:create', co.class_id)
    )
  );

-- Teachers can update assignments
CREATE POLICY "Teachers can update assignments"
  ON homework_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM class_occurrences co
      WHERE co.id = occurrence_id
        AND user_has_permission(auth.uid(), 'homework:update', co.class_id)
    )
  );

-- Teachers can delete assignments
CREATE POLICY "Teachers can delete assignments"
  ON homework_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM class_occurrences co
      WHERE co.id = occurrence_id
        AND user_has_permission(auth.uid(), 'homework:delete', co.class_id)
    )
  );

-- ============================================
-- RLS POLICIES - HOMEWORK SUBMISSIONS
-- ============================================

-- Students can create their own submissions
CREATE POLICY "Students can create submissions"
  ON homework_submissions FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND user_has_permission(auth.uid(), 'submission:create')
    AND EXISTS (
      SELECT 1 FROM homework_assignments ha
      JOIN class_occurrences co ON ha.occurrence_id = co.id
      JOIN class_members cm ON co.class_id = cm.class_id
      WHERE ha.id = assignment_id
        AND cm.user_id = auth.uid()
    )
  );

-- Students can read their own submissions
CREATE POLICY "Students can read own submissions"
  ON homework_submissions FOR SELECT
  USING (
    student_id = auth.uid()
  );

-- Teachers can read all submissions for their classes
CREATE POLICY "Teachers can read all submissions"
  ON homework_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM homework_assignments ha
      JOIN class_occurrences co ON ha.occurrence_id = co.id
      WHERE ha.id = assignment_id
        AND user_has_permission(auth.uid(), 'submission:read_all', co.class_id)
    )
  );

-- Students can update their own submissions (for resubmission)
CREATE POLICY "Students can update own submissions"
  ON homework_submissions FOR UPDATE
  USING (
    student_id = auth.uid()
  );

-- ============================================
-- RLS POLICIES - HOMEWORK GRADES
-- ============================================

-- Students can read their own published grades
CREATE POLICY "Students can read own grades"
  ON homework_grades FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM homework_submissions hs
      WHERE hs.id = submission_id
        AND hs.student_id = auth.uid()
    )
  );

-- Teachers can read all grades for their classes
CREATE POLICY "Teachers can read all grades"
  ON homework_grades FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM homework_submissions hs
      JOIN homework_assignments ha ON hs.assignment_id = ha.id
      JOIN class_occurrences co ON ha.occurrence_id = co.id
      WHERE hs.id = submission_id
        AND user_has_permission(auth.uid(), 'grade:read_all', co.class_id)
    )
  );

-- Teachers can create grades
CREATE POLICY "Teachers can create grades"
  ON homework_grades FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM homework_submissions hs
      JOIN homework_assignments ha ON hs.assignment_id = ha.id
      JOIN class_occurrences co ON ha.occurrence_id = co.id
      WHERE hs.id = submission_id
        AND user_has_permission(auth.uid(), 'grade:create', co.class_id)
    )
  );

-- Teachers can update grades
CREATE POLICY "Teachers can update grades"
  ON homework_grades FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM homework_submissions hs
      JOIN homework_assignments ha ON hs.assignment_id = ha.id
      JOIN class_occurrences co ON ha.occurrence_id = co.id
      WHERE hs.id = submission_id
        AND user_has_permission(auth.uid(), 'grade:create', co.class_id)
    )
  );

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Note: Storage buckets must be created via Supabase Dashboard or API
-- After running this migration, create these buckets manually:
-- 1. session-materials (public: false, file size limit: 52428800 = 50MB)
-- 2. homework-submissions (public: false, file size limit: 52428800 = 50MB)

-- Storage policies will be added after buckets are created
-- See: supabase/setup-storage-policies.sql

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Uncomment to verify tables were created:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name LIKE '%occurrence%' OR table_name LIKE '%homework%' OR table_name LIKE '%session_materials%';

-- Uncomment to verify permissions were added:
-- SELECT name, description FROM permissions WHERE resource IN ('occurrence', 'material', 'homework', 'submission', 'grade');

-- Uncomment to verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('class_occurrences', 'session_materials', 'homework_assignments', 'homework_submissions', 'homework_grades');
