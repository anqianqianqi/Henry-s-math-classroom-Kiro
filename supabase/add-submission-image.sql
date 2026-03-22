-- Add image_url to challenge_submissions
ALTER TABLE challenge_submissions ADD COLUMN IF NOT EXISTS image_url TEXT;
