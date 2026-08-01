-- ============================================================
-- Show the welcome card again
-- ============================================================
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- ── WHY THIS EXISTS ─────────────────────────────────────────
-- There is one database. The test4 preview and production read the same
-- profiles rows, so trying the card on the preview stamps
-- region_onboarded_at on the tester's own row — and they would never see it
-- again, including after the merge. This clears the stamp.
--
-- Nobody else is affected in the meantime: until the merge, main has no
-- welcome card, so only people opening the preview can be stamped at all.
--
-- ── WHAT IT DOES NOT TOUCH ──────────────────────────────────
-- timezone, region and preferred_language are left exactly as they were. Those
-- are real answers and are correct whether or not the card is shown again;
-- clearing them would throw away a true setting to re-ask a question.
-- ============================================================

-- ── A. Just me, while testing ───────────────────────────────
-- Run this between attempts to see the card as a new student would.

UPDATE profiles
   SET region_onboarded_at = NULL
 WHERE id = auth.uid();

-- ── B. Everyone, at launch ──────────────────────────────────
-- Run this ONCE, immediately before merging to main, so every student meets
-- the card on their first visit after the feature goes live.
--
-- Commented out on purpose: uncomment deliberately, because running it later —
-- after students have already answered — asks the whole school again.
--
-- UPDATE profiles SET region_onboarded_at = NULL;

-- ── Check ───────────────────────────────────────────────────
-- who_will_see_it counts people the card is still pending for.
SELECT
  COUNT(*) FILTER (WHERE region_onboarded_at IS NULL) AS who_will_see_it,
  COUNT(*) FILTER (WHERE region_onboarded_at IS NOT NULL) AS already_answered,
  COUNT(*) FILTER (WHERE region IS NOT NULL) AS have_a_region,
  COUNT(*) FILTER (WHERE timezone IS NOT NULL) AS have_a_timezone
FROM profiles;
