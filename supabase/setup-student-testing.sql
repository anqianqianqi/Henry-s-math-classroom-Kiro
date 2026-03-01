-- Complete Setup for Student Testing
-- Run this to set up everything for testing with anqiluo1997@gmail.com

-- ============================================
-- STEP 1: Check what exists
-- ============================================

SELECT '=== STEP 1: Current State ===' as step;

SELECT 'Teacher Account:' as info;
SELECT id, email FROM auth.users WHERE email = 'anqiluo@amazon.com';

SELECT 'Student Account:' as info;
SELECT id, email FROM auth.users WHERE email = 'anqiluo1997@gmail.com';

SELECT 'Classes:' as info;
SELECT id, name, created_by FROM classes 
WHERE created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com');

SELECT 'Challenges:' as info;
SELECT id, title, challenge_date FROM daily_challenges
WHERE created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
ORDER BY challenge_date DESC;

-- ============================================
-- STEP 2: Create a test class if none exists
-- ============================================

SELECT '=== STEP 2: Ensure Class Exists ===' as step;

INSERT INTO classes (id, created_by, name, description, is_active, created_at)
SELECT 
  'test-class-1111-1111-1111-111111111111'::uuid,
  (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com'),
  'Test Math Class',
  'Class for testing daily challenges',
  true,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM classes 
  WHERE created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
);

SELECT '✅ Class ready' as status;

-- ============================================
-- STEP 3: Create today's challenge if none exists
-- ============================================

SELECT '=== STEP 3: Ensure Today''s Challenge Exists ===' as step;

INSERT INTO daily_challenges (id, created_by, title, description, challenge_date, created_at)
SELECT
  'today-challenge-1111-1111-1111-111111111111'::uuid,
  (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com'),
  'Solve for x: Linear Equation',
  E'Solve the following equation and show your work:\n\n2x + 5 = 15\n\nExplain each step of your solution.',
  CURRENT_DATE,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM daily_challenges 
  WHERE challenge_date = CURRENT_DATE
  AND created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
);

SELECT '✅ Challenge ready' as status;

-- ============================================
-- STEP 4: Assign challenge to class
-- ============================================

SELECT '=== STEP 4: Assign Challenge to Class ===' as step;

INSERT INTO challenge_assignments (challenge_id, class_id, assigned_by)
SELECT 
  dc.id,
  cl.id,
  (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
FROM daily_challenges dc
CROSS JOIN classes cl
WHERE dc.challenge_date = CURRENT_DATE
AND dc.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
AND cl.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
AND NOT EXISTS (
  SELECT 1 FROM challenge_assignments ca
  WHERE ca.challenge_id = dc.id AND ca.class_id = cl.id
);

SELECT '✅ Challenge assigned to class' as status;

-- ============================================
-- STEP 5: Add student to class
-- ============================================

SELECT '=== STEP 5: Add Student to Class ===' as step;

INSERT INTO class_members (class_id, user_id, role_id, joined_at)
SELECT 
  cl.id,
  (SELECT id FROM auth.users WHERE email = 'anqiluo1997@gmail.com'),
  (SELECT id FROM roles WHERE name = 'student'),
  NOW()
FROM classes cl
WHERE cl.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
AND NOT EXISTS (
  SELECT 1 FROM class_members cm
  WHERE cm.class_id = cl.id
  AND cm.user_id = (SELECT id FROM auth.users WHERE email = 'anqiluo1997@gmail.com')
);

SELECT '✅ Student added to class' as status;

-- ============================================
-- STEP 6: Add mock students and submissions
-- ============================================

SELECT '=== STEP 6: Add Mock Students ===' as step;

-- Create mock students (one at a time to handle conflicts)
INSERT INTO profiles (id, email, full_name, created_at)
SELECT '11111111-1111-1111-1111-111111111111'::uuid, 'sarah.chen@student.com', 'Sarah Chen', NOW()
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = '11111111-1111-1111-1111-111111111111');

INSERT INTO profiles (id, email, full_name, created_at)
SELECT '22222222-2222-2222-2222-222222222222'::uuid, 'mike.johnson@student.com', 'Mike Johnson', NOW()
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = '22222222-2222-2222-2222-222222222222');

INSERT INTO profiles (id, email, full_name, created_at)
SELECT '33333333-3333-3333-3333-333333333333'::uuid, 'emma.davis@student.com', 'Emma Davis', NOW()
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = '33333333-3333-3333-3333-333333333333');

INSERT INTO profiles (id, email, full_name, created_at)
SELECT '44444444-4444-4444-4444-444444444444'::uuid, 'alex.wong@student.com', 'Alex Wong', NOW()
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = '44444444-4444-4444-4444-444444444444');

-- Add mock students to class
INSERT INTO class_members (class_id, user_id, role_id, joined_at)
SELECT 
  cl.id,
  p.id,
  (SELECT id FROM roles WHERE name = 'student'),
  NOW()
FROM classes cl
CROSS JOIN profiles p
WHERE cl.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
AND p.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
)
AND NOT EXISTS (
  SELECT 1 FROM class_members cm
  WHERE cm.class_id = cl.id AND cm.user_id = p.id
);

-- Add mock submissions
INSERT INTO challenge_submissions (challenge_id, user_id, content, submitted_at)
SELECT
  dc.id,
  '11111111-1111-1111-1111-111111111111',
  E'x = 5\n\nSteps:\n1. Start with: 2x + 5 = 15\n2. Subtract 5 from both sides: 2x = 10\n3. Divide both sides by 2: x = 5',
  NOW() - INTERVAL '15 minutes'
FROM daily_challenges dc
WHERE dc.challenge_date = CURRENT_DATE
AND dc.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
AND NOT EXISTS (
  SELECT 1 FROM challenge_submissions cs
  WHERE cs.challenge_id = dc.id AND cs.user_id = '11111111-1111-1111-1111-111111111111'
);

INSERT INTO challenge_submissions (challenge_id, user_id, content, submitted_at)
SELECT
  dc.id,
  '22222222-2222-2222-2222-222222222222',
  E'The answer is x = 5.\n\n2x + 5 = 15\n2x = 10\nx = 5',
  NOW() - INTERVAL '22 minutes'
FROM daily_challenges dc
WHERE dc.challenge_date = CURRENT_DATE
AND dc.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
AND NOT EXISTS (
  SELECT 1 FROM challenge_submissions cs
  WHERE cs.challenge_id = dc.id AND cs.user_id = '22222222-2222-2222-2222-222222222222'
);

INSERT INTO challenge_submissions (challenge_id, user_id, content, submitted_at)
SELECT
  dc.id,
  '33333333-3333-3333-3333-333333333333',
  E'x = 5\n\nI used algebra to solve!',
  NOW() - INTERVAL '8 minutes'
FROM daily_challenges dc
WHERE dc.challenge_date = CURRENT_DATE
AND dc.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
AND NOT EXISTS (
  SELECT 1 FROM challenge_submissions cs
  WHERE cs.challenge_id = dc.id AND cs.user_id = '33333333-3333-3333-3333-333333333333'
);

SELECT '✅ Mock students and submissions added' as status;

-- ============================================
-- STEP 7: Verify everything
-- ============================================

SELECT '=== STEP 7: Verification ===' as step;

SELECT 'Student is in these classes:' as info;
SELECT 
  cl.name as class_name,
  cm.joined_at
FROM class_members cm
JOIN classes cl ON cm.class_id = cl.id
WHERE cm.user_id = (SELECT id FROM auth.users WHERE email = 'anqiluo1997@gmail.com');

SELECT 'Challenges available to student:' as info;
SELECT 
  dc.title,
  dc.challenge_date,
  (SELECT COUNT(*) FROM challenge_submissions WHERE challenge_id = dc.id) as submission_count
FROM daily_challenges dc
JOIN challenge_assignments ca ON dc.id = ca.challenge_id
JOIN class_members cm ON ca.class_id = cm.class_id
WHERE cm.user_id = (SELECT id FROM auth.users WHERE email = 'anqiluo1997@gmail.com')
ORDER BY dc.challenge_date DESC;

SELECT '=== ✅ SETUP COMPLETE! ===' as final_status;
SELECT 'Now refresh http://localhost:3000/challenges as student' as next_step;
