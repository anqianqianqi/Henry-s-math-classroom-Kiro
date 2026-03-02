-- Add One More Test Student to Challenge
-- First create the user in Supabase Dashboard:
-- Email: lisa@test.com
-- Password: test123
-- Auto Confirm: YES

-- Then run this SQL:

DO $$
DECLARE
  v_challenge_id uuid;
  v_class_id uuid;
  v_lisa_id uuid;
BEGIN
  -- Get IDs
  SELECT id INTO v_challenge_id 
  FROM daily_challenges 
  WHERE challenge_date = CURRENT_DATE 
  AND created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
  LIMIT 1;

  SELECT id INTO v_class_id
  FROM classes
  WHERE created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_lisa_id FROM auth.users WHERE email = 'lisa@test.com';

  IF v_lisa_id IS NULL THEN
    RAISE EXCEPTION 'Lisa not found! Create lisa@test.com in Supabase Dashboard first.';
  END IF;

  -- Create profile if doesn't exist
  INSERT INTO profiles (id, email, full_name, created_at)
  VALUES (v_lisa_id, 'lisa@test.com', 'Lisa Martinez', NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Assign student role
  INSERT INTO user_roles (user_id, role_id, class_id)
  VALUES (v_lisa_id, (SELECT id FROM roles WHERE name = 'student'), NULL)
  ON CONFLICT DO NOTHING;

  -- Enroll in class
  INSERT INTO class_members (class_id, user_id, role_id, joined_at)
  VALUES (v_class_id, v_lisa_id, (SELECT id FROM roles WHERE name = 'student'), NOW())
  ON CONFLICT DO NOTHING;

  -- Add submission
  INSERT INTO challenge_submissions (challenge_id, user_id, content, submitted_at)
  VALUES (
    v_challenge_id,
    v_lisa_id,
    E'x = 5\n\nMy solution:\n2x + 5 = 15\n2x = 10\nx = 5',
    NOW() - INTERVAL '5 minutes'
  )
  ON CONFLICT (challenge_id, user_id) DO NOTHING;

  RAISE NOTICE '✅ Lisa added!';
END $$;

-- Verify
SELECT 'Students in class:' as info;
SELECT p.email, p.full_name
FROM class_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN classes cl ON cm.class_id = cl.id
WHERE cl.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
ORDER BY p.email;

SELECT 'Submissions:' as info;
SELECT p.email, p.full_name, 'SUBMITTED' as status
FROM challenge_submissions cs
JOIN profiles p ON cs.user_id = p.id
WHERE cs.challenge_id = (
  SELECT id FROM daily_challenges 
  WHERE challenge_date = CURRENT_DATE 
  AND created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
  LIMIT 1
)
ORDER BY cs.submitted_at DESC;
