-- Fix ALL RLS policies to allow authenticated users to read everything
-- This is the simplest approach for development/testing

-- Classes
DROP POLICY IF EXISTS "Authenticated users can read all classes" ON classes;
CREATE POLICY "Authenticated users can read all classes"
  ON classes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create classes" ON classes;
CREATE POLICY "Authenticated users can create classes"
  ON classes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own classes" ON classes;
CREATE POLICY "Users can update own classes"
  ON classes FOR UPDATE TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete own classes" ON classes;
CREATE POLICY "Users can delete own classes"
  ON classes FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Class Members  
DROP POLICY IF EXISTS "Authenticated users can read class members" ON class_members;
CREATE POLICY "Authenticated users can read class members"
  ON class_members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can add class members" ON class_members;
CREATE POLICY "Authenticated users can add class members"
  ON class_members FOR INSERT TO authenticated WITH CHECK (true);

-- User Roles
DROP POLICY IF EXISTS "Authenticated users can read user roles" ON user_roles;
CREATE POLICY "Authenticated users can read user roles"
  ON user_roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create user roles" ON user_roles;
CREATE POLICY "Authenticated users can create user roles"
  ON user_roles FOR INSERT TO authenticated WITH CHECK (true);

-- Profiles
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON profiles;
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

-- Daily Challenges
DROP POLICY IF EXISTS "Authenticated users can read challenges" ON daily_challenges;
CREATE POLICY "Authenticated users can read challenges"
  ON daily_challenges FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create challenges" ON daily_challenges;
CREATE POLICY "Authenticated users can create challenges"
  ON daily_challenges FOR INSERT TO authenticated WITH CHECK (true);

-- Challenge Assignments
DROP POLICY IF EXISTS "Authenticated users can read challenge assignments" ON challenge_assignments;
CREATE POLICY "Authenticated users can read challenge assignments"
  ON challenge_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create challenge assignments" ON challenge_assignments;
CREATE POLICY "Authenticated users can create challenge assignments"
  ON challenge_assignments FOR INSERT TO authenticated WITH CHECK (true);

-- Challenge Submissions
DROP POLICY IF EXISTS "Authenticated users can read submissions" ON challenge_submissions;
CREATE POLICY "Authenticated users can read submissions"
  ON challenge_submissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own submissions" ON challenge_submissions;
CREATE POLICY "Users can insert own submissions"
  ON challenge_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own submissions" ON challenge_submissions;
CREATE POLICY "Users can update own submissions"
  ON challenge_submissions FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

SELECT '✅ All RLS policies fixed for reading AND writing!' as result;
SELECT 'You can now create classes, challenges, and more' as next_step;
