-- ============================================================
-- Timezones for people and classes; regions for shipped goods
-- ============================================================
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Two unrelated problems, migrated together because both add a column and
-- neither is worth a separate outage window.
--
-- ── 1. TIMEZONES ────────────────────────────────────────────
-- Nothing recorded a timezone. Every date rendered in whatever zone the
-- browser happened to be in, which is invisible while everyone is in one
-- place and wrong the moment they are not.
--
-- Two different columns because they answer different questions:
--   profiles.timezone  where this PERSON is  — how times are shown to them
--   classes.timezone   where this CLASS runs — what its schedule means
--
-- Storing only the person's zone would let us format existing class times
-- confidently and wrongly: "Monday 16:00" is 16:00 somewhere, and nobody
-- wrote down where.
--
-- IANA names ('America/New_York'), never offsets. The school observes
-- daylight saving, so an offset would be right for half the year and an hour
-- out for the other half — appearing twice a year, on the days people are
-- least likely to suspect the clock.
--
-- ── 2. REGIONS ──────────────────────────────────────────────
-- Only shipped goods have a region, because only shipped goods can be bought
-- from the wrong side of an ocean. commodity_type already records what ships;
-- region records where to. A CHECK ties them together so the two can never
-- disagree.
-- ============================================================

-- ── People ──────────────────────────────────────────────────
-- Nullable: filled in on first sign-in from the browser, and overridable in
-- Settings. Detection is wrong for anyone travelling or behind a VPN, so it
-- must never be the last word.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS region   TEXT,
  -- Set when someone has answered the welcome card. A separate column rather
  -- than inferring from region being non-null: "not set" is a legitimate answer
  -- somebody may return to in Settings, and it must not summon the card again.
  ADD COLUMN IF NOT EXISTS region_onboarded_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_region_check
    CHECK (region IS NULL OR region IN ('us', 'cn', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN profiles.timezone IS
  'IANA zone name for THIS PERSON, e.g. Asia/Shanghai. Null until detected. '
  'Decides how times are shown to them, never which school day it is.';
COMMENT ON COLUMN profiles.region IS
  'Geographic only: us | cn | other. Never ''digital'' — a person is not '
  'digital; that is a property of an item, and is expressed by having no region.';

-- ── Classes ─────────────────────────────────────────────────
-- Classes are virtual, so "where the class runs" means the teacher's own clock:
-- new classes take the creating teacher's timezone, set by the class form.
--
-- The column default only covers existing rows, which predate anybody having a
-- timezone at all and so cannot be backfilled from their teacher. They become
-- the school's zone, which is right for classes Henry runs and wrong for any
-- run from elsewhere — the check query at the bottom lists them all so that can
-- be confirmed rather than assumed.

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';

COMMENT ON COLUMN classes.timezone IS
  'IANA zone this class is taught in — for virtual classes, the teacher''s own. '
  'The schedule JSONB holds wall-clock times with no zone of their own, so this '
  'is what makes them convertible for everyone else.';

-- ── Shop regions ────────────────────────────────────────────

ALTER TABLE shop_items
  ADD COLUMN IF NOT EXISTS region TEXT;

DO $$ BEGIN
  ALTER TABLE shop_items ADD CONSTRAINT shop_items_region_check
    CHECK (region IS NULL OR region IN ('us', 'cn', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Existing shipped goods are sent from the school, so they are US items until
-- somebody says otherwise. The check query below lists them for review.
UPDATE shop_items
   SET region = 'us'
 WHERE region IS NULL
   AND commodity_type IN ('physical', 'physical_blindbox');

-- Anything that does not ship must NOT carry a region: absence IS "available
-- everywhere". Kept as one biconditional rather than two loose rules, so a
-- digital item cannot be quietly restricted and — the case that matters — a
-- shipped item cannot be left region-less and sold to the wrong continent.
DO $$ BEGIN
  ALTER TABLE shop_items ADD CONSTRAINT shop_items_region_only_when_shipped
    CHECK (
      (commodity_type IN ('physical', 'physical_blindbox') AND region IS NOT NULL)
      OR
      (commodity_type NOT IN ('physical', 'physical_blindbox') AND region IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN shop_items.region IS
  'Where a SHIPPED item can go: us | cn | other. Null for anything that does '
  'not ship, which means available everywhere. The constraint keeps this in '
  'step with commodity_type so the two cannot contradict each other.';

-- ── Enforcement ─────────────────────────────────────────────
-- A trigger on redemptions, NOT a check inside each redeem function.
--
-- There are five of those — redeem_item_v2, redeem_physical, redeem_blindbox,
-- redeem_physical_blindbox, redeem_ta_item — and editing working money code to
-- add the same clause five times is how one of them ends up subtly different.
-- Here they all keep running byte-identical instructions, the guard cannot be
-- bypassed by whichever path is called, and a sixth function added next year
-- inherits it for free.

CREATE OR REPLACE FUNCTION redemption_region_allowed()
RETURNS TRIGGER AS $$
DECLARE
  v_item_region TEXT;
  v_buyer_region TEXT;
BEGIN
  SELECT region INTO v_item_region FROM shop_items WHERE id = NEW.item_id;

  -- No region means it does not ship: available to everyone.
  IF v_item_region IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT region INTO v_buyer_region FROM profiles WHERE id = NEW.user_id;

  -- A buyer who has not been placed yet is allowed through rather than
  -- blocked. Region is filled in on sign-in, and refusing to sell to someone
  -- because a background detection has not landed would be a worse failure
  -- than the one this prevents.
  IF v_buyer_region IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_buyer_region <> v_item_region THEN
    RAISE EXCEPTION 'region_mismatch';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS redemptions_check_region ON redemptions;
CREATE TRIGGER redemptions_check_region
  BEFORE INSERT ON redemptions
  FOR EACH ROW EXECUTE FUNCTION redemption_region_allowed();

-- ── Check ───────────────────────────────────────────────────

-- 1. Every class, with the zone it was backfilled to. Anything that does NOT
--    run in New York needs correcting by hand — this is the one assumption in
--    the migration that data cannot confirm for itself.
SELECT id, name, timezone
  FROM classes
 WHERE is_active
 ORDER BY name;

-- 2. Shipped items and where they may go. Anything meant for China needs
--    UPDATE shop_items SET region = 'cn' WHERE id = '…';
SELECT id, title, commodity_type, region
  FROM shop_items
 WHERE commodity_type IN ('physical', 'physical_blindbox')
   AND is_active
 ORDER BY title;

-- 3. Expect zero rows: nothing digital should carry a region.
SELECT id, title, commodity_type, region
  FROM shop_items
 WHERE region IS NOT NULL
   AND commodity_type NOT IN ('physical', 'physical_blindbox');
