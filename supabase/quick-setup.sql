-- Quick Setup for Student Testing
-- Simple version without complex conditionals

-- Create a test class
INSERT INTO classes (created_by, name, description, is_active, created_at)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com'),
  'Test Math Class',
  'Class for testing daily challenges',
  true,
  NOW()
);

-- Get the class ID we just created
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
  SELECT id INTO v_class_id FROM classes WHERE created_by = v_teacher_id ORDER BY created_at DESC LIMIT 1;

  -- Create student profile if it doesn't exist
  INSERT INTO profiles (id, email, full_name, created_at)
  SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', 'Student'),
    au.created_at
  FROM auth.users au
  WHERE au.email = 'anqiluo1997@gmail.com'
  ON CONFLICT (id) DO NOTHING;

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

  -- Create mock students
  INSERT INTO profiles (id, email, full_name, created_at) VALUES
    ('11111111-1111-1111-1111-111111111111', 'sarah.chen@student.com', 'Sarah Chen', NOW()),
    ('22222222-2222-2222-2222-222222222222', 'mike.johnson@student.com', 'Mike Johnson', NOW()),
    ('33333333-3333-3333-3333-333333333333', 'emma.davis@student.com', 'Emma Davis', NOW());

  -- Add mock students to class
  INSERT INTO class_members (class_id, user_id, role_id, joined_at) VALUES
    (v_class_id, '11111111-1111-1111-1111-111111111111', (SELECT id FROM roles WHERE name = 'student'), NOW()),
    (v_class_id, '22222222-2222-2222-2222-222222222222', (SELECT id FROM roles WHERE name = 'student'), NOW()),
    (v_class_id, '33333333-3333-3333-3333-333333333333', (SELECT id FROM roles WHERE name = 'student'), NOW());

  -- Add mock submissions
  INSERT INTO challenge_submissions (challenge_id, user_id, content, submitted_at) VALUES
    (v_challenge_id, '11111111-1111-1111-1111-111111111111', 
     E'x = 5\n\nSteps:\n1. Start with: 2x + 5 = 15\n2. Subtract 5: 2x = 10\n3. Divide by 2: x = 5', 
     NOW() - INTERVAL '15 minutes'),
    (v_challenge_id, '22222222-2222-2222-2222-222222222222',
     E'The answer is x = 5.\n\n2x + 5 = 15\n2x = 10\nx = 5',
     NOW() - INTERVAL '22 minutes'),
    (v_challenge_id, '33333333-3333-3333-3333-333333333333',
     E'x = 5\n\nI used algebra to solve!',
     NOW() - INTERVAL '8 minutes');

  RAISE NOTICE '✅ Setup complete!';
END $$;

-- Verify
SELECT 'Student classes:' as info;
SELECT cl.name, cm.joined_at
FROM class_members cm
JOIN classes cl ON cm.class_id = cl.id
WHERE cm.user_id = (SELECT id FROM auth.users WHERE email = 'anqiluo1997@gmail.com');

SELECT 'Available challenges:' as info;
SELECT dc.title, dc.challenge_date,
       (SELECT COUNT(*) FROM challenge_submissions WHERE challenge_id = dc.id) as submissions
FROM daily_challenges dc
JOIN challenge_assignments ca ON dc.id = ca.challenge_id
JOIN class_members cm ON ca.class_id = cm.class_id
WHERE cm.user_id = (SELECT id FROM auth.users WHERE email = 'anqiluo1997@gmail.com');
