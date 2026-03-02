-- Enroll Only 2 Students (Sarah and Mike)
-- Emma and Alex will NOT see the challenge (not in class)

DO $$
DECLARE
  v_challenge_id uuid;
  v_class_id uuid;
  v_sarah_id uuid;
  v_mike_id uuid;
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

  SELECT id INTO v_sarah_id FROM auth.users WHERE email = 'sarah@test.com';
  SELECT id INTO v_mike_id FROM auth.users WHERE email = 'mike@test.com';

  IF v_challenge_id IS NULL THEN
    RAISE EXCEPTION 'No challenge found!';
  END IF;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'No class found!';
  END IF;

  IF v_sarah_id IS NULL OR v_mike_id IS NULL THEN
    RAISE EXCEPTION 'Sarah or Mike not found! Create them in Supabase Dashboard first.';
  END IF;

  -- Enroll ONLY Sarah and Mike in class
  INSERT INTO class_members (class_id, user_id, role_id, joined_at) VALUES
    (v_class_id, v_sarah_id, (SELECT id FROM roles WHERE name = 'student'), NOW() - INTERVAL '30 days'),
    (v_class_id, v_mike_id, (SELECT id FROM roles WHERE name = 'student'), NOW() - INTERVAL '25 days')
  ON CONFLICT DO NOTHING;

  -- Sarah submits, Mike doesn't
  INSERT INTO challenge_submissions (challenge_id, user_id, content, submitted_at) VALUES
    (v_challenge_id, v_sarah_id,
     E'x = 5\n\nSteps:\n1. Start with: 2x + 5 = 15\n2. Subtract 5 from both sides: 2x = 10\n3. Divide both sides by 2: x = 5\n\nCheck: 2(5) + 5 = 15 ✓',
     NOW() - INTERVAL '15 minutes')
  ON CONFLICT (challenge_id, user_id) DO NOTHING;

  RAISE NOTICE '✅ Only Sarah and Mike enrolled!';
  RAISE NOTICE 'Sarah submitted, Mike has not';
  RAISE NOTICE 'Emma and Alex are NOT in the class';
END $$;

-- Verify
SELECT '=== Students in Class ===' as status;
SELECT 
  p.full_name,
  p.email,
  'IN CLASS' as status
FROM class_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN classes cl ON cm.class_id = cl.id
WHERE cl.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
ORDER BY p.full_name;

SELECT '=== Students NOT in Class ===' as status;
SELECT 
  p.full_name,
  p.email,
  'NOT IN CLASS' as status
FROM profiles p
WHERE p.email IN ('emma@test.com', 'alex@test.com')
ORDER BY p.full_name;

SELECT '=== Submissions ===' as status;
SELECT 
  p.full_name,
  p.email,
  'SUBMITTED' as status
FROM challenge_submissions cs
JOIN profiles p ON cs.user_id = p.id
WHERE cs.challenge_id = (
  SELECT id FROM daily_challenges 
  WHERE challenge_date = CURRENT_DATE 
  AND created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
  LIMIT 1
);

SELECT '=== Expected Results ===' as info;
SELECT 'Teacher (anqiluo@amazon.com): Sees challenge, 1 of 3 students (33%)' as result
UNION ALL
SELECT 'Sarah (sarah@test.com): Sees challenge, CAN see Mike (submitted)'
UNION ALL
SELECT 'Mike (mike@test.com): Sees challenge, CANNOT see Sarah (not submitted yet)'
UNION ALL
SELECT 'Emma (emma@test.com): NO CHALLENGE (not in class)'
UNION ALL
SELECT 'Alex (alex@test.com): NO CHALLENGE (not in class)';
