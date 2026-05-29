-- ============================================================
-- Blind Box Draw Sets
--
-- Allows admin to define named sets of images. Each draw
-- reveals all images in one randomly selected set.
--
-- Model:
--   blindbox_sets  — named groups (e.g. "Set A", "Rare Pack")
--   blindbox_images.set_id — which set each image belongs to
--   blindbox_claims.set_id — which sets a student has already drawn
--
-- Draw logic:
--   1. Pick a random set this student has NOT yet drawn
--   2. Return ALL images in that set
--   3. Record the set as claimed for this student
--
-- Backward compat:
--   - Images without a set_id are treated as individual sets
--     (one image = one draw, same as before)
-- ============================================================

-- -------------------------------------------------------
-- 1. Create blindbox_sets table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS blindbox_sets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'Set',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blindbox_sets_item ON blindbox_sets(item_id, sort_order);

ALTER TABLE blindbox_sets ENABLE ROW LEVEL SECURITY;

-- Teachers can manage sets for their items
CREATE POLICY "blindbox_sets_teacher_all" ON blindbox_sets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM shop_items si
      JOIN user_roles ur ON ur.user_id = auth.uid()
      JOIN roles r ON ur.role_id = r.id
      WHERE si.id = blindbox_sets.item_id
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shop_items si
      JOIN user_roles ur ON ur.user_id = auth.uid()
      JOIN roles r ON ur.role_id = r.id
      WHERE si.id = blindbox_sets.item_id
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Students can see sets (to know how many draws remain)
CREATE POLICY "blindbox_sets_student_read" ON blindbox_sets
  FOR SELECT USING (true);

-- -------------------------------------------------------
-- 2. Add set_id to blindbox_images (nullable for compat)
-- -------------------------------------------------------
ALTER TABLE blindbox_images
  ADD COLUMN IF NOT EXISTS set_id UUID REFERENCES blindbox_sets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_blindbox_images_set ON blindbox_images(set_id);

-- -------------------------------------------------------
-- 3. Add set_id to blindbox_claims
-- -------------------------------------------------------
ALTER TABLE blindbox_claims
  ADD COLUMN IF NOT EXISTS set_id UUID REFERENCES blindbox_sets(id) ON DELETE CASCADE;

-- Unique: each student can only claim each set once
CREATE UNIQUE INDEX IF NOT EXISTS idx_blindbox_claims_set_student
  ON blindbox_claims(set_id, student_id)
  WHERE set_id IS NOT NULL;

-- -------------------------------------------------------
-- 4. Replace redeem_blindbox with set-aware version
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_blindbox(p_item_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost              INTEGER;
  v_quantity          INTEGER;
  v_balance           INTEGER;
  v_redemption_id     UUID;
  v_set_id            UUID;
  v_set_name          TEXT;
  v_image_ids         UUID[]  := '{}';
  v_image_urls        TEXT[]  := '{}';
  v_pool_count        INTEGER;
  v_claimed_count     INTEGER;
  -- For legacy (no-set) images
  v_draws             INTEGER;
  v_pool_size         INTEGER;
  v_claimed_img_count INTEGER;
  v_available         INTEGER;
  v_actual_draws      INTEGER;
  v_image_id          UUID;
  v_image_url         TEXT;
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

  -- ── SET-BASED DRAW ──────────────────────────────────────
  -- Check if this item has any sets defined
  SELECT COUNT(*) INTO v_pool_count FROM blindbox_sets WHERE item_id = p_item_id;

  IF v_pool_count > 0 THEN
    -- Count how many sets this student has already drawn
    SELECT COUNT(*) INTO v_claimed_count
      FROM blindbox_claims
     WHERE item_id = p_item_id
       AND student_id = auth.uid()
       AND set_id IS NOT NULL;

    IF v_claimed_count >= v_pool_count THEN
      RAISE EXCEPTION 'out_of_stock';
    END IF;

    -- Pick a random set this student has NOT yet drawn
    SELECT bs.id, bs.name
      INTO v_set_id, v_set_name
      FROM blindbox_sets bs
     WHERE bs.item_id = p_item_id
       AND NOT EXISTS (
         SELECT 1 FROM blindbox_claims bc
          WHERE bc.set_id = bs.id AND bc.student_id = auth.uid()
       )
     ORDER BY random()
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'out_of_stock';
    END IF;

    -- Collect all images in this set
    SELECT array_agg(id ORDER BY sort_order),
           array_agg(image_url ORDER BY sort_order)
      INTO v_image_ids, v_image_urls
      FROM blindbox_images
     WHERE set_id = v_set_id;

    -- Record the set claim (one row per set draw)
    INSERT INTO blindbox_claims (item_id, image_id, student_id, set_id)
    VALUES (p_item_id, v_image_ids[1], auth.uid(), v_set_id);

  ELSE
    -- ── LEGACY: no sets — fall back to individual image draw ──
    SELECT COUNT(*) INTO v_pool_size FROM blindbox_images WHERE item_id = p_item_id;
    SELECT COUNT(*) INTO v_claimed_img_count FROM blindbox_claims
     WHERE item_id = p_item_id AND student_id = auth.uid();

    v_available := v_pool_size - v_claimed_img_count;
    IF v_available <= 0 THEN
      RAISE EXCEPTION 'out_of_stock';
    END IF;

    v_actual_draws := LEAST(v_draws, v_available);

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
      INSERT INTO blindbox_claims (item_id, image_id, student_id)
      VALUES (p_item_id, v_image_id, auth.uid());

      v_image_ids  := array_append(v_image_ids,  v_image_id);
      v_image_urls := array_append(v_image_urls, v_image_url);
    END LOOP;
  END IF;

  -- Insert one redemption record
  INSERT INTO redemptions (user_id, item_id, points_spent)
  VALUES (auth.uid(), p_item_id, v_cost)
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'success',     true,
    'set_id',      v_set_id,
    'set_name',    v_set_name,
    'image_ids',   v_image_ids,
    'image_urls',  v_image_urls,
    -- Legacy single-image fields for backward compat
    'image_id',    v_image_ids[1],
    'image_url',   v_image_urls[1]
  );
END;
$$;

-- -------------------------------------------------------
-- 5. Helper: remaining draws for a student
--    Returns number of sets (or images if no sets) not yet drawn
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_blindbox_remaining_for_student(
  p_item_id  UUID,
  p_user_id  UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_set_count     INTEGER;
  v_claimed_sets  INTEGER;
  v_img_count     INTEGER;
  v_claimed_imgs  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_set_count FROM blindbox_sets WHERE item_id = p_item_id;

  IF v_set_count > 0 THEN
    SELECT COUNT(*) INTO v_claimed_sets
      FROM blindbox_claims
     WHERE item_id = p_item_id AND student_id = p_user_id AND set_id IS NOT NULL;
    RETURN v_set_count - v_claimed_sets;
  ELSE
    SELECT COUNT(*) INTO v_img_count  FROM blindbox_images WHERE item_id = p_item_id;
    SELECT COUNT(*) INTO v_claimed_imgs FROM blindbox_claims WHERE item_id = p_item_id AND student_id = p_user_id;
    RETURN v_img_count - v_claimed_imgs;
  END IF;
END;
$$;
