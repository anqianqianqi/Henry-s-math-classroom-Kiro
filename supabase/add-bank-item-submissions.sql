-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Tie challenge_submissions to challenge_bank items
--
-- Goal: When a daily_challenge was published from the challenge bank
-- (source_bank_id IS NOT NULL), the student's submission is permanently
-- associated with the bank item — not just the ephemeral daily instance.
--
-- Benefits:
--   • Deleting or republishing a daily_challenge never loses submissions
--   • "Publish again" automatically surfaces the student's prior work
--   • Teacher can see per-student history on the bank item itself
--
-- Schema change:
--   challenge_submissions.bank_item_id  UUID → challenge_bank(id)  nullable
--
-- The uniqueness rule becomes:
--   • When bank_item_id IS NOT NULL → UNIQUE(bank_item_id, user_id)
--     (one submission per student per bank problem, across all daily instances)
--   • When bank_item_id IS NULL      → UNIQUE(challenge_id, user_id)
--     (existing behaviour for ad-hoc challenges not from bank)
--
-- The old UNIQUE(challenge_id, user_id) constraint is dropped and replaced
-- with two partial unique indexes to enforce the above rules cleanly.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add bank_item_id column
ALTER TABLE challenge_submissions
  ADD COLUMN IF NOT EXISTS bank_item_id UUID
  REFERENCES challenge_bank(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_bank_item
  ON challenge_submissions(bank_item_id)
  WHERE bank_item_id IS NOT NULL;

-- 2. Drop the old single unique constraint
ALTER TABLE challenge_submissions
  DROP CONSTRAINT IF EXISTS challenge_submissions_challenge_id_user_id_key;

-- 3. Add two partial unique indexes in its place
--    a) For bank-sourced submissions: one per student per bank problem
CREATE UNIQUE INDEX IF NOT EXISTS uq_submissions_bank_user
  ON challenge_submissions(bank_item_id, user_id)
  WHERE bank_item_id IS NOT NULL;

--    b) For ad-hoc (non-bank) submissions: one per student per daily challenge
CREATE UNIQUE INDEX IF NOT EXISTS uq_submissions_challenge_user
  ON challenge_submissions(challenge_id, user_id)
  WHERE bank_item_id IS NULL AND challenge_id IS NOT NULL;

-- 4. Backfill bank_item_id for existing submissions where the linked
--    daily_challenge has a source_bank_id.
--
-- Handle duplicates: a student may have submitted to multiple daily instances
-- of the same bank item. We keep the LATEST submission per (bank_item_id, user_id)
-- and delete the older ones before patching.

-- 4a. Delete older duplicate submissions — keep only the most recent per
--     (bank_item_id, user_id) pair, looking up bank_item_id via the linked challenge.
DELETE FROM challenge_submissions
WHERE id IN (
  SELECT cs.id
  FROM challenge_submissions cs
  JOIN daily_challenges dc ON dc.id = cs.challenge_id
  WHERE dc.source_bank_id IS NOT NULL
    AND cs.bank_item_id IS NULL
    AND EXISTS (
      -- there is a newer submission for the same (bank_item, user)
      SELECT 1
      FROM challenge_submissions cs2
      JOIN daily_challenges dc2 ON dc2.id = cs2.challenge_id
      WHERE dc2.source_bank_id = dc.source_bank_id
        AND cs2.user_id = cs.user_id
        AND cs2.id <> cs.id
        AND cs2.submitted_at >= cs.submitted_at
    )
);

-- 4b. Also drop duplicates where one copy already has bank_item_id set
--     (e.g. from a previous partial run) and another copy does not.
DELETE FROM challenge_submissions
WHERE id IN (
  SELECT cs.id
  FROM challenge_submissions cs
  JOIN daily_challenges dc ON dc.id = cs.challenge_id
  WHERE dc.source_bank_id IS NOT NULL
    AND cs.bank_item_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM challenge_submissions cs2
      WHERE cs2.bank_item_id = dc.source_bank_id
        AND cs2.user_id = cs.user_id
    )
);

-- 4c. Now safe to patch — no more duplicates
UPDATE challenge_submissions cs
SET    bank_item_id = dc.source_bank_id
FROM   daily_challenges dc
WHERE  cs.challenge_id = dc.id
  AND  dc.source_bank_id IS NOT NULL
  AND  cs.bank_item_id IS NULL;

-- 5. RLS: students can read their own submissions by bank_item_id too
--    (the existing "Users can read own submissions" policy covers SELECT by user_id,
--     no additional policy needed — bank_item_id is just another column on the row)

-- Done. Run the application migration in the SQL editor and verify with:
-- SELECT count(*) FROM challenge_submissions WHERE bank_item_id IS NOT NULL;
