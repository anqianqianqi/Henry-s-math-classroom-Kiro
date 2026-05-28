-- ============================================================
-- Physical Blind Box Migration
--
-- Adds commodity type 'physical_blindbox':
--   - Teacher uploads a pool of images (each = one physical item)
--   - Student redeems → gets a random unclaimed image (reveal + download)
--   - That image slot is marked claimed and can never be claimed again
--   - When all slots are claimed → item shows "Sold Out"
--   - Teacher gets notified to ship the physical item
--
-- Consistency: the existing blindbox_images.is_claimed + FOR UPDATE
-- SKIP LOCKED already guarantees each slot is claimed at most once.
-- No additional per-student constraint is needed.
-- ============================================================

-- -------------------------------------------------------
-- 1. Add 'physical_blindbox' to the commodity_type check
-- -------------------------------------------------------
ALTER TABLE shop_items
  DROP CONSTRAINT IF EXISTS shop_items_commodity_type_check;

ALTER TABLE shop_items
  ADD CONSTRAINT shop_items_commodity_type_check
  CHECK (commodity_type IN ('standard', 'blindbox', 'physical', 'physical_blindbox'));

-- -------------------------------------------------------
-- 2. RPC: redeem_physical_blindbox(p_item_id UUID)
--
-- Atomically:
--   1. Lock item row (FOR UPDATE)
--   2. Check balance
--   3. Pick a random unclaimed image (FOR UPDATE SKIP LOCKED)
--      → raises 'out_of_stock' if pool is empty
--   4. Mark image claimed
--   5. Insert redemption (wallet trigger fires automatically)
--   6. Create physical_redemption_request
--   7. Send in-app notification to teacher
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_physical_blindbox(p_item_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost           INTEGER;
  v_quantity       INTEGER;
  v_title          TEXT;
  v_teacher_id     UUID;
  v_balance        INTEGER;
  v_image_id       UUID;
  v_image_url      TEXT;
  v_redemption_id  UUID;
  v_student_name   TEXT;
BEGIN
  -- Lock item row to prevent concurrent redemptions
  SELECT cost, quantity, title, created_by
    INTO v_cost, v_quantity, v_title, v_teacher_id
    FROM shop_items
   WHERE id = p_item_id
     AND is_active = true
     AND commodity_type = 'physical_blindbox'
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- Overall quantity cap (NULL = unlimited, capped only by pool size)
  IF v_quantity IS NOT NULL THEN
    DECLARE v_redeemed_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_redeemed_count FROM redemptions WHERE item_id = p_item_id;
      IF v_redeemed_count >= v_quantity THEN
        RAISE EXCEPTION 'out_of_stock';
      END IF;
    END;
  END IF;

  -- Balance check (single row read from student_wallets)
  SELECT COALESCE(spendable_balance, 0) INTO v_balance
    FROM student_wallets WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    SELECT COALESCE(SUM(points), 0) INTO v_balance
      FROM challenge_submissions WHERE user_id = auth.uid() AND points IS NOT NULL;
  END IF;
  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Pick a random unclaimed image slot (SKIP LOCKED prevents race conditions)
  SELECT id, image_url
    INTO v_image_id, v_image_url
    FROM blindbox_images
   WHERE item_id = p_item_id AND is_claimed = false
   ORDER BY random()
   LIMIT 1
     FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'out_of_stock';
  END IF;

  -- Mark this specific image slot as claimed
  UPDATE blindbox_images
     SET is_claimed = true,
         claimed_by = auth.uid(),
         claimed_at = now()
   WHERE id = v_image_id;

  -- Insert redemption (triggers wallet deduction automatically)
  INSERT INTO redemptions (user_id, item_id, points_spent)
  VALUES (auth.uid(), p_item_id, v_cost)
  RETURNING id INTO v_redemption_id;

  -- Get student name for notification
  SELECT COALESCE(nickname, first_name, 'A student') INTO v_student_name
    FROM profiles WHERE id = auth.uid();

  -- Create physical redemption request for teacher to action
  INSERT INTO physical_redemption_requests
    (redemption_id, item_id, student_id, teacher_id, status)
  VALUES
    (v_redemption_id, p_item_id, auth.uid(), v_teacher_id, 'pending');

  -- Send in-app notification to teacher
  INSERT INTO notifications (user_id, type, title, message, related_id)
  VALUES (
    v_teacher_id,
    'physical_redemption',
    '📦 Physical Blind Box Redeemed',
    v_student_name || ' redeemed "' || v_title || '" — please ship the physical item!',
    v_redemption_id
  );

  RETURN jsonb_build_object(
    'success',    true,
    'image_id',   v_image_id,
    'image_url',  v_image_url
  );
END;
$$;
