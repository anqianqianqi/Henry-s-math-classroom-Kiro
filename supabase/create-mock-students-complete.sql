-- Create Mock Students with Submissions
-- This creates fake students, enrolls them in class, and adds their submissions

DO $$
DECLARE
  v_challenge_id uuid;
  v_class_id uuid;
BEGIN
  -- Get today's challenge
  SELECT id INTO v_challenge_id 
  FROM daily_challenges 
  WHERE challenge_date = CURRENT_DATE 
  AND created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
  LIMIT 1;

  -- Get the class
  SELECT id INTO v_class_id
  FROM classes
  WHERE created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_challenge_id IS NULL THEN
    RAISE EXCEPTION 'No challenge found for today!';
  END IF;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'No class found! Create a class first.';
  END IF;

  RAISE NOTICE 'Challenge ID: %', v_challenge_id;
  RAISE NOTICE 'Class ID: %', v_class_id;

  -- Temporarily disable foreign key constraint on profiles
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

  -- Create mock student profiles
  INSERT INTO profiles (id, email, full_name, created_at) VALUES
    ('11111111-1111-1111-1111-111111111111', 'sarah.mock@test.com', 'Sarah Chen', NOW() - INTERVAL '30 days'),
    ('22222222-2222-2222-2222-222222222222', 'mike.mock@test.com', 'Mike Johnson', NOW() - INTERVAL '25 days'),
    ('33333333-3333-3333-3333-333333333333', 'emma.mock@test.com', 'Emma Davis', NOW() - INTERVAL '20 days'),
    ('44444444-4444-4444-4444-444444444444', 'alex.mock@test.com', 'Alex Wong', NOW() - INTERVAL '15 days')
  ON CONFLICT (id) DO NOTHING;

  -- Re-enable foreign key constraint (but don't validate existing rows)
  ALTER TABLE profiles 
    ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) 
    ON DELETE CASCADE 
    NOT VALID;

  -- Enroll mock students in the class
  INSERT INTO class_members (class_id, user_id, role_id, joined_at) VALUES
    (v_class_id, '11111111-1111-1111-1111-111111111111', (SELECT id FROM roles WHERE name = 'student'), NOW() - INTERVAL '30 days'),
    (v_class_id, '22222222-2222-2222-2222-222222222222', (SELECT id FROM roles WHERE name = 'student'), NOW() - INTERVAL '25 days'),
    (v_class_id, '33333333-3333-3333-3333-333333333333', (SELECT id FROM roles WHERE name = 'student'), NOW() - INTERVAL '20 days'),
    (v_class_id, '44444444-4444-4444-4444-444444444444', (SELECT id FROM roles WHERE name = 'student'), NOW() - INTERVAL '15 days')
  ON CONFLICT DO NOTHING;

  -- Create mock submissions (3 out of 4 students submitted)
  INSERT INTO challenge_submissions (challenge_id, user_id, content, submitted_at) VALUES
    (v_challenge_id, '11111111-1111-1111-1111-111111111111',
     E'x = 5\n\nSteps:\n1. Start with: 2x + 5 = 15\n2. Subtract 5 from both sides: 2x = 10\n3. Divide both sides by 2: x = 5\n\nCheck: 2(5) + 5 = 15 ✓',
     NOW() - INTERVAL '15 minutes'),
    (v_challenge_id, '22222222-2222-2222-2222-222222222222',
     E'The answer is x = 5.\n\n2x + 5 = 15\n2x = 10\nx = 5\n\nI used inverse operations!',
     NOW() - INTERVAL '22 minutes'),
    (v_challenge_id, '33333333-3333-3333-3333-333333333333',
     E'x = 5\n\nI subtracted 5 from both sides to get 2x = 10, then divided by 2!',
     NOW() - INTERVAL '8 minutes')
  ON CONFLICT (challenge_id, user_id) DO NOTHING;

  RAISE NOTICE '✅ Mock students created and enrolled!';
END $$;

-- Verify
SELECT '=== Class Members ===' as status;
SELECT 
  p.full_name,
  cm.joined_at
FROM class_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN classes cl ON cm.class_id = cl.id
WHERE cl.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
ORDER BY cm.joined_at DESC;

SELECT '=== Challenge Submissions ===' as status;
SELECT 
  p.full_name,
  LEFT(cs.content, 50) as preview,
  cs.submitted_at
FROM challenge_submissions cs
JOIN profiles p ON cs.user_id = p.id
WHERE cs.challenge_id = (
  SELECT id FROM daily_challenges 
  WHERE challenge_date = CURRENT_DATE 
  AND created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
  LIMIT 1
)
ORDER BY cs.submitted_at DESC;

SELECT '=== Summary ===' as status;
SELECT 
  (SELECT COUNT(*) FROM class_members cm 
   JOIN classes cl ON cm.class_id = cl.id 
   WHERE cl.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')) as total_students,
  (SELECT COUNT(*) FROM challenge_submissions cs
   WHERE cs.challenge_id = (
     SELECT id FROM daily_challenges 
     WHERE challenge_date = CURRENT_DATE 
     AND created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
     LIMIT 1
   )) as total_submissions;
