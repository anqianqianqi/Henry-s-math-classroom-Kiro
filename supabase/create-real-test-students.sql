-- Create Real Test Student Accounts
-- These will be actual users that can log in

-- Instructions:
-- You need to create these users via Supabase Dashboard because SQL can't create auth.users directly
-- Go to: Authentication → Users → Add User

-- Create these 4 test accounts:

-- Student 1:
-- Email: sarah@test.com
-- Password: test123
-- Auto Confirm: YES

-- Student 2:
-- Email: mike@test.com
-- Password: test123
-- Auto Confirm: YES

-- Student 3:
-- Email: emma@test.com
-- Password: test123
-- Auto Confirm: YES

-- Student 4:
-- Email: alex@test.com
-- Password: test123
-- Auto Confirm: YES

-- After creating the users in the dashboard, run this SQL to enroll them and add submissions:

DO $$
DECLARE
  v_challenge_id uuid;
  v_class_id uuid;
  v_sarah_id uuid;
  v_mike_id uuid;
  v_emma_id uuid;
  v_alex_id uuid;
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
  SELECT id INTO v_emma_id FROM auth.users WHERE email = 'emma@test.com';
  SELECT id INTO v_alex_id FROM auth.users WHERE email = 'alex@test.com';

  IF v_challenge_id IS NULL THEN
    RAISE EXCEPTION 'No challenge found!';
  END IF;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'No class found!';
  END IF;

  IF v_sarah_id IS NULL OR v_mike_id IS NULL OR v_emma_id IS NULL OR v_alex_id IS NULL THEN
    RAISE EXCEPTION 'Not all test users found! Create them in Supabase Dashboard first.';
  END IF;

  -- Enroll students in class
  INSERT INTO class_members (class_id, user_id, role_id, joined_at) VALUES
    (v_class_id, v_sarah_id, (SELECT id FROM roles WHERE name = 'student'), NOW() - INTERVAL '30 days'),
    (v_class_id, v_mike_id, (SELECT id FROM roles WHERE name = 'student'), NOW() - INTERVAL '25 days'),
    (v_class_id, v_emma_id, (SELECT id FROM roles WHERE name = 'student'), NOW() - INTERVAL '20 days'),
    (v_class_id, v_alex_id, (SELECT id FROM roles WHERE name = 'student'), NOW() - INTERVAL '15 days')
  ON CONFLICT DO NOTHING;

  -- Create submissions (3 out of 4 submitted)
  INSERT INTO challenge_submissions (challenge_id, user_id, content, submitted_at) VALUES
    (v_challenge_id, v_sarah_id,
     E'x = 5\n\nSteps:\n1. Start with: 2x + 5 = 15\n2. Subtract 5 from both sides: 2x = 10\n3. Divide both sides by 2: x = 5\n\nCheck: 2(5) + 5 = 15 ✓',
     NOW() - INTERVAL '15 minutes'),
    (v_challenge_id, v_mike_id,
     E'The answer is x = 5.\n\n2x + 5 = 15\n2x = 10\nx = 5\n\nI used inverse operations!',
     NOW() - INTERVAL '22 minutes'),
    (v_challenge_id, v_emma_id,
     E'x = 5\n\nI subtracted 5 from both sides to get 2x = 10, then divided by 2!',
     NOW() - INTERVAL '8 minutes')
  ON CONFLICT (challenge_id, user_id) DO NOTHING;

  RAISE NOTICE '✅ Students enrolled and submissions created!';
END $$;

-- Verify
SELECT '=== Test Students ===' as status;
SELECT email, created_at FROM auth.users WHERE email LIKE '%@test.com' ORDER BY email;

SELECT '=== Class Enrollment ===' as status;
SELECT 
  p.full_name,
  p.email,
  cm.joined_at
FROM class_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN classes cl ON cm.class_id = cl.id
WHERE cl.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
ORDER BY p.full_name;

SELECT '=== Submissions ===' as status;
SELECT 
  p.full_name,
  p.email,
  LEFT(cs.content, 40) as preview
FROM challenge_submissions cs
JOIN profiles p ON cs.user_id = p.id
WHERE cs.challenge_id = (
  SELECT id FROM daily_challenges 
  WHERE challenge_date = CURRENT_DATE 
  AND created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
  LIMIT 1
)
ORDER BY cs.submitted_at DESC;
