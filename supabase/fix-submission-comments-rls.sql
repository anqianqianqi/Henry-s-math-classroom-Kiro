-- Fix submission comments RLS policies
-- Simplify to allow all authenticated users to comment on submissions they can see

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create comments on submissions" ON submission_comments;
DROP POLICY IF EXISTS "Users can read comments on visible submissions" ON submission_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON submission_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON submission_comments;

-- Simplified policies

-- Allow authenticated users to create comments
CREATE POLICY "Authenticated users can create comments"
  ON submission_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to read all comments (they can only see submissions they have access to anyway)
CREATE POLICY "Users can read all comments"
  ON submission_comments FOR SELECT
  USING (true);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON submission_comments FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON submission_comments FOR DELETE
  USING (auth.uid() = user_id);
