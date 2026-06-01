-- Track which bank challenge a published daily_challenge came from
ALTER TABLE daily_challenges
  ADD COLUMN IF NOT EXISTS source_bank_id UUID REFERENCES challenge_bank(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_challenges_source_bank_id ON daily_challenges(source_bank_id);
