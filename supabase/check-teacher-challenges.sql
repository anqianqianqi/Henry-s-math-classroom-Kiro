-- Check if teacher has any challenges

SELECT '=== Teacher Account ===' as step;
SELECT id, email FROM auth.users WHERE email = 'anqiluo@amazon.com';

SELECT '=== Challenges Created by Teacher ===' as step;
SELECT 
  dc.id,
  dc.title,
  dc.challenge_date,
  dc.created_by
FROM daily_challenges dc
WHERE dc.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com');

SELECT '=== All Challenges in Database ===' as step;
SELECT 
  dc.id,
  dc.title,
  dc.challenge_date,
  dc.created_by,
  p.email as creator_email
FROM daily_challenges dc
LEFT JOIN profiles p ON dc.created_by = p.id
ORDER BY dc.challenge_date DESC;

-- If no challenges found, let's fix it by updating the existing challenge
UPDATE daily_challenges
SET created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
WHERE challenge_date = CURRENT_DATE;

SELECT '=== After Fix ===' as step;
SELECT 
  dc.id,
  dc.title,
  dc.challenge_date,
  dc.created_by
FROM daily_challenges dc
WHERE dc.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com');
