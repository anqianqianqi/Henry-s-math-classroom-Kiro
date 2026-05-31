-- ============================================================
-- Pet Evolution System Migration
--
-- Adds columns to student_pets for:
--   - pet_name: student-assigned name
--   - happiness / hunger: mood system (0-100)
--   - current_streak / last_login_date: daily login streak
--   - streak_freezes: grace tokens
--
-- Adds daily_login_events table for deduplication.
--
-- Adds grant_daily_login_xp() RPC called on page load.
-- ============================================================

-- ── 1. Extend student_pets ────────────────────────────────────────────────────

ALTER TABLE student_pets
  ADD COLUMN IF NOT EXISTS pet_name         TEXT CHECK (char_length(pet_name) <= 20),
  ADD COLUMN IF NOT EXISTS happiness        INTEGER NOT NULL DEFAULT 80
                                              CHECK (happiness >= 0 AND happiness <= 100),
  ADD COLUMN IF NOT EXISTS hunger           INTEGER NOT NULL DEFAULT 80
                                              CHECK (hunger >= 0 AND hunger <= 100),
  ADD COLUMN IF NOT EXISTS current_streak   INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  ADD COLUMN IF NOT EXISTS last_login_date  DATE,
  ADD COLUMN IF NOT EXISTS streak_freezes   INTEGER NOT NULL DEFAULT 0
                                              CHECK (streak_freezes >= 0 AND streak_freezes <= 3);

-- ── 2. Daily login events (deduplication table) ───────────────────────────────

CREATE TABLE IF NOT EXISTS daily_login_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  login_date DATE NOT NULL DEFAULT CURRENT_DATE,
  xp_granted INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, login_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_login_events_user ON daily_login_events(user_id, login_date);

ALTER TABLE daily_login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_login_events_own" ON daily_login_events
  FOR ALL USING (user_id = auth.uid());

-- ── 3. RPC: grant_daily_login_xp() ───────────────────────────────────────────
--
-- Called on every authenticated page load (client-side, idempotent).
-- Grants 5 XP once per calendar day (UTC).
-- Updates streak, handles streak freeze on missed day.
-- Returns: { already_granted, xp_gained, new_xp, new_stage, streak, freeze_used }

CREATE OR REPLACE FUNCTION grant_daily_login_xp()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today          DATE := CURRENT_DATE;
  v_user_id        UUID := auth.uid();
  v_xp_gained      INTEGER := 5;
  v_new_xp         INTEGER;
  v_new_stage      TEXT;
  v_streak         INTEGER;
  v_last_date      DATE;
  v_freezes        INTEGER;
  v_freeze_used    BOOLEAN := false;
  v_days_missed    INTEGER;
BEGIN
  -- Idempotency check: already granted today?
  IF EXISTS (
    SELECT 1 FROM daily_login_events
    WHERE user_id = v_user_id AND login_date = v_today
  ) THEN
    -- Return current state without modifying anything
    SELECT xp, evolution_stage, current_streak
      INTO v_new_xp, v_new_stage, v_streak
      FROM student_pets WHERE user_id = v_user_id;
    RETURN jsonb_build_object(
      'already_granted', true,
      'xp_gained',       0,
      'new_xp',          COALESCE(v_new_xp, 0),
      'new_stage',       COALESCE(v_new_stage, 'egg'),
      'streak',          COALESCE(v_streak, 0),
      'freeze_used',     false
    );
  END IF;

  -- Ensure pet row exists
  INSERT INTO student_pets (user_id, xp, evolution_stage, happiness, current_streak)
  VALUES (v_user_id, 0, 'egg', 80, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current pet state
  SELECT xp, evolution_stage, current_streak, last_login_date, streak_freezes
    INTO v_new_xp, v_new_stage, v_streak, v_last_date, v_freezes
    FROM student_pets WHERE user_id = v_user_id;

  -- ── Streak logic ──────────────────────────────────────────────────────────
  IF v_last_date IS NULL THEN
    -- First ever login
    v_streak := 1;
  ELSE
    v_days_missed := v_today - v_last_date - 1;  -- 0 = consecutive, 1 = missed 1 day

    IF v_days_missed = 0 THEN
      -- Consecutive day
      v_streak := v_streak + 1;
    ELSIF v_days_missed >= 1 AND v_freezes > 0 THEN
      -- Missed day(s) but has freeze — consume one freeze, keep streak
      v_streak := v_streak + 1;
      v_freezes := v_freezes - 1;
      v_freeze_used := true;
    ELSE
      -- Missed day(s), no freeze — reset streak
      v_streak := 1;
    END IF;
  END IF;

  -- ── Grant streak milestone freeze tokens ─────────────────────────────────
  -- At 7, 14, 30 days: grant a freeze (up to max 3)
  IF v_streak IN (7, 14, 30) AND v_freezes < 3 THEN
    v_freezes := LEAST(v_freezes + 1, 3);
  END IF;

  -- ── Add XP ────────────────────────────────────────────────────────────────
  v_new_xp := v_new_xp + v_xp_gained;

  -- Recompute evolution stage
  v_new_stage := CASE
    WHEN v_new_xp >= 700 THEN 'legendary'
    WHEN v_new_xp >= 300 THEN 'adult'
    WHEN v_new_xp >= 100 THEN 'teen'
    ELSE 'baby'
  END;

  -- ── Update pet ────────────────────────────────────────────────────────────
  UPDATE student_pets
     SET xp              = v_new_xp,
         evolution_stage = CASE
           WHEN species IS NULL THEN evolution_stage  -- still egg
           ELSE v_new_stage
         END,
         happiness       = LEAST(happiness + 10, 100),
         current_streak  = v_streak,
         last_login_date = v_today,
         streak_freezes  = v_freezes,
         updated_at      = now()
   WHERE user_id = v_user_id;

  -- ── Record the login event ────────────────────────────────────────────────
  INSERT INTO daily_login_events (user_id, login_date, xp_granted)
  VALUES (v_user_id, v_today, v_xp_gained)
  ON CONFLICT (user_id, login_date) DO NOTHING;

  -- ── Grant 5 points to wallet ──────────────────────────────────────────────
  -- Use the existing wallet update pattern (insert redemption-style credit)
  -- We add directly to student_wallets.total_earned and spendable_balance
  UPDATE student_wallets
     SET total_earned      = total_earned + v_xp_gained,
         spendable_balance = spendable_balance + v_xp_gained
   WHERE user_id = v_user_id;

  -- If wallet row doesn't exist yet, create it
  INSERT INTO student_wallets (user_id, total_earned, total_spent, spendable_balance)
  VALUES (v_user_id, v_xp_gained, 0, v_xp_gained)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'already_granted', false,
    'xp_gained',       v_xp_gained,
    'new_xp',          v_new_xp,
    'new_stage',       v_new_stage,
    'streak',          v_streak,
    'freeze_used',     v_freeze_used
  );
END;
$$;
