-- TEMPORARY: Disable RLS on comments table for testing
-- This will help us verify if RLS is the issue

ALTER TABLE submission_comments DISABLE ROW LEVEL SECURITY;

-- After testing, re-enable with:
-- ALTER TABLE submission_comments ENABLE ROW LEVEL SECURITY;
