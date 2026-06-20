-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Soft delete for daily_challenges
--
-- Instead of hard-deleting daily_challenge rows (which breaks date history for
-- students), we now mark them as is_hidden = true.
--
-- Behaviour:
--   • Teacher "deletes" a challenge → is_hidden = true
--     - Disappears from weekly grid and Today's Challenges
--     - Students still see it in their past-problem history (with correct date)
--   • Republishing the same bank item creates a fresh row (is_hidden = false)
--   • The old hidden row retains its challenge_date, preserving date history
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE daily_challenges
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- Index so that all active-challenge queries stay fast
CREATE INDEX IF NOT EXISTS idx_daily_challenges_not_hidden
  ON daily_challenges(is_hidden)
  WHERE is_hidden = FALSE;

-- Back-fill: any rows whose challenge_id was set to NULL on submissions
-- (from the old ON DELETE SET NULL FK) are already de-linked — nothing to do.
-- Existing rows that are still active should remain is_hidden = false (the default).
