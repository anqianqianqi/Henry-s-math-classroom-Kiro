-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Creates the redeem_physical_blindbox RPC function.
--
-- This was not created earlier because the SQL editor stopped
-- at a unique index error (duplicate data). The constraint and
-- trigger already ran successfully — only this function is missing.
-- ============================================================

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
    DECLARE
      v_redeemed_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_redeemed_count FROM redemptions WHERE item_id = p_item_id;
      IF v_redeemed_count >= v_quantity THEN
        RAISE EXCEPTION 'out_of_stock';
      END IF;
    END;
  END IF;

  -- Balance check
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

  -- Send in-app notification to teacher (omit related_id if column doesn't exist)
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    v_teacher_id,
    'physical_redemption',
    '📦 Physical Blind Box Redeemed',
    v_student_name || ' redeemed "' || v_title || '" — please ship the physical item!'
  );

  RETURN jsonb_build_object(
    'success',    true,
    'image_id',   v_image_id,
    'image_url',  v_image_url
  );
END;
$$;
