-- ─────────────────────────────────────────────────────────────────────────────
-- Diagnostic: Find submissions that will NOT carry over if the challenge
-- is republished from the bank today.
--
-- A submission is "at risk" when ALL of the following are true:
--   1. bank_item_id IS NULL  (not linked to the bank item)
--   2. The linked daily_challenge HAS a source_bank_id (was published from bank)
--   3. challenge_id is NOT NULL (submission is still attached to a live challenge row)
--
-- The fix path for each row:
--   • Run add-bank-item-submissions.sql migration if not yet done (backfill step 4)
--   • OR run the UPDATE below to patch them manually
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. VIEW: at-risk submissions ─────────────────────────────────────────────
SELECT
  cs.id            AS submission_id,
  p.nickname       AS student,
  dc.title         AS challenge_title,
  dc.challenge_date,
  cb.title         AS bank_item_title,
  dc.source_bank_id AS bank_item_id_needed,
  cs.challenge_id,
  cs.bank_item_id   AS current_bank_item_id,   -- should be NULL for at-risk rows
  cs.submitted_at
FROM challenge_submissions cs
JOIN daily_challenges       dc ON dc.id = cs.challenge_id
JOIN challenge_bank         cb ON cb.id = dc.source_bank_id
JOIN profiles               p  ON p.id  = cs.user_id
WHERE cs.bank_item_id IS NULL          -- not yet linked to bank
  AND dc.source_bank_id IS NOT NULL    -- challenge came from bank
ORDER BY dc.title, p.nickname;


-- ── 2. VIEW: fully orphaned submissions (challenge deleted, bank_item_id NULL) ─
-- These CANNOT be recovered by the backfill — they need a manual fix per submission.
SELECT
  cs.id          AS submission_id,
  p.nickname     AS student,
  cs.submitted_at,
  cs.content,
  cs.points
FROM challenge_submissions cs
JOIN profiles p ON p.id = cs.user_id
WHERE cs.challenge_id  IS NULL   -- daily_challenge was deleted
  AND cs.bank_item_id  IS NULL   -- and never linked to bank
ORDER BY cs.submitted_at;


-- ── 3. FIX: patch all at-risk submissions in one shot ────────────────────────
-- Run this AFTER confirming the rows above look correct.
-- It does exactly what add-bank-item-submissions.sql step 4 does, but only for
-- rows that were missed (e.g. created after the migration ran but before the
-- app-level fix was deployed).
--
-- Uncomment to execute:
/*
UPDATE challenge_submissions cs
SET    bank_item_id = dc.source_bank_id
FROM   daily_challenges dc
WHERE  cs.challenge_id    = dc.id
  AND  dc.source_bank_id  IS NOT NULL
  AND  cs.bank_item_id    IS NULL;
*/

-- ── 4. VERIFY: count after fix ───────────────────────────────────────────────
-- Should return 0 after running the UPDATE above.
/*
SELECT COUNT(*) AS still_at_risk
FROM challenge_submissions cs
JOIN daily_challenges dc ON dc.id = cs.challenge_id
WHERE cs.bank_item_id IS NULL
  AND dc.source_bank_id IS NOT NULL;
*/
