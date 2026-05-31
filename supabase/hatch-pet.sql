-- ============================================================
-- hatch_pet() RPC
-- Hatches the current user's egg into a baby Didi (cat).
-- SECURITY DEFINER bypasses RLS so teachers/admins can also hatch.
-- ============================================================

CREATE OR REPLACE FUNCTION hatch_pet()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Ensure row exists
  INSERT INTO student_pets (user_id, xp, evolution_stage, species)
  VALUES (v_user_id, 0, 'egg', NULL)
  ON CONFLICT (user_id) DO NOTHING;

  -- Hatch into baby cat
  UPDATE student_pets
     SET species         = 'cat',
         evolution_stage = 'baby',
         xp              = 0,
         updated_at      = now()
   WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'ok',    true,
    'stage', 'baby',
    'species', 'cat'
  );
END;
$$;
