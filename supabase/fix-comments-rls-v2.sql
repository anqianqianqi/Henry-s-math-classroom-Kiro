-- Fix RLS policy for submission comments
-- The issue is that the SELECT policy is too restrictive

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can read all comments" ON submission_comments;
DROP POLICY IF EXISTS "Users can read comments on visible submissions" ON submission_comments;

-- Create a simpler SELECT policy that allows authenticated users to read all comments
-- Since submission visibility is already controlled at the submission level,
-- we don't need to duplicate that logic here
CREATE POLICY "Authenticated users can read comments"
  ON submission_comments FOR SELECT
  USING (auth.role() = 'authenticated');
