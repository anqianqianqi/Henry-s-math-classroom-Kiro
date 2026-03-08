-- Create Administrator Account
-- Email: admin@test.com
-- Password: admin123 (change this after first login!)

-- Step 1: Create the auth user
-- NOTE: You need to do this in the Supabase Dashboard > Authentication > Users
-- Click "Add User" and create:
-- Email: admin@test.com
-- Password: admin123
-- Auto Confirm User: YES

-- Step 2: After creating the user in the dashboard, run this SQL to assign the role

-- First, check if the profile was created (should happen automatically via trigger)
SELECT id, email, full_name 
FROM profiles 
WHERE email = 'admin@test.com';

-- If profile doesn't exist, create it manually:
-- INSERT INTO profiles (id, email, full_name)
-- SELECT id, email, 'Administrator'
-- FROM auth.users
-- WHERE email = 'admin@test.com'
-- ON CONFLICT (id) DO NOTHING;

-- Step 3: Assign administrator role
INSERT INTO user_roles (user_id, role_id, class_id)
SELECT p.id, r.id, NULL
FROM profiles p
CROSS JOIN roles r
WHERE p.email = 'admin@test.com'
  AND r.name = 'administrator'
ON CONFLICT DO NOTHING;

-- Step 4: Verify the administrator role was assigned
SELECT 
  p.email,
  p.full_name,
  r.name as role,
  r.description
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE p.email = 'admin@test.com';

-- Expected result:
-- email: admin@test.com
-- role: administrator
-- description: System administrator with full access
