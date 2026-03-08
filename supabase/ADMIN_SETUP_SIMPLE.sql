-- ============================================
-- SIMPLE ADMIN SETUP
-- Only for existing tables
-- ============================================

-- Step 1: Verify admin user exists
SELECT id, email FROM profiles WHERE email = 'admin@test.com';

-- Step 2: Assign administrator role
INSERT INTO user_roles (user_id, role_id, class_id)
SELECT p.id, r.id, NULL
FROM profiles p
CROSS JOIN roles r
WHERE p.email = 'admin@test.com'
  AND r.name = 'administrator'
ON CONFLICT DO NOTHING;

-- Step 3: Add RLS policies for admin access (only existing tables)

-- Classes
DROP POLICY IF EXISTS "Administrators can view all classes" ON classes;
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

-- Daily Challenges
DROP POLICY IF EXISTS "Administrators can view all challenges" ON daily_challenges;
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

-- Challenge Assignments
DROP POLICY IF EXISTS "Administrators can view all challenge assignments" ON challenge_assignments;
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

-- Class Members
DROP POLICY IF EXISTS "Administrators can view all class members" ON class_members;
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

-- Profiles
DROP POLICY IF EXISTS "Administrators can view all profiles" ON profiles;
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

-- User Roles
DROP POLICY IF EXISTS "Administrators can view all user roles" ON user_roles;
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

-- Step 4: Verify admin role was assigned
SELECT 
  p.email,
  p.full_name,
  r.name as role,
  r.description
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE p.email = 'admin@test.com';

-- Step 5: Verify policies were created
SELECT tablename, policyname
FROM pg_policies
WHERE policyname LIKE '%dministrator%'
ORDER BY tablename;

-- Expected output:
-- Should see admin@test.com with 'administrator' role
-- Should see 6 policies created for admin access
