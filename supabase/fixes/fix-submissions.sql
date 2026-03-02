-- Fix submission policies

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own submissions" ON challenge_submissions;
DROP POLICY IF EXISTS "Users can read submissions after submitting" ON challenge_submissions;
DROP POLICY IF EXISTS "Users can insert own submissions" ON challenge_submissions;
DROP POLICY IF EXISTS "Users can update own submissions" ON challenge_submissions;

-- Allow users to insert their own submissions
CREATE POLICY "Users can insert own submissions"
  ON challenge_submissions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow users to update their own submissions
CREATE POLICY "Users can update own submissions"
  ON challenge_submissions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Allow users to read their own submissions
CREATE POLICY "Users can read own submissions"
  ON challenge_submissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow users to read all submissions (for now - we'll add the lock logic later)
CREATE POLICY "Users can read all submissions"
  ON challenge_submissions FOR SELECT
  TO authenticated
  USING (true);

SELECT '✅ Submission policies fixed!' as status;
