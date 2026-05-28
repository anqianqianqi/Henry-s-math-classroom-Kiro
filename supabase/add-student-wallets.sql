-- ============================================================
-- Student Wallets Migration
--
-- Replaces the on-demand SUM() balance calculation with a
-- cached student_wallets table maintained by Postgres triggers.
--
-- Benefits:
--   - Balance lookup = single row read (O(1) instead of O(n))
--   - Teacher can directly set total_earned to grant bonus points
--   - spendable_balance is always current (trigger-maintained)
--
-- Triggers:
--   1. challenge_submissions INSERT/UPDATE → update total_earned by delta
--   2. redemptions INSERT → increment total_spent
--
-- The redeem_item_v2 RPC is also updated to write total_spent
-- directly instead of computing it from scratch.
-- ============================================================

-- -------------------------------------------------------
-- 1. Create student_wallets table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_wallets (
  user_id           UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_earned      INTEGER NOT NULL DEFAULT 0,  -- sum of all graded submission points
  total_spent       INTEGER NOT NULL DEFAULT 0,  -- sum of all redemptions.points_spent
  spendable_balance INTEGER NOT NULL DEFAULT 0,  -- total_earned - total_spent (always current)
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_wallets_user_id ON student_wallets(user_id);

-- -------------------------------------------------------
-- RLS: student_wallets
-- -------------------------------------------------------
ALTER TABLE student_wallets ENABLE ROW LEVEL SECURITY;

-- Students can read their own wallet
CREATE POLICY "student_wallets_student_select" ON student_wallets
  FOR SELECT
  USING (user_id = auth.uid());

-- Teachers can read all wallets
CREATE POLICY "student_wallets_teacher_select" ON student_wallets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Teachers can UPDATE total_earned (to grant bonus points)
CREATE POLICY "student_wallets_teacher_update" ON student_wallets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- -------------------------------------------------------
-- 2. Helper: upsert wallet row (creates if missing)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_student_wallet(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO student_wallets (user_id, total_earned, total_spent, spendable_balance)
  VALUES (p_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- -------------------------------------------------------
-- 3. Trigger: sync total_earned when challenge_submissions changes
--
-- Handles INSERT, UPDATE (points changed), and DELETE.
-- Uses delta arithmetic so concurrent updates are safe.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_wallet_on_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_points INTEGER;
  v_new_points INTEGER;
  v_delta      INTEGER;
BEGIN
  -- Determine old and new points values
  IF TG_OP = 'DELETE' THEN
    v_old_points := COALESCE(OLD.points, 0);
    v_new_points := 0;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_points := 0;
    v_new_points := COALESCE(NEW.points, 0);
  ELSE -- UPDATE
    v_old_points := COALESCE(OLD.points, 0);
    v_new_points := COALESCE(NEW.points, 0);
  END IF;

  v_delta := v_new_points - v_old_points;

  -- Skip if no change
  IF v_delta = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Upsert wallet row if it doesn't exist yet
  INSERT INTO student_wallets (user_id, total_earned, total_spent, spendable_balance)
  VALUES (
    CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END,
    GREATEST(0, v_delta),
    0,
    GREATEST(0, v_delta)
  )
  ON CONFLICT (user_id) DO UPDATE
    SET total_earned      = GREATEST(0, student_wallets.total_earned + v_delta),
        spendable_balance = student_wallets.total_earned + v_delta - student_wallets.total_spent,
        updated_at        = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_wallet_on_submission ON challenge_submissions;
CREATE TRIGGER trg_sync_wallet_on_submission
  AFTER INSERT OR UPDATE OF points OR DELETE
  ON challenge_submissions
  FOR EACH ROW
  EXECUTE FUNCTION sync_wallet_on_submission();

-- -------------------------------------------------------
-- 4. Trigger: sync total_spent when a redemption is inserted
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_wallet_on_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Upsert wallet row if it doesn't exist yet
  INSERT INTO student_wallets (user_id, total_earned, total_spent, spendable_balance)
  VALUES (NEW.user_id, 0, NEW.points_spent, -NEW.points_spent)
  ON CONFLICT (user_id) DO UPDATE
    SET total_spent       = student_wallets.total_spent + NEW.points_spent,
        spendable_balance = student_wallets.total_earned - (student_wallets.total_spent + NEW.points_spent),
        updated_at        = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_wallet_on_redemption ON redemptions;
CREATE TRIGGER trg_sync_wallet_on_redemption
  AFTER INSERT
  ON redemptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_wallet_on_redemption();

-- -------------------------------------------------------
-- 5. Backfill: populate wallets from existing data
-- -------------------------------------------------------
INSERT INTO student_wallets (user_id, total_earned, total_spent, spendable_balance)
SELECT
  p.id                                                          AS user_id,
  COALESCE(e.total_earned, 0)                                   AS total_earned,
  COALESCE(s.total_spent, 0)                                    AS total_spent,
  COALESCE(e.total_earned, 0) - COALESCE(s.total_spent, 0)     AS spendable_balance
FROM profiles p
LEFT JOIN (
  SELECT user_id, SUM(points) AS total_earned
  FROM challenge_submissions
  WHERE points IS NOT NULL
  GROUP BY user_id
) e ON e.user_id = p.id
LEFT JOIN (
  SELECT user_id, SUM(points_spent) AS total_spent
  FROM redemptions
  GROUP BY user_id
) s ON s.user_id = p.id
WHERE COALESCE(e.total_earned, 0) > 0 OR COALESCE(s.total_spent, 0) > 0
ON CONFLICT (user_id) DO UPDATE
  SET total_earned      = EXCLUDED.total_earned,
      total_spent       = EXCLUDED.total_spent,
      spendable_balance = EXCLUDED.spendable_balance,
      updated_at        = now();

-- -------------------------------------------------------
-- 6. Updated redeem_item_v2 — writes to student_wallets
--    instead of computing balance from scratch
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_item_v2(p_item_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost            INTEGER;
  v_quantity        INTEGER;
  v_category        TEXT;
  v_food_xp         INTEGER;
  v_target_species  TEXT;
  v_redeemed_count  INTEGER;
  v_balance         INTEGER;
  v_new_xp          INTEGER;
  v_new_stage       TEXT;
  v_result          jsonb;
BEGIN
  -- Lock item row
  SELECT cost, quantity, category, food_xp, target_species
    INTO v_cost, v_quantity, v_category, v_food_xp, v_target_species
    FROM shop_items
   WHERE id = p_item_id AND is_active = true
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- Quantity check
  IF v_quantity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_redeemed_count FROM redemptions WHERE item_id = p_item_id;
    IF v_redeemed_count >= v_quantity THEN
      RAISE EXCEPTION 'out_of_stock';
    END IF;
  END IF;

  -- Balance check — single row read from student_wallets
  SELECT COALESCE(spendable_balance, 0) INTO v_balance
    FROM student_wallets
   WHERE user_id = auth.uid();

  -- If no wallet row yet, compute on the fly (first-time user)
  IF NOT FOUND THEN
    SELECT COALESCE(SUM(points), 0) INTO v_balance
      FROM challenge_submissions
     WHERE user_id = auth.uid() AND points IS NOT NULL;
  END IF;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Insert redemption (triggers sync_wallet_on_redemption automatically)
  INSERT INTO redemptions (user_id, item_id, points_spent)
  VALUES (auth.uid(), p_item_id, v_cost);

  v_result := jsonb_build_object('success', true);

  -- Pet feeding logic
  IF v_category = 'food' AND v_food_xp IS NOT NULL THEN
    INSERT INTO student_pets (user_id, xp, evolution_stage)
    VALUES (auth.uid(), 0, 'egg')
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE student_pets
       SET xp = xp + v_food_xp,
           evolution_stage = CASE
             WHEN species IS NULL THEN evolution_stage
             WHEN (xp + v_food_xp) >= 700 THEN 'legendary'
             WHEN (xp + v_food_xp) >= 300 THEN 'adult'
             WHEN (xp + v_food_xp) >= 100 THEN 'teen'
             ELSE 'baby'
           END,
           updated_at = now()
     WHERE user_id = auth.uid()
     RETURNING xp, evolution_stage INTO v_new_xp, v_new_stage;

    v_result := jsonb_build_object(
      'success',   true,
      'xp_gained', v_food_xp,
      'new_xp',    v_new_xp,
      'new_stage', v_new_stage
    );

  ELSIF v_category = 'pet' AND v_target_species IS NOT NULL THEN
    INSERT INTO student_pets (user_id, species, xp, evolution_stage, equipped_accessories)
    VALUES (auth.uid(), v_target_species, 0, 'baby', '{}')
    ON CONFLICT (user_id) DO UPDATE
      SET species              = v_target_species,
          xp                   = 0,
          evolution_stage      = 'baby',
          equipped_accessories = '{}',
          updated_at           = now();

    v_result := jsonb_build_object(
      'success',        true,
      'species_changed', true,
      'new_species',    v_target_species
    );
  END IF;

  RETURN v_result;
END;
$$;

-- -------------------------------------------------------
-- 7. Also update the original redeem_item() to use wallet
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_item(p_item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost            INTEGER;
  v_quantity        INTEGER;
  v_redeemed_count  INTEGER;
  v_balance         INTEGER;
BEGIN
  SELECT cost, quantity
    INTO v_cost, v_quantity
    FROM shop_items
   WHERE id = p_item_id AND is_active = true
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  IF v_quantity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_redeemed_count FROM redemptions WHERE item_id = p_item_id;
    IF v_redeemed_count >= v_quantity THEN
      RAISE EXCEPTION 'out_of_stock';
    END IF;
  END IF;

  -- Use wallet for balance check
  SELECT COALESCE(spendable_balance, 0) INTO v_balance
    FROM student_wallets WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    SELECT COALESCE(SUM(points), 0) INTO v_balance
      FROM challenge_submissions
     WHERE user_id = auth.uid() AND points IS NOT NULL;
  END IF;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  INSERT INTO redemptions (user_id, item_id, points_spent)
  VALUES (auth.uid(), p_item_id, v_cost);
END;
$$;
