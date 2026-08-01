-- ============================================================
-- Did the timezone/region migration actually land?
-- ============================================================
-- Run in the Supabase SQL editor. Reads only; changes nothing.
--
-- The welcome card fails silently when a column is missing: the profile read
-- returns an error, the card returns early, and nothing appears. This says
-- which piece is absent instead of leaving it to guesswork.
-- ============================================================

-- 1. The columns. Expect five rows. A missing one is the answer.
SELECT table_name, column_name, data_type
  FROM information_schema.columns
 WHERE (table_name = 'profiles'    AND column_name IN ('timezone', 'region', 'region_onboarded_at'))
    OR (table_name = 'classes'     AND column_name = 'timezone')
    OR (table_name = 'shop_items'  AND column_name = 'region')
 ORDER BY table_name, column_name;

-- 2. Your own row. region_onboarded_at must be NULL for the card to appear.
SELECT id, timezone, region, region_onboarded_at, preferred_language
  FROM profiles
 WHERE id = auth.uid();

-- 3. The redemption guard. Expect one row.
SELECT tgname AS trigger_name
  FROM pg_trigger
 WHERE tgrelid = 'redemptions'::regclass
   AND NOT tgisinternal
   AND tgname = 'redemptions_check_region';

-- 4. Can this account see its own profile at all? Expect 1.
--    A 0 here means RLS is hiding the row, not that a column is missing —
--    a different problem with the same symptom.
SELECT COUNT(*) AS my_profile_rows_visible
  FROM profiles
 WHERE id = auth.uid();
