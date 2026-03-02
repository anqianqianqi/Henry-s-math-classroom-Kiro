-- Cleanup Mock/Fake Data
-- This removes submissions and profiles from fake users (not real test accounts)

-- First, let's see what we have
SELECT '=== Current Submissions ===' as status;
SELECT 
  cs.id,
  p.email,
  p.full_name,
  LEFT(cs.content, 40) as preview,
  CASE 
    WHEN au.id IS NULL THEN '❌ FAKE (no auth user)'
    ELSE '✅ REAL'
  END as user_type
FROM challenge_submissions cs
JOIN profiles p ON cs.user_id = p.id
LEFT JOIN auth.users au ON p.id = au.id
ORDER BY cs.submitted_at DESC;

-- Delete submissions from fake users (users without auth.users entry)
DELETE FROM challenge_submissions
WHERE user_id IN (
  SELECT p.id 
  FROM profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  WHERE au.id IS NULL
);

-- Delete fake profiles (profiles without auth.users entry)
DELETE FROM profiles
WHERE id NOT IN (
  SELECT id FROM auth.users
);

-- Delete fake class members
DELETE FROM class_members
WHERE user_id NOT IN (
  SELECT id FROM auth.users
);

-- Verify cleanup
SELECT '=== After Cleanup ===' as status;

SELECT 'Remaining Submissions:' as info;
SELECT 
  p.email,
  p.full_name,
  COUNT(*) as submission_count
FROM challenge_submissions cs
JOIN profiles p ON cs.user_id = p.id
GROUP BY p.email, p.full_name
ORDER BY p.email;

SELECT 'Remaining Profiles:' as info;
SELECT email, full_name
FROM profiles
ORDER BY email;

SELECT 'Class Members:' as info;
SELECT 
  p.email,
  p.full_name,
  cl.name as class_name
FROM class_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN classes cl ON cm.class_id = cl.id
ORDER BY p.email;

SELECT '✅ Cleanup complete! Only real test users remain.' as result;
