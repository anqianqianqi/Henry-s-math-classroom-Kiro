-- ============================================================
-- Virtual Pet Migration
-- Extends shop_items with category/food_xp/target_species columns
-- and creates the student_pets table with RLS policies.
--
-- This migration is purely additive:
--   - Uses ADD COLUMN IF NOT EXISTS for shop_items changes
--   - Uses CREATE TABLE IF NOT EXISTS for student_pets
--   - Removing these additions leaves the app fully functional
--
-- NOTE: The redeem_item_v2 RPC function is defined in a
-- separate migration step (task 1.2).
-- ============================================================

-- -------------------------------------------------------
-- 1. Extend shop_items (additive only)
-- -------------------------------------------------------
ALTER TABLE shop_items
  ADD COLUMN IF NOT EXISTS category TEXT
    NOT NULL DEFAULT 'other'
    CHECK (category IN ('food', 'accessory', 'pet', 'other')),
  ADD COLUMN IF NOT EXISTS food_xp INTEGER
    CHECK (food_xp IS NULL OR food_xp >= 1),
  ADD COLUMN IF NOT EXISTS target_species TEXT
    CHECK (target_species IS NULL OR target_species IN ('dragon', 'fox', 'cat'));

-- -------------------------------------------------------
-- 2. New student_pets table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_pets (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  species              TEXT CHECK (species IS NULL OR species IN ('dragon', 'fox', 'cat')),
  xp                   INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  evolution_stage      TEXT NOT NULL DEFAULT 'egg'
                         CHECK (evolution_stage IN ('egg', 'baby', 'teen', 'adult', 'legendary')),
  equipped_accessories UUID[] NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- Indexes
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_student_pets_user_id ON student_pets(user_id);

-- -------------------------------------------------------
-- RLS: student_pets
-- -------------------------------------------------------
ALTER TABLE student_pets ENABLE ROW LEVEL SECURITY;

-- Students can SELECT and UPDATE their own row
CREATE POLICY "student_pets_student_own" ON student_pets
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Teachers and administrators can SELECT all rows
CREATE POLICY "student_pets_teacher_select" ON student_pets
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

-- -------------------------------------------------------
-- 3. Extended RPC: redeem_item_v2(p_item_id UUID)
--
-- Extends the existing redeem_item() logic to handle:
--   - Food items: upserts student_pets, adds food_xp, recomputes evolution_stage
--   - Pet items: upserts student_pets with new species, resets xp/stage/accessories
--
-- Returns jsonb with:
--   { success: true }                                          (non-food/pet items)
--   { success, xp_gained, new_xp, new_stage }                 (food items)
--   { success, species_changed, new_species }                  (pet items)
--
-- Raises: 'item_not_found' | 'out_of_stock' | 'insufficient_balance'
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
  v_earned          INTEGER;
  v_spent           INTEGER;
  v_balance         INTEGER;
  v_new_xp          INTEGER;
  v_new_stage       TEXT;
  v_result          jsonb;
BEGIN
  -- Lock item row to prevent concurrent redemptions
  SELECT cost, quantity, category, food_xp, target_species
    INTO v_cost, v_quantity, v_category, v_food_xp, v_target_species
    FROM shop_items
   WHERE id = p_item_id AND is_active = true
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- Quantity check (NULL = unlimited)
  IF v_quantity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_redeemed_count
      FROM redemptions
     WHERE item_id = p_item_id;

    IF v_redeemed_count >= v_quantity THEN
      RAISE EXCEPTION 'out_of_stock';
    END IF;
  END IF;

  -- Balance check: earned - spent (challenge_submissions.points is never modified here)
  SELECT COALESCE(SUM(points), 0) INTO v_earned
    FROM challenge_submissions
   WHERE user_id = auth.uid() AND points IS NOT NULL;

  SELECT COALESCE(SUM(points_spent), 0) INTO v_spent
    FROM redemptions
   WHERE user_id = auth.uid();

  v_balance := v_earned - v_spent;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Insert redemption record (only write to the spending ledger)
  INSERT INTO redemptions (user_id, item_id, points_spent)
  VALUES (auth.uid(), p_item_id, v_cost);

  v_result := jsonb_build_object('success', true);

  -- Pet feeding logic: food item with a valid food_xp value
  IF v_category = 'food' AND v_food_xp IS NOT NULL THEN
    -- Ensure a student_pets row exists (insert with defaults if not)
    INSERT INTO student_pets (user_id, xp, evolution_stage)
    VALUES (auth.uid(), 0, 'egg')
    ON CONFLICT (user_id) DO NOTHING;

    -- Add XP and recompute evolution_stage (only when species is set)
    UPDATE student_pets
       SET xp = xp + v_food_xp,
           evolution_stage = CASE
             WHEN species IS NULL THEN evolution_stage  -- still egg, no stage change
             WHEN (xp + v_food_xp) >= 700 THEN 'legendary'
             WHEN (xp + v_food_xp) >= 300 THEN 'adult'
             WHEN (xp + v_food_xp) >= 100 THEN 'teen'
             ELSE 'baby'
           END,
           updated_at = now()
     WHERE user_id = auth.uid()
     RETURNING xp, evolution_stage INTO v_new_xp, v_new_stage;

    v_result := jsonb_build_object(
      'success',    true,
      'xp_gained',  v_food_xp,
      'new_xp',     v_new_xp,
      'new_stage',  v_new_stage
    );

  -- Species change: pet item with a valid target_species value
  ELSIF v_category = 'pet' AND v_target_species IS NOT NULL THEN
    -- Upsert student_pets: reset species, xp, stage, and accessories
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
