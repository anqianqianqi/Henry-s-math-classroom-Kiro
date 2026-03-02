-- Check and Fix Test User Profiles

-- Check which users exist
SELECT '=== Auth Users ===' as status;
SELECT id, email, created_at, email_confirmed_at
FROM auth.users 
WHERE email IN ('sarah@test.com', 'mike@test.com', 'emma@test.com', 'alex@test.com')
ORDER BY email;

-- Check which profiles exist
SELECT '=== Profiles ===' as status;
SELECT id, email, full_name
FROM profiles 
WHERE email IN ('sarah@test.com', 'mike@test.com', 'emma@test.com', 'alex@test.com')
ORDER BY email;

-- Create missing profiles
INSERT INTO profiles (id, email, full_name, created_at)
SELECT 
  au.id,
  au.email,
  CASE 
    WHEN au.email = 'sarah@test.com' THEN 'Sarah Chen'
    WHEN au.email = 'mike@test.com' THEN 'Mike Johnson'
    WHEN au.email = 'emma@test.com' THEN 'Emma Davis'
    WHEN au.email = 'alex@test.com' THEN 'Alex Wong'
  END,
  au.created_at
FROM auth.users au
WHERE au.email IN ('sarah@test.com', 'mike@test.com', 'emma@test.com', 'alex@test.com')
AND NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = au.id
);

-- Assign student role to all test users
INSERT INTO user_roles (user_id, role_id, class_id)
SELECT 
  au.id,
  (SELECT id FROM roles WHERE name = 'student'),
  NULL
FROM auth.users au
WHERE au.email IN ('sarah@test.com', 'mike@test.com', 'emma@test.com', 'alex@test.com')
ON CONFLICT DO NOTHING;

-- Verify fix
SELECT '=== After Fix ===' as status;
SELECT 
  au.email,
  p.full_name,
  CASE WHEN p.id IS NOT NULL THEN '✅ Profile exists' ELSE '❌ No profile' END as profile_status,
  CASE WHEN ur.id IS NOT NULL THEN '✅ Has role' ELSE '❌ No role' END as role_status
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
LEFT JOIN user_roles ur ON au.id = ur.user_id AND ur.class_id IS NULL
WHERE au.email IN ('sarah@test.com', 'mike@test.com', 'emma@test.com', 'alex@test.com')
ORDER BY au.email;

SELECT '✅ All test users should now be able to login!' as result;
