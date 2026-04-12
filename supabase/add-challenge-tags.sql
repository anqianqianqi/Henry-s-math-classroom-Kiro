-- Add tags column to daily_challenges
ALTER TABLE daily_challenges ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Index for tag search performance
CREATE INDEX IF NOT EXISTS idx_challenges_tags ON daily_challenges USING GIN(tags);
