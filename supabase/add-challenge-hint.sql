-- Add hint column to daily_challenges
ALTER TABLE daily_challenges ADD COLUMN IF NOT EXISTS hint TEXT;

-- Also add to challenge_bank for consistency
ALTER TABLE challenge_bank ADD COLUMN IF NOT EXISTS hint TEXT;
