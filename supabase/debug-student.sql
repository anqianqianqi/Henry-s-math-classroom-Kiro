-- Debug: Check why student can't see challenges

SELECT '=== 1. Check student user exists ===' as step;
SELECT id, email FROM auth.users WHERE email = 'anqiluo1997@gmail.com';

SELECT '=== 2. Check student profile exists ===' as step;
SELECT id, email, full_name FROM profiles WHERE email = 'anqiluo1997@gmail.com';

SELECT '=== 3. Check classes exist ===' as step;
SELECT id, name, created_by FROM classes;

SELECT '=== 4. Check student class membership ===' as step;
SELECT 
  cm.id,
  cm.class_id,
  cm.user_id,
  cl.name as class_name
FROM class_members cm
JOIN classes cl ON cm.class_id = cl.id
WHERE cm.user_id = (SELECT id FROM auth.users WHERE email = 'anqiluo1997@gmail.com');

SELECT '=== 5. Check challenges exist ===' as step;
SELECT id, title, challenge_date, created_by FROM daily_challenges;

SELECT '=== 6. Check challenge assignments ===' as step;
SELECT 
  ca.challenge_id,
  ca.class_id,
  dc.title as challenge_title,
  cl.name as class_name
FROM challenge_assignments ca
JOIN daily_challenges dc ON ca.challenge_id = dc.id
JOIN classes cl ON ca.class_id = cl.id;

SELECT '=== 7. Final check: What should student see? ===' as step;
SELECT 
  dc.id as challenge_id,
  dc.title,
  dc.challenge_date,
  cl.name as class_name
FROM daily_challenges dc
JOIN challenge_assignments ca ON dc.id = ca.challenge_id
JOIN classes cl ON ca.class_id = cl.id
JOIN class_members cm ON cl.id = cm.class_id
WHERE cm.user_id = (SELECT id FROM auth.users WHERE email = 'anqiluo1997@gmail.com')
ORDER BY dc.challenge_date DESC;
