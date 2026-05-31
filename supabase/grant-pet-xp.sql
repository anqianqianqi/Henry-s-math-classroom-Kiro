-- ============================================================
-- grant_pet_xp(p_xp_gained INT, p_happiness_boost INT, p_hunger_boost INT)
--
-- SECURITY DEFINER — bypasses RLS so teachers/admins can update their own pet.
-- Called from /api/pet/teacher-xp and /api/pet/challenge-xp route handlers.
--
-- Creates the pet row if it doesn't exist yet.
-- Returns updated pet state.
-- ============================================================

CREATE OR REPLACE FUNCTION grant_pet_xp(
  p_xp_gained      INT DEFAULT 10,
  p_happiness_boost INT DEFAULT 5,
  p_hunger_boost    INT DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_xp             INT;
  v_species        TEXT;
  v_stage          TEXT;
  v_happiness      INT;
  v_hunger         INT;
  v_new_xp         INT;
  v_new_stage      TEXT;
  v_new_happiness  INT;
  v_new_hunger     INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Ensure pet row exists
  INSERT INTO student_pets (user_id, xp, evolution_stage, species)
  VALUES (v_user_id, 0, 'egg', NULL)
  ON CONFLICT (user_id) DO NOTHING;

  -- Fetch current state
  SELECT xp, species, evolution_stage,
         COALESCE(happiness, 80), COALESCE(hunger, 80)
    INTO v_xp, v_species, v_stage, v_happiness, v_hunger
    FROM student_pets
   WHERE user_id = v_user_id;

  -- Compute new values
  v_new_xp := COALESCE(v_xp, 0) + p_xp_gained;

  -- Only evolve if species is set (egg stays egg)
  IF v_species IS NULL THEN
    v_new_stage := v_stage;
  ELSE
    v_new_stage := CASE
      WHEN v_new_xp >= 300 THEN 'adult'
      WHEN v_new_xp >= 100 THEN 'teen'
      ELSE 'baby'
    END;
  END IF;

  v_new_happiness := LEAST(v_happiness + p_happiness_boost, 100);
  v_new_hunger    := LEAST(v_hunger    + p_hunger_boost,    100);

  -- Update (SECURITY DEFINER bypasses RLS)
  UPDATE student_pets
     SET xp              = v_new_xp,
         evolution_stage = v_new_stage,
         happiness       = v_new_happiness,
         hunger          = v_new_hunger,
         updated_at      = now()
   WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'ok',           true,
    'xp_gained',    p_xp_gained,
    'new_xp',       v_new_xp,
    'new_stage',    v_new_stage,
    'new_happiness', v_new_happiness,
    'new_hunger',   v_new_hunger
  );
END;
$$;
