-- Fix RLS Policies for Daily Challenge Feature
-- Run this to ensure students can access challenges

-- Drop and recreate class_members policies
DROP POLICY IF EXISTS "Users can read own memberships" ON class_members;
DROP POLICY IF EXISTS "Users can read class members" ON class_members;

CREATE POLICY "Users can read own memberships"
  ON class_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can read class members"
  ON class_members FOR SELECT
  USING (
    class_id IN (
      SELECT cm.class_id FROM class_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

-- Drop and recreate challenge_assignments policies
DROP POLICY IF EXISTS "Users can read challenge assignments" ON challenge_assignments;

CREATE POLICY "Users can read challenge assignments"
  ON challenge_assignments FOR SELECT
  USING (true); -- Everyone can read which challenges are assigned to which classes

-- Drop and recreate daily_challenges policies
DROP POLICY IF EXISTS "Users can read assigned challenges" ON daily_challenges;

CREATE POLICY "Users can read assigned challenges"
  ON daily_challenges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM challenge_assignments ca
      JOIN class_members cm ON ca.class_id = cm.class_id
      WHERE ca.challenge_id = daily_challenges.id
        AND cm.user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

-- Drop and recreate challenge_submissions policies
DROP POLICY IF EXISTS "Users can read own submissions" ON challenge_submissions;
DROP POLICY IF EXISTS "Users can read submissions after submitting" ON challenge_submissions;
DROP POLICY IF EXISTS "Users can insert own submissions" ON challenge_submissions;
DROP POLICY IF EXISTS "Users can update own submissions" ON challenge_submissions;

CREATE POLICY "Users can read own submissions"
  ON challenge_submissions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can read submissions after submitting"
  ON challenge_submissions FOR SELECT
  USING (
    -- Can see others' submissions if you've submitted to the same challenge
    EXISTS (
      SELECT 1 FROM challenge_submissions my_sub
      WHERE my_sub.challenge_id = challenge_submissions.challenge_id
        AND my_sub.user_id = auth.uid()
    )
    -- OR if you're a teacher
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'teacher'
        AND ur.class_id IS NULL
    )
  );

CREATE POLICY "Users can insert own submissions"
  ON challenge_submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own submissions"
  ON challenge_submissions FOR UPDATE
  USING (user_id = auth.uid());

SELECT '✅ RLS policies fixed!' as status;
SELECT 'Now refresh http://localhost:3000/challenges' as next_step;
