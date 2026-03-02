-- FIX: Update the class to be owned by the correct teacher account

-- Show current state
SELECT '=== BEFORE FIX ===' as status;
SELECT 
  c.id,
  c.name,
  c.created_by as old_creator_id,
  u.email as old_creator_email
FROM classes c
LEFT JOIN auth.users u ON u.id = c.created_by
WHERE c.name = 'Math 101 - Test Class';

-- Get the correct teacher ID
SELECT '=== TEACHER ACCOUNT ===' as status;
SELECT id, email FROM auth.users WHERE email = 'anqiluo@amazon.com';

-- Update the class to be owned by anqiluo@amazon.com
UPDATE classes
SET created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
WHERE id = '91d62665-2020-4757-8c3f-33b5281a8abb';

-- Also update challenge_assignments
UPDATE challenge_assignments
SET assigned_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
WHERE class_id = '91d62665-2020-4757-8c3f-33b5281a8abb';

-- Also update daily_challenges
UPDATE daily_challenges
SET created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
WHERE created_by = 'e3288fe6-0391-4870-8003-07928489c188';

-- Show result
SELECT '=== AFTER FIX ===' as status;
SELECT 
  c.id,
  c.name,
  c.created_by as new_creator_id,
  u.email as new_creator_email
FROM classes c
LEFT JOIN auth.users u ON u.id = c.created_by
WHERE c.name = 'Math 101 - Test Class';

SELECT '✅ FIXED! Now refresh /classes and /challenges/new' as result;
