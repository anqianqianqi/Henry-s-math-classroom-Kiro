-- Challenge Pool: allow challenges to exist without a date
-- Teachers can create challenges in a "pool" and publish them later

ALTER TABLE daily_challenges
ADD COLUMN IF NOT EXISTS is_pool BOOLEAN DEFAULT FALSE;

-- Index for fast pool queries
CREATE INDEX IF NOT EXISTS idx_daily_challenges_pool ON daily_challenges(is_pool) WHERE is_pool = true;

-- Make challenge_date nullable (it may already be, but ensure it)
ALTER TABLE daily_challenges ALTER COLUMN challenge_date DROP NOT NULL;
