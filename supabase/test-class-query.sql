-- Test the exact query used in the frontend
-- Replace the UUID with your teacher's user ID

-- First, get teacher ID
SELECT id, email FROM auth.users WHERE email = 'anqiluo@amazon.com';

-- Copy the ID from above and use it below (replace the placeholder)
-- This is the EXACT query the frontend uses:

SELECT id, name
FROM classes
WHERE created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
AND is_active = true
ORDER BY name;

-- If this returns results, the query works
-- If not, let's check what's different:

-- Check all classes (no filters)
SELECT id, name, created_by, is_active
FROM classes
ORDER BY created_at DESC;

-- Check if RLS is blocking
SET ROLE authenticated;
SET request.jwt.claims.sub TO (SELECT id::text FROM auth.users WHERE email = 'anqiluo@amazon.com');

SELECT id, name
FROM classes
WHERE created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
AND is_active = true
ORDER BY name;

RESET ROLE;
