-- Simple Setup - Just your real accounts
-- This will work with your existing teacher and student accounts

DO $$ 
DECLARE
  v_class_id uuid;
  v_teacher_id uuid;
  v_student_id uuid;
  v_challenge_id uuid;
BEGIN
  -- Get IDs
  SELECT id INTO v_teacher_id FROM auth.users WHERE email = 'anqiluo@amazon.com';
  SELECT id INTO v_student_id FROM auth.users WHERE email = 'anqiluo1997@gmail.com';

  -- Create student profile if it doesn't exist
  INSERT INTO profiles (id, email, full_name, created_at)
  SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', 'Student User'),
    au.created_at
  FROM auth.users au
  WHERE au.email = 'anqiluo1997@gmail.com'
  ON CONFLICT (id) DO NOTHING;

  -- Assign student role
  INSERT INTO user_roles (user_id, role_id, class_id)
  VALUES (
    v_student_id,
    (SELECT id FROM roles WHERE name = 'student'),
    NULL
  )
  ON CONFLICT DO NOTHING;

  -- Create a test class
  INSERT INTO classes (created_by, name, description, is_active, created_at)
  VALUES (
    v_teacher_id,
    'Math 101 - Test Class',
    'Class for testing daily challenges',
    true,
    NOW()
  )
  RETURNING id INTO v_class_id;

  -- Create today's challenge
  INSERT INTO daily_challenges (created_by, title, description, challenge_date, created_at)
  VALUES (
    v_teacher_id,
    'Solve for x: Linear Equation',
    E'Solve the following equation and show your work:\n\n2x + 5 = 15\n\nExplain each step of your solution.',
    CURRENT_DATE,
    NOW()
  )
  RETURNING id INTO v_challenge_id;

  -- Assign challenge to class
  INSERT INTO challenge_assignments (challenge_id, class_id, assigned_by)
  VALUES (v_challenge_id, v_class_id, v_teacher_id);

  -- Add student to class
  INSERT INTO class_members (class_id, user_id, role_id, joined_at)
  VALUES (
    v_class_id,
    v_student_id,
    (SELECT id FROM roles WHERE name = 'student'),
    NOW()
  );

  RAISE NOTICE '✅ Setup complete!';
  RAISE NOTICE 'Class ID: %', v_class_id;
  RAISE NOTICE 'Challenge ID: %', v_challenge_id;
END $$;

-- Verify setup
SELECT '=== Verification ===' as status;

SELECT 'Student profile:' as info;
SELECT id, email, full_name FROM profiles WHERE email = 'anqiluo1997@gmail.com';

SELECT 'Student is in class:' as info;
SELECT cl.name, cm.joined_at
FROM class_members cm
JOIN classes cl ON cm.class_id = cl.id
WHERE cm.user_id = (SELECT id FROM auth.users WHERE email = 'anqiluo1997@gmail.com');

SELECT 'Challenges available to student:' as info;
SELECT dc.title, dc.challenge_date
FROM daily_challenges dc
JOIN challenge_assignments ca ON dc.id = ca.challenge_id
JOIN class_members cm ON ca.class_id = cm.class_id
WHERE cm.user_id = (SELECT id FROM auth.users WHERE email = 'anqiluo1997@gmail.com');

SELECT '✅ Now refresh http://localhost:3000/challenges as student!' as next_step;
