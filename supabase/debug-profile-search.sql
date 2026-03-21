-- Debug Profile Search Issue
-- Run these queries to diagnose why search by name isn't working

-- 1. Check what RLS policies exist on profiles table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 2. Check if you're a teacher (have created classes)
SELECT 
  id,
  name,
  created_by,
  created_at
FROM classes
WHERE created_by = auth.uid()
LIMIT 5;

-- 3. Check your user roles
SELECT 
  ur.id,
  r.name as role_name,
  ur.class_id,
  ur.created_at
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = auth.uid();

-- 4. Try to search profiles directly (this will show if RLS is blocking)
SELECT 
  id,
  full_name,
  email,
  created_at
FROM profiles
WHERE full_name ILIKE '%test%'
LIMIT 10;

-- 5. Check if the new policy exists
SELECT COUNT(*) as policy_exists
FROM pg_policies 
WHERE tablename = 'profiles' 
  AND policyname = 'Teachers can search all profiles';
