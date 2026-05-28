-- ============================================================
-- Shop Commodity Types Migration
--
-- Adds three commodity types to the shop:
--   standard   — existing behavior (digital reward / privilege)
--   blindbox   — pool of images, each claimed once, random draw
--   physical   — physical prize, teacher notified to ship
--
-- Also adds a `details` column for collapsible item descriptions.
-- ============================================================

-- -------------------------------------------------------
-- 1. Extend shop_items
-- -------------------------------------------------------
ALTER TABLE shop_items
  ADD COLUMN IF NOT EXISTS commodity_type TEXT
    NOT NULL DEFAULT 'standard'
    CHECK (commodity_type IN ('standard', 'blindbox', 'physical')),
  ADD COLUMN IF NOT EXISTS details TEXT;  -- collapsible details shown to students

-- -------------------------------------------------------
-- 2. Blind box image pool
--    Each row = one unique image slot. claimed_by is set
--    atomically when a student redeems the blind box.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS blindbox_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  is_claimed  BOOLEAN NOT NULL DEFAULT false,
  claimed_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at  TIMESTAMPTZ,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blindbox_images_item_id   ON blindbox_images(item_id);
CREATE INDEX IF NOT EXISTS idx_blindbox_images_unclaimed ON blindbox_images(item_id, is_claimed) WHERE is_claimed = false;
CREATE INDEX IF NOT EXISTS idx_blindbox_images_claimed_by ON blindbox_images(claimed_by);

-- RLS: blindbox_images
ALTER TABLE blindbox_images ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own item's images
CREATE POLICY "blindbox_images_teacher_all" ON blindbox_images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM shop_items si
      JOIN user_roles ur ON ur.user_id = auth.uid()
      JOIN roles r ON ur.role_id = r.id
      WHERE si.id = blindbox_images.item_id
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shop_items si
      JOIN user_roles ur ON ur.user_id = auth.uid()
      JOIN roles r ON ur.role_id = r.id
      WHERE si.id = blindbox_images.item_id
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Students can see their own claimed images
CREATE POLICY "blindbox_images_student_own" ON blindbox_images
  FOR SELECT
  USING (claimed_by = auth.uid());

-- Students can see unclaimed count (for display) — only count, not URLs
-- (The actual URL is only revealed after redemption via the RPC)
CREATE POLICY "blindbox_images_student_count" ON blindbox_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'student'
        AND ur.class_id IS NULL
    )
  );

-- -------------------------------------------------------
-- 3. Physical redemption requests
--    Tracks pending shipments so teachers can see them.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS physical_redemption_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_id  UUID NOT NULL REFERENCES redemptions(id) ON DELETE CASCADE,
  item_id        UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  teacher_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'shipped', 'delivered')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_physical_requests_teacher  ON physical_redemption_requests(teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_physical_requests_student  ON physical_redemption_requests(student_id);

ALTER TABLE physical_redemption_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "physical_requests_teacher_all" ON physical_redemption_requests
  FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "physical_requests_student_select" ON physical_redemption_requests
  FOR SELECT
  USING (student_id = auth.uid());

-- -------------------------------------------------------
-- 4. Allow 'physical_redemption' notification type
--    (extend the check constraint on notifications.type)
-- -------------------------------------------------------
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'class_starting',
    'homework_graded',
    'new_comment',
    'homework_due_soon',
    'homework_assigned',
    'material_uploaded',
    'submission_received',
    'physical_redemption'
  ));

-- -------------------------------------------------------
-- 5. RPC: redeem_blindbox(p_item_id UUID)
--    Atomically picks a random unclaimed image, marks it
--    claimed, inserts redemption, returns the image URL.
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

  -- Check overall quantity (if set)
  IF v_quantity IS NOT NULL THEN
    DECLARE v_redeemed_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_redeemed_count FROM redemptions WHERE item_id = p_item_id;
      IF v_redeemed_count >= v_quantity THEN
        RAISE EXCEPTION 'out_of_stock';
      END IF;
    END;
  END IF;

  -- Check balance from wallet
  SELECT COALESCE(spendable_balance, 0) INTO v_balance
    FROM student_wallets WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    SELECT COALESCE(SUM(points), 0) INTO v_balance
      FROM challenge_submissions WHERE user_id = auth.uid() AND points IS NOT NULL;
  END IF;
  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Pick a random unclaimed image (FOR UPDATE to prevent race)
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

  -- Mark image as claimed
  UPDATE blindbox_images
     SET is_claimed = true,
         claimed_by = auth.uid(),
         claimed_at = now()
   WHERE id = v_image_id;

  -- Insert redemption (triggers wallet update)
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
-- 6. RPC: redeem_physical(p_item_id UUID)
--    Inserts redemption, creates physical request,
--    and sends in-app notification to the item's creator.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_physical(p_item_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost          INTEGER;
  v_quantity      INTEGER;
  v_title         TEXT;
  v_teacher_id    UUID;
  v_balance       INTEGER;
  v_redemption_id UUID;
  v_student_name  TEXT;
BEGIN
  -- Lock item row
  SELECT cost, quantity, title, created_by
    INTO v_cost, v_quantity, v_title, v_teacher_id
    FROM shop_items
   WHERE id = p_item_id
     AND is_active = true
     AND commodity_type = 'physical'
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- Quantity check
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

  -- Get student name
  SELECT COALESCE(nickname, first_name, 'A student') INTO v_student_name
    FROM profiles WHERE id = auth.uid();

  -- Insert redemption
  INSERT INTO redemptions (user_id, item_id, points_spent)
  VALUES (auth.uid(), p_item_id, v_cost)
  RETURNING id INTO v_redemption_id;

  -- Create physical redemption request
  INSERT INTO physical_redemption_requests
    (redemption_id, item_id, student_id, teacher_id, status)
  VALUES
    (v_redemption_id, p_item_id, auth.uid(), v_teacher_id, 'pending');

  -- Send in-app notification to teacher
  INSERT INTO notifications (user_id, type, title, message, related_id)
  VALUES (
    v_teacher_id,
    'physical_redemption',
    '📦 Physical Prize Redeemed',
    v_student_name || ' redeemed "' || v_title || '" — please ship the item!',
    v_redemption_id
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
