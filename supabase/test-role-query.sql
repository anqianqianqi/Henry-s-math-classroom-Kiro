-- Test Role Query
-- Run this to verify the teacher role is properly assigned

-- Check user_roles table directly
SELECT 
  ur.id,
  ur.user_id,
  ur.role_id,
  ur.class_id,
  r.name as role_name
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id IN (
  SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com'
);

-- Check what the Supabase client query would return
SELECT 
  user_roles.id,
  user_roles.user_id,
  user_roles.role_id,
  user_roles.class_id,
  roles.name
FROM user_roles
INNER JOIN roles ON user_roles.role_id = roles.id
WHERE user_roles.user_id = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
  AND user_roles.class_id IS NULL;
