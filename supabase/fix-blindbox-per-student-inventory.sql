-- ============================================================
-- Fix Blind Box: Per-Student Inventory
--
-- New model:
--   - blindbox_images is the POOL (never globally claimed)
--   - blindbox_claims tracks which student claimed which image
--   - Each student gets their own independent draw from the full pool
--   - "Sold out" = that student has claimed ALL images in the pool
--   - One student buying does NOT affect other students' availability
-- ============================================================

-- -------------------------------------------------------
-- 1. Create blindbox_claims table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS blindbox_claims (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  image_id   UUID NOT NULL REFERENCES blindbox_images(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Each student can only claim each image once
  UNIQUE (image_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_blindbox_claims_student ON blindbox_claims(student_id, item_id);
CREATE INDEX IF NOT EXISTS idx_blindbox_claims_image   ON blindbox_claims(image_id);

-- RLS
ALTER TABLE blindbox_claims ENABLE ROW LEVEL SECURITY;

-- Students can see their own claims
CREATE POLICY "blindbox_claims_student_own" ON blindbox_claims
  FOR SELECT USING (student_id = auth.uid());

-- Teachers/admins can see all claims for their items
CREATE POLICY "blindbox_claims_teacher_all" ON blindbox_claims
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM shop_items si
      JOIN user_roles ur ON ur.user_id = auth.uid()
      JOIN roles r ON ur.role_id = r.id
      WHERE si.id = blindbox_claims.item_id
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- -------------------------------------------------------
-- 2. Replace redeem_blindbox RPC with per-student logic
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_blindbox(p_item_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost          INTEGER;
  v_quantity      INTEGER;
  v_balance       INTEGER;
  v_image_id      UUID;
  v_image_url     TEXT;
  v_redemption_id UUID;
  v_pool_size     INTEGER;
  v_claimed_count INTEGER;
BEGIN
  -- Lock item row
  SELECT cost, quantity
    INTO v_cost, v_quantity
    FROM shop_items
   WHERE id = p_item_id
     AND is_active = true
     AND commodity_type = 'blindbox'
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- Check overall quantity cap (if set) — total redemptions across all students
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

  -- Check if this student has already claimed all images in the pool
  SELECT COUNT(*) INTO v_pool_size FROM blindbox_images WHERE item_id = p_item_id;
  SELECT COUNT(*) INTO v_claimed_count FROM blindbox_claims
   WHERE item_id = p_item_id AND student_id = auth.uid();

  IF v_claimed_count >= v_pool_size THEN
    RAISE EXCEPTION 'out_of_stock';  -- this student has seen all images
  END IF;

  -- Pick a random image this student has NOT yet claimed
  SELECT bi.id, bi.image_url
    INTO v_image_id, v_image_url
    FROM blindbox_images bi
   WHERE bi.item_id = p_item_id
     AND NOT EXISTS (
       SELECT 1 FROM blindbox_claims bc
        WHERE bc.image_id = bi.id AND bc.student_id = auth.uid()
     )
   ORDER BY random()
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'out_of_stock';
  END IF;

  -- Record this student's claim
  INSERT INTO blindbox_claims (item_id, image_id, student_id)
  VALUES (p_item_id, v_image_id, auth.uid());

  -- Insert redemption (triggers wallet deduction)
  INSERT INTO redemptions (user_id, item_id, points_spent)
  VALUES (auth.uid(), p_item_id, v_cost)
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'success',    true,
    'image_id',   v_image_id,
    'image_url',  v_image_url
  );
END;
$$;

-- -------------------------------------------------------
-- 3. Update blindbox_remaining display logic
--
-- The client queries blindbox_remaining as:
--   total images - images this student has already claimed
--
-- We expose a helper function for this:
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_blindbox_remaining_for_student(
  p_item_id  UUID,
  p_user_id  UUID
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    (SELECT COUNT(*) FROM blindbox_images WHERE item_id = p_item_id)::INTEGER
    -
    (SELECT COUNT(*) FROM blindbox_claims WHERE item_id = p_item_id AND student_id = p_user_id)::INTEGER;
$$;
