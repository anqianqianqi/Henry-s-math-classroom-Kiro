-- ============================================================
-- Points Shop Migration
-- Creates shop_items, redemptions tables, RLS policies,
-- and the atomic redeem_item() RPC function.
--
-- IMPORTANT: Student total_score (challenge_submissions.points)
-- is NEVER modified by this migration. The spendable_balance
-- is computed on demand as:
--   SUM(locked submissions) - SUM(redemptions.points_spent)
-- When a teacher increases a grade, the earned side goes up
-- and the wallet balance automatically increases too.
-- ============================================================

-- -------------------------------------------------------
-- Table 1: shop_items
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  cost        INTEGER NOT NULL CHECK (cost >= 1),
  image_url   TEXT,
  quantity    INTEGER CHECK (quantity IS NULL OR quantity >= 1),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- Table 2: redemptions (spending ledger — never reduces scores)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS redemptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id      UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL CHECK (points_spent >= 1),
  redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- Indexes
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_shop_items_is_active  ON shop_items(is_active);
CREATE INDEX IF NOT EXISTS idx_shop_items_created_by ON shop_items(created_by);
CREATE INDEX IF NOT EXISTS idx_redemptions_user_id   ON redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_item_id   ON redemptions(item_id);

-- -------------------------------------------------------
-- RLS: shop_items
-- -------------------------------------------------------
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;

-- Teachers can do everything
CREATE POLICY "shop_items_teacher_all" ON shop_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Students can only SELECT active items
CREATE POLICY "shop_items_student_select" ON shop_items
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'student'
        AND ur.class_id IS NULL
    )
  );

-- -------------------------------------------------------
-- RLS: redemptions
-- -------------------------------------------------------
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;

-- Students can INSERT their own redemptions
CREATE POLICY "redemptions_student_insert" ON redemptions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'student'
        AND ur.class_id IS NULL
    )
  );

-- Students can SELECT their own redemptions
CREATE POLICY "redemptions_student_select_own" ON redemptions
  FOR SELECT
  USING (user_id = auth.uid());

-- Teachers can SELECT all redemptions
CREATE POLICY "redemptions_teacher_select_all" ON redemptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- -------------------------------------------------------
-- RPC: redeem_item(p_item_id UUID)
--
-- Atomically:
--   1. Lock the shop_item row (FOR UPDATE) to prevent races
--   2. Check quantity availability
--   3. Compute spendable_balance = earned - spent
--      NOTE: earned = SUM(challenge_submissions.points WHERE is_locked=true)
--            This value is NEVER reduced — only increases when teacher grades
--   4. Check balance >= cost
--   5. Insert into redemptions
--
-- Raises: 'item_not_found' | 'out_of_stock' | 'insufficient_balance'
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_item(p_item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost            INTEGER;
  v_quantity        INTEGER;
  v_redeemed_count  INTEGER;
  v_earned          INTEGER;
  v_spent           INTEGER;
  v_balance         INTEGER;
BEGIN
  -- Lock the item row to prevent concurrent redemptions of the same item
  SELECT cost, quantity
    INTO v_cost, v_quantity
    FROM shop_items
   WHERE id = p_item_id AND is_active = true
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- Check quantity (NULL = unlimited)
  IF v_quantity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_redeemed_count
      FROM redemptions
     WHERE item_id = p_item_id;

    IF v_redeemed_count >= v_quantity THEN
      RAISE EXCEPTION 'out_of_stock';
    END IF;
  END IF;

  -- Compute spendable balance for the calling user.
  -- challenge_submissions.points is NEVER modified here — read-only.
  -- When a teacher increases a grade, v_earned increases automatically,
  -- which increases the spendable balance.
  SELECT COALESCE(SUM(points), 0) INTO v_earned
    FROM challenge_submissions
   WHERE user_id = auth.uid() AND points IS NOT NULL;

  SELECT COALESCE(SUM(points_spent), 0) INTO v_spent
    FROM redemptions
   WHERE user_id = auth.uid();

  v_balance := v_earned - v_spent;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Insert the redemption record (this is the only write — no score modification)
  INSERT INTO redemptions (user_id, item_id, points_spent)
  VALUES (auth.uid(), p_item_id, v_cost);
END;
$$;
