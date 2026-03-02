-- Check Alex's Account

SELECT '=== Alex in auth.users ===' as status;
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  encrypted_password IS NOT NULL as has_password
FROM auth.users 
WHERE email = 'alex@test.com';

SELECT '=== Alex profile ===' as status;
SELECT id, email, full_name
FROM profiles 
WHERE email = 'alex@test.com';

-- If Alex doesn't exist in auth.users, you need to create the account in Supabase Dashboard
-- Go to: Authentication → Users → Add User
-- Email: alex@test.com
-- Password: test123
-- Check "Auto Confirm User"
