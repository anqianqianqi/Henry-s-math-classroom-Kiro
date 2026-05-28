-- ============================================================
-- Fix: redeem_item_v2 now deducts from student_wallets
-- Run this in the Supabase SQL Editor.
-- ============================================================

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

  -- Balance check from student_wallets (the authoritative source)
  SELECT spendable_balance INTO v_balance
    FROM student_wallets
   WHERE user_id = auth.uid()
     FOR UPDATE;

  -- If no wallet row yet, create one with 0 balance
  IF NOT FOUND THEN
    INSERT INTO student_wallets (user_id, total_earned, total_spent, spendable_balance)
    VALUES (auth.uid(), 0, 0, 0);
    v_balance := 0;
  END IF;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Insert redemption record
  INSERT INTO redemptions (user_id, item_id, points_spent)
  VALUES (auth.uid(), p_item_id, v_cost)
  RETURNING id INTO v_redemption_id;

  -- Deduct from student_wallets
  UPDATE student_wallets
     SET spendable_balance = spendable_balance - v_cost,
         total_spent       = total_spent + v_cost
   WHERE user_id = auth.uid();

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
