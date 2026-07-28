-- Add .henryproblem snapshot support to challenges
--
-- A .henryproblem file is the editable source of truth produced by the Prettify
-- Homework workspace. It carries title / score / tags / English + Chinese
-- wording as structured JSON, so uploading one needs no image parsing.
--
-- The embedded graph PNG is NOT stored here — it is uploaded to the existing
-- challenge-images bucket and referenced through image_url, so these rows stay
-- small enough to select on every page view.

ALTER TABLE daily_challenges
ADD COLUMN IF NOT EXISTS henryproblem JSONB;

ALTER TABLE challenge_bank
ADD COLUMN IF NOT EXISTS henryproblem JSONB;

COMMENT ON COLUMN daily_challenges.henryproblem IS
  'Henry Math editable problem snapshot (format henry-math-editable-problem v1), graph stripped.';
COMMENT ON COLUMN challenge_bank.henryproblem IS
  'Henry Math editable problem snapshot (format henry-math-editable-problem v1), graph stripped.';

-- Partial indexes: most challenges have no snapshot, so only index the ones
-- that do. Supports "show me every problem imported from a .henryproblem".
CREATE INDEX IF NOT EXISTS idx_daily_challenges_henryproblem
  ON daily_challenges ((henryproblem->>'format'))
  WHERE henryproblem IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_challenge_bank_henryproblem
  ON challenge_bank ((henryproblem->>'format'))
  WHERE henryproblem IS NOT NULL;

-- No RLS changes needed: the column inherits the existing table policies.
