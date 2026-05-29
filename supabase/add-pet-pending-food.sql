-- ============================================================
-- Pet Pending Food Migration
-- Adds a pet_feedings table to track food items purchased but
-- not yet fed to the pet. XP is applied when the student
-- explicitly feeds their pet on the /pet page.
-- ============================================================

-- -------------------------------------------------------
-- 1. pet_feedings table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS pet_feedings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  redemption_id UUID NOT NULL REFERENCES redemptions(id) ON DELETE CASCADE,
  item_id      UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  food_xp      INTEGER NOT NULL CHECK (food_xp >= 1),
  item_title   TEXT NOT NULL,
  fed_at       TIMESTAMPTZ,          -- NULL = pending, set when fed
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_feedings_user_id ON pet_feedings(user_id);
CREATE INDEX IF NOT EXISTS idx_pet_feedings_pending ON pet_feedings(user_id, fed_at) WHERE fed_at IS NULL;

-- -------------------------------------------------------
-- RLS: pet_feedings
-- -------------------------------------------------------
ALTER TABLE pet_feedings ENABLE ROW LEVEL SECURITY;

-- Students can read and update their own feedings
CREATE POLICY "pet_feedings_student_own" ON pet_feedings
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -------------------------------------------------------
-- 2. Updated redeem_item_v2 — food items no longer apply
--    XP immediately. Instead they insert a pet_feedings row.
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
  v_title           TEXT;
  v_redeemed_count  INTEGER;
  v_earned          INTEGER;
  v_spent           INTEGER;
  v_balance         INTEGER;
  v_redemption_id   UUID;
  v_result          jsonb;
BEGIN
  -- Lock item row to prevent concurrent redemptions
  SELECT cost, quantity, category, food_xp, target_species, title
    INTO v_cost, v_quantity, v_category, v_food_xp, v_target_species, v_title
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

  -- Balance check
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

  -- Insert redemption record
  INSERT INTO redemptions (user_id, item_id, points_spent)
  VALUES (auth.uid(), p_item_id, v_cost)
  RETURNING id INTO v_redemption_id;

  v_result := jsonb_build_object('success', true);

  -- Food item: queue for feeding (do NOT apply XP immediately)
  IF v_category = 'food' AND v_food_xp IS NOT NULL THEN
    INSERT INTO pet_feedings (user_id, redemption_id, item_id, food_xp, item_title)
    VALUES (auth.uid(), v_redemption_id, p_item_id, v_food_xp, v_title);

    v_result := jsonb_build_object(
      'success',    true,
      'food_xp',    v_food_xp,
      'item_title', v_title,
      'pending',    true
    );

  -- Pet item: reset species immediately
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
-- 3. apply_pet_feeding(p_feeding_id UUID)
--    Called from the /pet page when the student clicks Feed.
--    Applies XP, recomputes stage, marks feeding as done.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_pet_feeding(p_feeding_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_food_xp   INTEGER;
  v_new_xp    INTEGER;
  v_new_stage TEXT;
BEGIN
  -- Lock and verify the feeding belongs to this user and is pending
  SELECT food_xp INTO v_food_xp
    FROM pet_feedings
   WHERE id = p_feeding_id
     AND user_id = auth.uid()
     AND fed_at IS NULL
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'feeding_not_found';
  END IF;

  -- Ensure student_pets row exists
  INSERT INTO student_pets (user_id, xp, evolution_stage)
  VALUES (auth.uid(), 0, 'egg')
  ON CONFLICT (user_id) DO NOTHING;

  -- Apply XP
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

  -- Mark feeding as done
  UPDATE pet_feedings
     SET fed_at = now()
   WHERE id = p_feeding_id;

  RETURN jsonb_build_object(
    'success',   true,
    'xp_gained', v_food_xp,
    'new_xp',    v_new_xp,
    'new_stage', v_new_stage
  );
END;
$$;
