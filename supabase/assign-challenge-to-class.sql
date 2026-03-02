-- Assign the challenge to Math 101 - Test Class

-- Show current state
SELECT '=== CHALLENGES ===' as section;
SELECT id, title, challenge_date, created_by FROM daily_challenges ORDER BY created_at DESC LIMIT 5;

SELECT '=== CLASSES ===' as section;
SELECT id, name FROM classes ORDER BY created_at DESC;

SELECT '=== CURRENT ASSIGNMENTS ===' as section;
SELECT 
  dc.title as challenge,
  c.name as class_name
FROM challenge_assignments ca
JOIN daily_challenges dc ON dc.id = ca.challenge_id
JOIN classes c ON c.id = ca.class_id;

-- Assign the latest challenge to Math 101
INSERT INTO challenge_assignments (challenge_id, class_id, assigned_by)
SELECT 
  dc.id,
  c.id,
  dc.created_by
FROM daily_challenges dc
CROSS JOIN classes c
WHERE c.name = 'Math 101 - Test Class'
AND dc.id = 'f04bda8e-ab6e-4fd6-918b-b721e5bcde91'  -- Your challenge ID from console
ON CONFLICT DO NOTHING;

-- Verify
SELECT '=== AFTER ASSIGNMENT ===' as section;
SELECT 
  dc.title as challenge,
  c.name as class_name,
  (SELECT COUNT(*) FROM class_members WHERE class_id = c.id) as student_count
FROM challenge_assignments ca
JOIN daily_challenges dc ON dc.id = ca.challenge_id
JOIN classes c ON c.id = ca.class_id
WHERE dc.id = 'f04bda8e-ab6e-4fd6-918b-b721e5bcde91';

SELECT '✅ Challenge assigned! Refresh the page' as result;
