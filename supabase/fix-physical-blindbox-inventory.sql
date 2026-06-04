-- ============================================================
-- Fix: Physical Blind Box Inventory Decrement
--
-- Problem: blindbox_sets.quantity was added as a static field
-- but was never decremented on redemption. Students could keep
-- redeeming the same set even after stock ran out.
--
-- Fix: Update redeem_physical_blindbox to:
--   1. Pick a random set that has quantity > 0 (or NULL = unlimited)
--      AND this student has NOT already claimed
--   2. Decrement blindbox_sets.quantity by 1 atomically
--   3. Return all images in that set
--   4. Raise 'out_of_stock' if no eligible sets remain
--
-- Also adds blindbox_claims tracking for physical_blindbox
-- (same as digital blindbox) so a student can't claim the
-- same set twice.
-- ============================================================

CREATE OR REPLACE FUNCTION redeem_physical_blindbox(p_item_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost           INTEGER;
  v_quantity       INTEGER;   -- shop_items.quantity (overall cap, rarely used)
  v_title          TEXT;
  v_teacher_id     UUID;
  v_balance        INTEGER;
  v_set_id         UUID;
  v_set_name       TEXT;
  v_image_ids      UUID[]  := '{}';
  v_image_urls     TEXT[]  := '{}';
  v_redemption_id  UUID;
  v_student_name   TEXT;
  v_redeemed_count INTEGER;
BEGIN
  -- ── 1. Lock item row ──────────────────────────────────────────────────────
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

  -- ── 2. Overall quantity cap (shop_items.quantity) ─────────────────────────
  IF v_quantity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_redeemed_count FROM redemptions WHERE item_id = p_item_id;
    IF v_redeemed_count >= v_quantity THEN
      RAISE EXCEPTION 'out_of_stock';
    END IF;
  END IF;

  -- ── 3. Balance check ──────────────────────────────────────────────────────
  SELECT COALESCE(spendable_balance, 0) INTO v_balance
    FROM student_wallets WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    SELECT COALESCE(SUM(points), 0) INTO v_balance
      FROM challenge_submissions WHERE user_id = auth.uid() AND points IS NOT NULL;
  END IF;
  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- ── 4. Pick a random eligible set ────────────────────────────────────────
  -- Eligible = has stock (quantity IS NULL OR quantity > 0)
  --          AND this student has not already claimed it
  SELECT bs.id, bs.name
    INTO v_set_id, v_set_name
    FROM blindbox_sets bs
   WHERE bs.item_id = p_item_id
     AND (bs.quantity IS NULL OR bs.quantity > 0)
     AND NOT EXISTS (
       SELECT 1 FROM blindbox_claims bc
        WHERE bc.set_id = bs.id
          AND bc.student_id = auth.uid()
     )
   ORDER BY random()
   LIMIT 1
     FOR UPDATE OF bs;  -- lock the chosen set row to prevent race conditions

  IF NOT FOUND THEN
    RAISE EXCEPTION 'out_of_stock';
  END IF;

  -- ── 5. Decrement set quantity ─────────────────────────────────────────────
  UPDATE blindbox_sets
     SET quantity = quantity - 1
   WHERE id = v_set_id
     AND quantity IS NOT NULL;
  -- (If quantity IS NULL = unlimited, we skip the decrement)

  -- ── 6. Collect all images in this set ────────────────────────────────────
  SELECT array_agg(id ORDER BY sort_order),
         array_agg(image_url ORDER BY sort_order)
    INTO v_image_ids, v_image_urls
    FROM blindbox_images
   WHERE set_id = v_set_id;

  -- ── 7. Record the claim (prevents double-claiming same set) ───────────────
  INSERT INTO blindbox_claims (item_id, image_id, student_id, set_id)
  VALUES (
    p_item_id,
    COALESCE(v_image_ids[1], gen_random_uuid()),  -- image_id required by schema
    auth.uid(),
    v_set_id
  )
  ON CONFLICT DO NOTHING;  -- safety: ignore if already claimed

  -- ── 8. Insert redemption (triggers wallet deduction) ─────────────────────
  INSERT INTO redemptions (user_id, item_id, points_spent)
  VALUES (auth.uid(), p_item_id, v_cost)
  RETURNING id INTO v_redemption_id;

  -- ── 9. Get student name for notification ─────────────────────────────────
  SELECT COALESCE(nickname, first_name, 'A student') INTO v_student_name
    FROM profiles WHERE id = auth.uid();

  -- ── 10. Create physical redemption request ────────────────────────────────
  INSERT INTO physical_redemption_requests
    (redemption_id, item_id, student_id, teacher_id, status)
  VALUES
    (v_redemption_id, p_item_id, auth.uid(), v_teacher_id, 'pending');

  -- ── 11. Notify teacher ────────────────────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, message, related_id)
  VALUES (
    v_teacher_id,
    'physical_redemption',
    '📦 Physical Blind Box Redeemed',
    v_student_name || ' redeemed "' || v_title || '"'
      || CASE WHEN v_set_name IS NOT NULL THEN ' (' || v_set_name || ')' ELSE '' END
      || ' — please ship the physical item!',
    v_redemption_id
  );

  RETURN jsonb_build_object(
    'success',    true,
    'set_id',     v_set_id,
    'set_name',   v_set_name,
    'image_ids',  v_image_ids,
    'image_urls', v_image_urls,
    -- Legacy single-image fields for backward compat
    'image_id',   v_image_ids[1],
    'image_url',  v_image_urls[1]
  );
END;
$$;

-- ── Helper: GLOBAL remaining stock for a physical_blindbox ───────────────────
-- Returns total physical copies still in stock across ALL sets.
-- This is what the shop badge should display.
CREATE OR REPLACE FUNCTION get_physical_blindbox_total_remaining(
  p_item_id UUID
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN bs.quantity IS NULL THEN 999  -- unlimited set
      ELSE bs.quantity
    END
  ), 0)::INTEGER
    FROM blindbox_sets bs
   WHERE bs.item_id = p_item_id
     AND (bs.quantity IS NULL OR bs.quantity > 0);
$$;
