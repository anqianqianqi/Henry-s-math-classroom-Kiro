-- ─────────────────────────────────────────────────────────────────────────────
-- Book Skin shop integration
-- Adds a 'book_skin' category to shop_items so skins appear correctly.
-- Also adds a 'book_skin_id' column to redemptions for efficient ownership
-- lookups, and creates an RPC that handles purchase + auto-equip atomically.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add book_skin to the shop_items.category enum-style check (if it exists)
--    If no check constraint exists, this is a no-op.
--    Run ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_category_check first
--    if you hit a constraint error, then re-run the one in add-virtual-pet.sql.
-- (No change needed — category is TEXT without a hard check in most setups)

-- 2. Add book_skin_id to redemptions for direct ownership queries
ALTER TABLE redemptions
  ADD COLUMN IF NOT EXISTS book_skin_id UUID REFERENCES book_skins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_redemptions_book_skin
  ON redemptions(user_id, book_skin_id)
  WHERE book_skin_id IS NOT NULL AND refunded_at IS NULL;

-- 3. RPC: redeem_book_skin
--    Atomically: checks balance → inserts redemption with book_skin_id → upserts user preference
--    Returns the skin data so the UI can immediately show it.
CREATE OR REPLACE FUNCTION redeem_book_skin(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_skin        RECORD;
  v_item        RECORD;
  v_balance     INTEGER;
  v_earned      INTEGER;
  v_spent       INTEGER;
BEGIN
  -- Lock the shop item and get the linked skin
  SELECT si.id, si.cost, si.is_active, bs.id AS skin_id, bs.skin_type
  INTO v_item
  FROM shop_items si
  JOIN book_skins bs ON bs.shop_item_id = si.id
  WHERE si.id = p_item_id
  FOR UPDATE OF si;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  IF NOT v_item.is_active THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- Already owned? (not refunded)
  IF EXISTS (
    SELECT 1 FROM redemptions
    WHERE user_id = v_user_id
      AND book_skin_id = v_item.skin_id
      AND refunded_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already_owned';
  END IF;

  -- Check balance
  SELECT COALESCE(SUM(cs.points), 0) INTO v_earned
  FROM challenge_submissions cs
  WHERE cs.user_id = v_user_id AND cs.is_locked = true;

  SELECT COALESCE(SUM(r.points_spent), 0) INTO v_spent
  FROM redemptions r
  WHERE r.user_id = v_user_id AND r.refunded_at IS NULL;

  v_balance := v_earned - v_spent;

  IF v_balance < v_item.cost THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Insert redemption
  INSERT INTO redemptions (user_id, item_id, points_spent, book_skin_id)
  VALUES (v_user_id, p_item_id, v_item.cost, v_item.skin_id);

  -- Auto-equip: upsert user preference with the purchased skin
  IF v_item.skin_type = 'cover' THEN
    INSERT INTO user_book_skin_preferences (user_id, cover_skin_id, updated_at)
    VALUES (v_user_id, v_item.skin_id, now())
    ON CONFLICT (user_id) DO UPDATE
      SET cover_skin_id = EXCLUDED.cover_skin_id,
          updated_at    = EXCLUDED.updated_at;
  ELSIF v_item.skin_type = 'page' THEN
    INSERT INTO user_book_skin_preferences (user_id, page_skin_id, updated_at)
    VALUES (v_user_id, v_item.skin_id, now())
    ON CONFLICT (user_id) DO UPDATE
      SET page_skin_id = EXCLUDED.page_skin_id,
          updated_at   = EXCLUDED.updated_at;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'skin_id', v_item.skin_id,
    'skin_type', v_item.skin_type,
    'points_spent', v_item.cost
  );
END;
$$;
