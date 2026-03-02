-- Complete debug: Find out exactly what's wrong

-- 1. Get teacher user ID
SELECT '=== 1. TEACHER USER ID ===' as step;
SELECT id, email, created_at FROM auth.users WHERE email = 'anqiluo@amazon.com';

-- 2. Check ALL classes (no filter)
SELECT '=== 2. ALL CLASSES IN DATABASE ===' as step;
SELECT id, name, created_by, is_active, created_at FROM classes ORDER BY created_at DESC;

-- 3. Check classes with teacher as creator
SELECT '=== 3. CLASSES WHERE CREATED_BY = TEACHER ===' as step;
SELECT 
  c.id,
  c.name,
  c.created_by,
  c.is_active,
  c.created_at
FROM classes c
WHERE c.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com');

-- 4. Check if there's a mismatch
SELECT '=== 4. CHECKING FOR MISMATCH ===' as step;
SELECT 
  'Teacher ID' as field,
  id::text as value
FROM auth.users 
WHERE email = 'anqiluo@amazon.com'
UNION ALL
SELECT 
  'Class created_by' as field,
  created_by::text as value
FROM classes
WHERE name LIKE '%Test%'
LIMIT 1;

-- 5. Check RLS policies on classes table
SELECT '=== 5. RLS POLICIES ON CLASSES ===' as step;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'classes';

-- 6. Test if we can SELECT from classes as authenticated user
SELECT '=== 6. CAN WE READ CLASSES? ===' as step;
SELECT COUNT(*) as total_classes FROM classes;
SELECT COUNT(*) as active_classes FROM classes WHERE is_active = true;

-- 7. Show what the frontend query should return
SELECT '=== 7. FRONTEND QUERY SIMULATION ===' as step;
-- This is what the frontend tries to do:
SELECT id, name, created_by, is_active
FROM classes
WHERE created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
AND is_active = true
ORDER BY name;
