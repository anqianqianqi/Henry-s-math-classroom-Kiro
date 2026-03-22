-- Add grading and reveal system to challenge submissions
-- 1. Add points and locked status to submissions
ALTER TABLE challenge_submissions ADD COLUMN IF NOT EXISTS points INTEGER;
ALTER TABLE challenge_submissions ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- 2. Add image_url to submission_comments for teacher image comments
ALTER TABLE submission_comments ADD COLUMN IF NOT EXISTS image_url TEXT;
