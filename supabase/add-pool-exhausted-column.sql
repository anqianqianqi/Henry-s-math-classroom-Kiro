-- Add pool_exhausted column to class_challenge_schedules
-- This flag is set when the scheduler has used all available challenges
-- and no generative templates match. Teacher is notified to add more content.

ALTER TABLE class_challenge_schedules
ADD COLUMN IF NOT EXISTS pool_exhausted BOOLEAN DEFAULT FALSE;
