-- Mock Data for Daily Challenge Testing
-- Run this AFTER you have created at least one class
-- This will automatically use your teacher account (anqiluo@amazon.com)

-- IMPORTANT: Make sure you have created at least one class first!
-- Go to http://localhost:3000/classes/new and create a class

-- ============================================
-- Create Mock Students (for testing)
-- ============================================

-- Insert mock student profiles
INSERT INTO profiles (id, email, full_name, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'sarah.chen@student.com', 'Sarah Chen', NOW() - INTERVAL '30 days'),
  ('22222222-2222-2222-2222-222222222222', 'mike.johnson@student.com', 'Mike Johnson', NOW() - INTERVAL '25 days'),
  ('33333333-3333-3333-3333-333333333333', 'emma.davis@student.com', 'Emma Davis', NOW() - INTERVAL '20 days'),
  ('44444444-4444-4444-4444-444444444444', 'alex.wong@student.com', 'Alex Wong', NOW() - INTERVAL '15 days'),
  ('55555555-5555-5555-5555-555555555555', 'lisa.martinez@student.com', 'Lisa Martinez', NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

-- Assign student role to mock students
INSERT INTO user_roles (user_id, role_id, class_id)
SELECT 
  p.id,
  (SELECT id FROM roles WHERE name = 'student'),
  NULL
FROM profiles p
WHERE p.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
)
ON CONFLICT DO NOTHING;

-- Add mock students to all your classes
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
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
)
ON CONFLICT (class_id, user_id) DO NOTHING;

-- ============================================
-- Create Sample Challenges
-- ============================================

-- Today's challenge
INSERT INTO daily_challenges (id, created_by, title, description, challenge_date, created_at)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com'), -- Your teacher account
  'Solve for x: Linear Equation',
  E'Solve the following equation and show your work:\n\n2x + 5 = 15\n\nExplain each step of your solution.',
  CURRENT_DATE,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Yesterday's challenge
INSERT INTO daily_challenges (id, created_by, title, description, challenge_date, created_at)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com'),
  'Quadratic Formula Challenge',
  E'Solve using the quadratic formula:\n\nx² - 5x + 6 = 0\n\nShow all steps and identify the roots.',
  CURRENT_DATE - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- Tomorrow's challenge (for testing future dates)
INSERT INTO daily_challenges (id, created_by, title, description, challenge_date, created_at)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com'),
  'Pythagorean Theorem',
  E'A right triangle has legs of length 3 and 4.\n\nFind the length of the hypotenuse using the Pythagorean theorem.\n\nShow your calculation.',
  CURRENT_DATE + INTERVAL '1 day',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Assign Challenges to Classes
-- ============================================

-- Assign all challenges to ALL your classes
INSERT INTO challenge_assignments (challenge_id, class_id, assigned_by)
SELECT 
  c.id,
  cl.id,
  (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
FROM daily_challenges c
CROSS JOIN classes cl
WHERE c.id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
)
AND cl.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
ON CONFLICT (challenge_id, class_id) DO NOTHING;

-- ============================================
-- Create Mock Submissions (Today's Challenge)
-- ============================================

-- Sarah's submission
INSERT INTO challenge_submissions (challenge_id, user_id, content, submitted_at)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  E'x = 5\n\nSteps:\n1. Start with: 2x + 5 = 15\n2. Subtract 5 from both sides: 2x = 10\n3. Divide both sides by 2: x = 5\n\nCheck: 2(5) + 5 = 10 + 5 = 15 ✓',
  NOW() - INTERVAL '15 minutes'
)
ON CONFLICT (challenge_id, user_id) DO NOTHING;

-- Mike's submission
INSERT INTO challenge_submissions (challenge_id, user_id, content, submitted_at)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-222222222222',
  E'The answer is x = 5.\n\nMy work:\n2x + 5 = 15\n2x = 15 - 5\n2x = 10\nx = 10 ÷ 2\nx = 5\n\nI isolated the variable by doing inverse operations!',
  NOW() - INTERVAL '22 minutes'
)
ON CONFLICT (challenge_id, user_id) DO NOTHING;

-- Emma's submission
INSERT INTO challenge_submissions (challenge_id, user_id, content, submitted_at)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333',
  E'x = 5\n\nI used algebra to solve:\n• First, I subtracted 5 from both sides to get 2x = 10\n• Then I divided both sides by 2 to get x = 5\n• To verify: 2(5) + 5 = 15 which is correct!',
  NOW() - INTERVAL '8 minutes'
)
ON CONFLICT (challenge_id, user_id) DO NOTHING;

-- Alex's submission
INSERT INTO challenge_submissions (challenge_id, user_id, content, submitted_at)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '44444444-4444-4444-4444-444444444444',
  E'x = 5\n\nSolution:\n2x + 5 = 15\nSubtract 5: 2x = 10\nDivide by 2: x = 5',
  NOW() - INTERVAL '30 minutes'
)
ON CONFLICT (challenge_id, user_id) DO NOTHING;

-- ============================================
-- Create Mock Submissions (Yesterday's Challenge)
-- ============================================

INSERT INTO challenge_submissions (challenge_id, user_id, content, submitted_at)
VALUES 
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    E'Using the quadratic formula: x = (-b ± √(b²-4ac)) / 2a\n\nFor x² - 5x + 6 = 0:\na = 1, b = -5, c = 6\n\nx = (5 ± √(25-24)) / 2\nx = (5 ± 1) / 2\n\nSo x = 3 or x = 2',
    NOW() - INTERVAL '1 day' - INTERVAL '2 hours'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    E'The roots are x = 2 and x = 3\n\nI factored: (x-2)(x-3) = 0\nSo x = 2 or x = 3',
    NOW() - INTERVAL '1 day' - INTERVAL '3 hours'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '33333333-3333-3333-3333-333333333333',
    E'x = 2 or x = 3\n\nUsed quadratic formula and got the same answer as factoring!',
    NOW() - INTERVAL '1 day' - INTERVAL '1 hour'
  )
ON CONFLICT (challenge_id, user_id) DO NOTHING;

-- ============================================
-- Verification Queries
-- ============================================

-- Check challenges
SELECT 
  id,
  title,
  challenge_date,
  (SELECT COUNT(*) FROM challenge_submissions WHERE challenge_id = daily_challenges.id) as submission_count
FROM daily_challenges
ORDER BY challenge_date DESC;

-- Check today's submissions
SELECT 
  p.full_name,
  cs.content,
  cs.submitted_at
FROM challenge_submissions cs
JOIN profiles p ON cs.user_id = p.id
WHERE cs.challenge_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
ORDER BY cs.submitted_at DESC;

-- Success message
SELECT 'Mock data created successfully! 🎉' as status;
SELECT '- 3 challenges created (yesterday, today, tomorrow)' as info;
SELECT '- 5 mock students created' as info;
SELECT '- 4 submissions for today''s challenge' as info;
SELECT '- 3 submissions for yesterday''s challenge' as info;
SELECT '' as info;
SELECT 'Now you can test the "post to see others" feature!' as next_step;
