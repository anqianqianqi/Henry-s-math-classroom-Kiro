-- ============================================================
-- Add draws_per_redemption to shop_items
--
-- This controls how many pictures a student receives per draw
-- of a blind box. Default is 1 (existing behavior).
-- ============================================================

ALTER TABLE shop_items
  ADD COLUMN IF NOT EXISTS draws_per_redemption INTEGER NOT NULL DEFAULT 1
  CHECK (draws_per_redemption >= 1 AND draws_per_redemption <= 20);

COMMENT ON COLUMN shop_items.draws_per_redemption IS
  'How many images the student receives per blind box draw. Default 1.';

-- -------------------------------------------------------
-- Update redeem_blindbox to return N images per draw
-- (digital blind box — per-student inventory)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_blindbox(p_item_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost              INTEGER;
  v_quantity          INTEGER;
  v_draws             INTEGER;
  v_balance           INTEGER;
  v_pool_size         INTEGER;
  v_claimed_count     INTEGER;
  v_available         INTEGER;
  v_actual_draws      INTEGER;
  v_image_ids         UUID[];
  v_image_urls        TEXT[];
  v_image_id          UUID;
  v_image_url         TEXT;
  v_redemption_id     UUID;
BEGIN
  -- Lock item row
  SELECT cost, quantity, COALESCE(draws_per_redemption, 1)
    INTO v_cost, v_quantity, v_draws
    FROM shop_items
   WHERE id = p_item_id
     AND is_active = true
     AND commodity_type = 'blindbox'
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- Check overall quantity cap (total redemptions across all students)
  IF v_quantity IS NOT NULL THEN
    DECLARE v_redeemed_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_redeemed_count FROM redemptions WHERE item_id = p_item_id;
      IF v_redeemed_count >= v_quantity THEN
        RAISE EXCEPTION 'out_of_stock';
      END IF;
    END;
  END IF;

  -- Check balance
  SELECT COALESCE(spendable_balance, 0) INTO v_balance
    FROM student_wallets WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    SELECT COALESCE(SUM(points), 0) INTO v_balance
      FROM challenge_submissions WHERE user_id = auth.uid() AND points IS NOT NULL;
  END IF;
  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Check how many images this student has NOT yet claimed
  SELECT COUNT(*) INTO v_pool_size FROM blindbox_images WHERE item_id = p_item_id;
  SELECT COUNT(*) INTO v_claimed_count FROM blindbox_claims
   WHERE item_id = p_item_id AND student_id = auth.uid();

  v_available := v_pool_size - v_claimed_count;

  IF v_available <= 0 THEN
    RAISE EXCEPTION 'out_of_stock';
  END IF;

  -- Clamp draws to however many are actually available
  v_actual_draws := LEAST(v_draws, v_available);

  -- Pick v_actual_draws random images this student has NOT yet claimed
  FOR v_image_id, v_image_url IN
    SELECT bi.id, bi.image_url
      FROM blindbox_images bi
     WHERE bi.item_id = p_item_id
       AND NOT EXISTS (
         SELECT 1 FROM blindbox_claims bc
          WHERE bc.image_id = bi.id AND bc.student_id = auth.uid()
       )
     ORDER BY random()
     LIMIT v_actual_draws
  LOOP
    -- Record this student's claim
    INSERT INTO blindbox_claims (item_id, image_id, student_id)
    VALUES (p_item_id, v_image_id, auth.uid());

    v_image_ids  := array_append(v_image_ids,  v_image_id);
    v_image_urls := array_append(v_image_urls, v_image_url);
  END LOOP;

  -- Insert one redemption record (one spend per draw, regardless of N images)
  INSERT INTO redemptions (user_id, item_id, points_spent)
  VALUES (auth.uid(), p_item_id, v_cost)
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'success',     true,
    'image_ids',   v_image_ids,
    'image_urls',  v_image_urls,
    -- Legacy single-image fields for backward compat
    'image_id',    v_image_ids[1],
    'image_url',   v_image_urls[1]
  );
END;
$$;

-- -------------------------------------------------------
-- Update redeem_physical_blindbox to return N images per draw
-- (physical blind box — global inventory, is_claimed flag)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_physical_blindbox(p_item_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost           INTEGER;
  v_quantity       INTEGER;
  v_draws          INTEGER;
  v_title          TEXT;
  v_teacher_id     UUID;
  v_balance        INTEGER;
  v_image_ids      UUID[];
  v_image_urls     TEXT[];
  v_image_id       UUID;
  v_image_url      TEXT;
  v_redemption_id  UUID;
  v_student_name   TEXT;
  v_i              INTEGER;
BEGIN
  -- Lock item row
  SELECT cost, quantity, title, created_by, COALESCE(draws_per_redemption, 1)
    INTO v_cost, v_quantity, v_title, v_teacher_id, v_draws
    FROM shop_items
   WHERE id = p_item_id
     AND is_active = true
     AND commodity_type = 'physical_blindbox'
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- Overall quantity cap
  IF v_quantity IS NOT NULL THEN
    DECLARE v_redeemed_count INTEGER;
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

  -- Pick v_draws random unclaimed image slots (SKIP LOCKED prevents races)
  FOR v_i IN 1..v_draws LOOP
    SELECT id, image_url
      INTO v_image_id, v_image_url
      FROM blindbox_images
     WHERE item_id = p_item_id AND is_claimed = false
     ORDER BY random()
     LIMIT 1
       FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
      -- If we got at least one image, proceed with what we have
      IF array_length(v_image_ids, 1) > 0 THEN
        EXIT;
      END IF;
      RAISE EXCEPTION 'out_of_stock';
    END IF;

    UPDATE blindbox_images
       SET is_claimed = true,
           claimed_by = auth.uid(),
           claimed_at = now()
     WHERE id = v_image_id;

    v_image_ids  := array_append(v_image_ids,  v_image_id);
    v_image_urls := array_append(v_image_urls, v_image_url);
  END LOOP;

  -- Insert one redemption record
  INSERT INTO redemptions (user_id, item_id, points_spent)
  VALUES (auth.uid(), p_item_id, v_cost)
  RETURNING id INTO v_redemption_id;

  -- Get student name for notification
  SELECT COALESCE(nickname, first_name, 'A student') INTO v_student_name
    FROM profiles WHERE id = auth.uid();

  -- Create physical redemption request
  INSERT INTO physical_redemption_requests
    (redemption_id, item_id, student_id, teacher_id, status)
  VALUES
    (v_redemption_id, p_item_id, auth.uid(), v_teacher_id, 'pending');

  -- Notify teacher
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    v_teacher_id,
    'physical_redemption',
    '📦 Physical Blind Box Redeemed',
    v_student_name || ' redeemed "' || v_title || '" (' || array_length(v_image_ids, 1) || ' item(s)) — please ship!'
  );

  RETURN jsonb_build_object(
    'success',     true,
    'image_ids',   v_image_ids,
    'image_urls',  v_image_urls,
    -- Legacy single-image fields for backward compat
    'image_id',    v_image_ids[1],
    'image_url',   v_image_urls[1]
  );
END;
$$;
