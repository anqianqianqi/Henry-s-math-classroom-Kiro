-- Fix: Update class created_by to match the actual teacher account
-- This is likely the issue - the class was created with a different user ID

-- Step 1: Check current state
SELECT '=== CURRENT STATE ===' as section;

SELECT 'Teacher account:' as info;
SELECT id, email FROM auth.users WHERE email = 'anqiluo@amazon.com';

SELECT 'Classes and their creators:' as info;
SELECT 
  c.id,
  c.name,
  c.created_by,
  u.email as creator_email
FROM classes c
LEFT JOIN auth.users u ON u.id = c.created_by
ORDER BY c.created_at DESC;

-- Step 2: Fix the created_by field
SELECT '=== FIXING CREATED_BY ===' as section;

UPDATE classes
SET created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
WHERE name = 'Math 101 - Test Class'
OR name LIKE '%Test%';

-- Step 3: Verify the fix
SELECT '=== AFTER FIX ===' as section;

SELECT 
  c.id,
  c.name,
  c.created_by,
  u.email as creator_email,
  c.is_active
FROM classes c
LEFT JOIN auth.users u ON u.id = c.created_by
WHERE u.email = 'anqiluo@amazon.com'
ORDER BY c.created_at DESC;

SELECT '✅ Classes should now appear in /challenges/new' as result;
