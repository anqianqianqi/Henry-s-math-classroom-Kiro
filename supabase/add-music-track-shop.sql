-- ============================================================
-- Music Track Shop Feature
--
-- Students can spend points to unlock premium music tracks.
-- Unlocked tracks appear in their MusicPlayer alongside the
-- default free tracks.
-- ============================================================

-- 1. Add music_track as a commodity_type option
ALTER TABLE shop_items
  DROP CONSTRAINT IF EXISTS shop_items_commodity_type_check;

ALTER TABLE shop_items
  ADD CONSTRAINT shop_items_commodity_type_check
  CHECK (commodity_type IN ('standard', 'blindbox', 'physical', 'physical_blindbox', 'music_track'));

-- 2. Add music_file column — the filename inside /public/music/
ALTER TABLE shop_items
  ADD COLUMN IF NOT EXISTS music_file TEXT;  -- e.g. 'chill-beats.mp3'

-- 3. Track which students have unlocked which music tracks
CREATE TABLE IF NOT EXISTS user_unlocked_tracks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_unlocked_tracks_user ON user_unlocked_tracks(user_id);

-- RLS
ALTER TABLE user_unlocked_tracks ENABLE ROW LEVEL SECURITY;

-- Students can see their own unlocked tracks
CREATE POLICY "unlocked_tracks_student_select" ON user_unlocked_tracks
  FOR SELECT USING (user_id = auth.uid());

-- Teachers/admins can see all (for management)
CREATE POLICY "unlocked_tracks_teacher_select" ON user_unlocked_tracks
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

-- Insert handled by RPC only (SECURITY DEFINER)
CREATE POLICY "unlocked_tracks_insert_rpc" ON user_unlocked_tracks
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 4. RPC: redeem_music_track(p_item_id UUID)
--    Deducts points, inserts redemption, inserts unlock record.
CREATE OR REPLACE FUNCTION redeem_music_track(p_item_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost          INTEGER;
  v_title         TEXT;
  v_music_file    TEXT;
  v_balance       INTEGER;
  v_already       BOOLEAN;
BEGIN
  -- Lock item row
  SELECT cost, title, music_file
    INTO v_cost, v_title, v_music_file
    FROM shop_items
   WHERE id = p_item_id
     AND is_active = true
     AND commodity_type = 'music_track'
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- Already owned?
  SELECT EXISTS (
    SELECT 1 FROM user_unlocked_tracks
    WHERE user_id = auth.uid() AND item_id = p_item_id
  ) INTO v_already;

  IF v_already THEN
    RAISE EXCEPTION 'already_owned';
  END IF;

  -- Balance check
  SELECT COALESCE(spendable_balance, 0) INTO v_balance
    FROM student_wallets WHERE user_id = auth.uid();
  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Insert redemption (triggers wallet deduction)
  INSERT INTO redemptions (user_id, item_id, points_spent)
  VALUES (auth.uid(), p_item_id, v_cost);

  -- Record unlock
  INSERT INTO user_unlocked_tracks (user_id, item_id)
  VALUES (auth.uid(), p_item_id)
  ON CONFLICT (user_id, item_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success',     true,
    'title',       v_title,
    'music_file',  v_music_file
  );
END;
$$;

-- 5. Extend notifications type constraint (if needed)
-- (no new notification type needed for music tracks)
