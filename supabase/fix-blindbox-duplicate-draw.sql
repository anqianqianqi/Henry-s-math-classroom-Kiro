-- ============================================================
-- Fix: Blindbox duplicate draw prevention
--
-- Problem: A student could open the same blindbox set twice if
-- they clicked quickly (race condition between the NOT EXISTS
-- check and the INSERT).
--
-- Fix: Use INSERT ... ON CONFLICT DO NOTHING and check if a row
-- was actually inserted. The unique index on (set_id, student_id)
-- acts as the atomic guard.
-- ============================================================

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
  v_claim_inserted    INTEGER;
BEGIN
  -- Lock item row to prevent concurrent redemptions on the same item
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

  -- Overall quantity cap (global total redemptions)
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

  -- ── SET-BASED DRAW ──────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_pool_count FROM blindbox_sets WHERE item_id = p_item_id;

  IF v_pool_count > 0 THEN
    -- Count sets already drawn by this student
    SELECT COUNT(*) INTO v_claimed_count
      FROM blindbox_claims
     WHERE item_id = p_item_id
       AND student_id = auth.uid()
       AND set_id IS NOT NULL;

    IF v_claimed_count >= v_pool_count THEN
      RAISE EXCEPTION 'out_of_stock';
    END IF;

    -- Pick a random unclaimed set
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

    -- Atomic claim: ON CONFLICT DO NOTHING prevents duplicates
    -- Must match the partial index predicate: WHERE set_id IS NOT NULL
    WITH ins AS (
      INSERT INTO blindbox_claims (item_id, image_id, student_id, set_id)
      VALUES (p_item_id,
              (SELECT id FROM blindbox_images WHERE set_id = v_set_id LIMIT 1),
              auth.uid(),
              v_set_id)
      ON CONFLICT (set_id, student_id) WHERE set_id IS NOT NULL DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_claim_inserted FROM ins;

    -- If nothing was inserted, this set was already claimed (concurrent draw)
    IF v_claim_inserted = 0 THEN
      RAISE EXCEPTION 'out_of_stock';
    END IF;

    -- Collect all images in this set to return to the student
    SELECT array_agg(id ORDER BY sort_order),
           array_agg(image_url ORDER BY sort_order)
      INTO v_image_ids, v_image_urls
      FROM blindbox_images
     WHERE set_id = v_set_id;

  ELSE
    -- ── LEGACY: no sets defined — individual image draw ─────────────────────
    SELECT COUNT(*) INTO v_pool_size FROM blindbox_images WHERE item_id = p_item_id;
    SELECT COUNT(*) INTO v_claimed_img_count FROM blindbox_claims
     WHERE item_id = p_item_id AND student_id = auth.uid() AND set_id IS NULL;

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
            WHERE bc.image_id = bi.id
              AND bc.student_id = auth.uid()
              AND bc.set_id IS NULL
         )
       ORDER BY random()
       LIMIT v_actual_draws
    LOOP
      INSERT INTO blindbox_claims (item_id, image_id, student_id)
      VALUES (p_item_id, v_image_id, auth.uid())
      ON CONFLICT DO NOTHING;

      v_image_ids  := array_append(v_image_ids,  v_image_id);
      v_image_urls := array_append(v_image_urls, v_image_url);
    END LOOP;

    IF array_length(v_image_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'out_of_stock';
    END IF;
  END IF;

  -- Deduct points — one redemption record per draw, store the set_id for direct image lookup
  INSERT INTO redemptions (user_id, item_id, points_spent, set_id)
  VALUES (auth.uid(), p_item_id, v_cost, v_set_id)
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'success',     true,
    'set_id',      v_set_id,
    'set_name',    v_set_name,
    'image_ids',   v_image_ids,
    'image_urls',  v_image_urls,
    -- legacy single-image fields
    'image_id',    v_image_ids[1],
    'image_url',   v_image_urls[1]
  );
END;
$$;
