-- ─────────────────────────────────────────────────────────────────────────────
-- Pet Room Background ownership via redemptions
-- Mirrors the book_skin_id pattern in redemptions so that:
--   - Users can purchase a pet room background from the shop
--   - Purchasing gives permanent ownership (survives visibility changes)
--   - loadBgs shows: public rooms + rooms this user purchased
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add pet_room_background_id to redemptions
ALTER TABLE redemptions
  ADD COLUMN IF NOT EXISTS pet_room_background_id UUID
    REFERENCES pet_room_backgrounds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_redemptions_pet_room_bg
  ON redemptions(user_id, pet_room_background_id)
  WHERE pet_room_background_id IS NOT NULL AND refunded_at IS NULL;

-- 2. RPC: purchase_pet_room(p_item_id UUID)
--    Atomically: verify balance, deduct points, insert redemption linked to background.
--    The shop_item must have a linked pet_room_background via pet_room_backgrounds.shop_item_id.
CREATE OR REPLACE FUNCTION purchase_pet_room(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_item        RECORD;
  v_bg          RECORD;
  v_spent       INTEGER;
  v_balance     INTEGER;
  v_earned      INTEGER;
BEGIN
  -- Load shop item
  SELECT cost, is_active INTO v_item
    FROM shop_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_not_found'; END IF;
  IF NOT v_item.is_active THEN RAISE EXCEPTION 'item_not_found'; END IF;

  -- Find the linked pet room background
  SELECT id INTO v_bg
    FROM pet_room_backgrounds WHERE shop_item_id = p_item_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_not_found'; END IF;

  -- Already owned?
  IF EXISTS (
    SELECT 1 FROM redemptions
    WHERE user_id = v_user_id
      AND pet_room_background_id = v_bg.id
      AND refunded_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already_owned';
  END IF;

  -- Check balance
  SELECT COALESCE(spendable_balance, 0) INTO v_balance
    FROM student_wallets WHERE user_id = v_user_id;
  IF v_balance < v_item.cost THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  -- Insert redemption (wallet trigger handles balance deduction)
  INSERT INTO redemptions (user_id, item_id, points_spent, pet_room_background_id)
  VALUES (v_user_id, p_item_id, v_item.cost, v_bg.id);

  RETURN jsonb_build_object('success', true, 'background_id', v_bg.id);
END;
$$;
