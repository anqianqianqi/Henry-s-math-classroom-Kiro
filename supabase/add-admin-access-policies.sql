-- Add RLS policies for administrators to view all data

-- ============================================
-- CLASSES - Admins can view all classes
-- ============================================

CREATE POLICY "Administrators can view all classes"
  ON classes FOR SELECT
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
-- DAILY CHALLENGES - Admins can view all challenges
-- ============================================

CREATE POLICY "Administrators can view all challenges"
  ON daily_challenges FOR SELECT
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
-- CHALLENGE ASSIGNMENTS - Admins can view all
-- ============================================

CREATE POLICY "Administrators can view all challenge assignments"
  ON challenge_assignments FOR SELECT
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
-- SUBMISSIONS - Admins can view all submissions
-- ============================================

CREATE POLICY "Administrators can view all submissions"
  ON submissions FOR SELECT
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
-- SUBMISSION COMMENTS - Admins can view all comments
-- ============================================

CREATE POLICY "Administrators can view all submission comments"
  ON submission_comments FOR SELECT
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
-- CLASS MEMBERS - Admins can view all memberships
-- ============================================

CREATE POLICY "Administrators can view all class members"
  ON class_members FOR SELECT
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
-- PROFILES - Admins can view all profiles
-- ============================================

CREATE POLICY "Administrators can view all profiles"
  ON profiles FOR SELECT
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
-- USER ROLES - Admins can view all user roles
-- ============================================

CREATE POLICY "Administrators can view all user roles"
  ON user_roles FOR SELECT
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
-- Verify policies were created
-- ============================================

SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE policyname LIKE '%dministrator%'
ORDER BY tablename, policyname;
