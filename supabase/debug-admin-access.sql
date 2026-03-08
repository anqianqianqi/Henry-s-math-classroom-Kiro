-- Debug admin access
-- Run this while logged in as admin@test.com

-- 1. Check if you're logged in
SELECT auth.uid() as my_user_id, auth.email() as my_email;

-- 2. Check if admin role is assigned
SELECT 
  p.email,
  r.name as role,
  ur.class_id
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE p.email = 'admin@test.com';

-- 3. Check if the admin policy exists
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'daily_challenges'
  AND policyname LIKE '%dministrator%';

-- 4. Test the admin check directly
SELECT EXISTS (
  SELECT 1 FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = auth.uid()
    AND r.name = 'administrator'
    AND ur.class_id IS NULL
) as is_admin;

-- 5. Count total challenges in database
SELECT COUNT(*) as total_challenges FROM daily_challenges;

-- 6. Try to select challenges (should work if admin)
SELECT id, title, challenge_date 
FROM daily_challenges 
ORDER BY challenge_date DESC 
LIMIT 5;
