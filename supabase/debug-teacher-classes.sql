-- Debug: Check teacher's classes
-- Replace with your teacher user ID

-- 1. Check user ID for teacher account
SELECT id, email FROM auth.users WHERE email = 'anqiluo@amazon.com';

-- 2. Check classes created by this user (replace UUID with result from above)
SELECT id, name, created_by, is_active, created_at 
FROM classes 
WHERE created_by = '04b7f0d1-06a2-4235-b7a7-476dc83dfd15'  -- Replace with actual user ID
ORDER BY created_at DESC;

-- 3. Check all classes (to see if any exist)
SELECT id, name, created_by, is_active, created_at 
FROM classes 
ORDER BY created_at DESC;

-- 4. Check if teacher has teacher role
SELECT ur.*, r.name as role_name
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = '04b7f0d1-06a2-4235-b7a7-476dc83dfd15';  -- Replace with actual user ID
