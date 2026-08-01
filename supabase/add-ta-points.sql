-- ============================================================
-- "I understand now" — resolving a bubble, and TA points
-- ============================================================
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- The owner of a question thanks one person who replied. That resolves the
-- question (it stops floating) and gives the thanked person one TA point —
-- unless they are staff, who help as part of the job.
--
-- ── WHY A SECOND WALLET RATHER THAN A DERIVED COUNT ─────────
-- Challenge points already live in student_wallets as a row-locked balance,
-- because spending has to be atomic: two clicks on Buy must not both pass the
-- balance check. TA points are spendable too, so they need the same treatment.
-- bubble_thanks remains the append-only record behind the number, so the
-- balance can always be audited against it.
--
-- ── NOTHING EXISTING IS MODIFIED ────────────────────────────
-- The four redemption functions that handle challenge points — redeem_item_v2,
-- redeem_physical, redeem_blindbox, redeem_physical_blindbox — are NOT touched.
-- TA purchases go through a new function alongside them. Money code that works
-- today keeps running exactly the same instructions.
--
-- Every added column has a default, so existing rows keep today's meaning:
-- every current shop item is a challenge-points item, every past redemption was
-- challenge spending, and every current bubble is unresolved and still floats.
-- ============================================================

-- ── Resolution ──────────────────────────────────────────────

ALTER TABLE bubble_room_questions
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS bubble_questions_unresolved_idx
  ON bubble_room_questions (resolved_at) WHERE resolved_at IS NULL;

-- ── The thanks record ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS bubble_thanks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- UNIQUE is what makes resolving final. Enforced here rather than by the UI
  -- hiding a button, so a student cannot re-thank to mint points for a friend.
  question_id      UUID NOT NULL UNIQUE
                     REFERENCES bubble_room_questions(id) ON DELETE CASCADE,

  thanked_user_id  UUID NOT NULL REFERENCES auth.users(id),
  thanked_by       UUID NOT NULL REFERENCES auth.users(id),

  -- Recorded, not recomputed. If a student is later made a TA, or a teacher's
  -- role changes, history must not silently re-price itself.
  awarded_point    BOOLEAN NOT NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A student may answer their own question, so without this the owner could
  -- thank themselves and mint TA points indefinitely.
  CONSTRAINT no_self_thanks CHECK (thanked_user_id <> thanked_by)
);

CREATE INDEX IF NOT EXISTS bubble_thanks_recipient_idx
  ON bubble_thanks (thanked_user_id);

-- ── TA wallet ───────────────────────────────────────────────
-- Alongside the challenge columns on the same row, so one lock covers both and
-- a student cannot spend the same click twice across currencies.

ALTER TABLE student_wallets
  ADD COLUMN IF NOT EXISTS ta_earned  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ta_spent   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ta_balance INTEGER NOT NULL DEFAULT 0;

-- ── Shop currency ───────────────────────────────────────────

ALTER TABLE shop_items
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'challenge'
    CHECK (currency IN ('challenge', 'ta'));

-- Recorded on the redemption too: re-pricing an item later must not
-- retroactively move past spending between the two wallets.
ALTER TABLE redemptions
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'challenge'
    CHECK (currency IN ('challenge', 'ta'));

-- ── Awarding, by trigger ────────────────────────────────────
-- On the insert rather than in application code: the point and the record of
-- it are then the same transaction, and no future caller can create a thanks
-- that forgets to pay.

CREATE OR REPLACE FUNCTION bubble_thanks_award_point()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT NEW.awarded_point THEN
    RETURN NEW;   -- staff: resolves the question, earns nothing
  END IF;

  INSERT INTO student_wallets (user_id, total_earned, total_spent, spendable_balance,
                               ta_earned, ta_spent, ta_balance)
  VALUES (NEW.thanked_user_id, 0, 0, 0, 1, 0, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET ta_earned  = student_wallets.ta_earned  + 1,
        ta_balance = student_wallets.ta_balance + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS bubble_thanks_pays ON bubble_thanks;
CREATE TRIGGER bubble_thanks_pays
  AFTER INSERT ON bubble_thanks
  FOR EACH ROW EXECUTE FUNCTION bubble_thanks_award_point();

-- ── Spending TA points ──────────────────────────────────────
-- A sibling of redeem_item_v2, not a modification of it. TA items are standard
-- goods only — no TA blind boxes — which keeps this to one new function
-- instead of four.

CREATE OR REPLACE FUNCTION redeem_ta_item(p_item_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost           INTEGER;
  v_quantity       INTEGER;
  v_currency       TEXT;
  v_redeemed_count INTEGER;
  v_balance        INTEGER;
  v_redemption_id  UUID;
BEGIN
  SELECT cost, quantity, currency
    INTO v_cost, v_quantity, v_currency
    FROM shop_items
   WHERE id = p_item_id AND is_active = true
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- Refuse to spend the wrong currency. Without this, a mis-routed call would
  -- buy a challenge-points item out of the TA wallet.
  IF v_currency <> 'ta' THEN
    RAISE EXCEPTION 'wrong_currency';
  END IF;

  IF v_quantity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_redeemed_count FROM redemptions WHERE item_id = p_item_id;
    IF v_redeemed_count >= v_quantity THEN
      RAISE EXCEPTION 'out_of_stock';
    END IF;
  END IF;

  SELECT ta_balance INTO v_balance
    FROM student_wallets
   WHERE user_id = auth.uid()
     FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO student_wallets (user_id, total_earned, total_spent, spendable_balance,
                                 ta_earned, ta_spent, ta_balance)
    VALUES (auth.uid(), 0, 0, 0, 0, 0, 0);
    v_balance := 0;
  END IF;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  INSERT INTO redemptions (user_id, item_id, points_spent, currency)
  VALUES (auth.uid(), p_item_id, v_cost, 'ta')
  RETURNING id INTO v_redemption_id;

  UPDATE student_wallets
     SET ta_balance = ta_balance - v_cost,
         ta_spent   = ta_spent   + v_cost
   WHERE user_id = auth.uid();

  RETURN jsonb_build_object('success', true, 'redemption_id', v_redemption_id);
END;
$$;

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE bubble_thanks ENABLE ROW LEVEL SECURITY;

-- Readable by anyone signed in: the panel shows who was thanked, and a TA
-- should be able to see the thanks they have received.
DROP POLICY IF EXISTS "Signed in users can read thanks" ON bubble_thanks;
CREATE POLICY "Signed in users can read thanks"
  ON bubble_thanks FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only the question's author may thank, and only as themselves. Both halves
-- matter: the first stops a bystander resolving someone else's question, the
-- second stops a forged thanked_by.
DROP POLICY IF EXISTS "Question owner can thank" ON bubble_thanks;
CREATE POLICY "Question owner can thank"
  ON bubble_thanks FOR INSERT
  WITH CHECK (
    thanked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM bubble_room_questions q
      WHERE q.id = question_id AND q.user_id = auth.uid()
    )
  );

-- ── Check ───────────────────────────────────────────────────
-- Expect: bubble_thanks present, wallets carrying ta_* columns, both currency
-- columns defaulted to 'challenge'.
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name = 'student_wallets' AND column_name LIKE 'ta\_%')       AS wallet_ta_columns,
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name = 'shop_items'  AND column_name = 'currency')          AS shop_currency,
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name = 'redemptions' AND column_name = 'currency')          AS redemption_currency,
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_name = 'bubble_thanks')                                     AS thanks_table;
