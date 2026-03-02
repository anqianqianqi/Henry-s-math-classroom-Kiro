-- Assign Teacher Role to a User
-- Run this in Supabase SQL Editor

-- ============================================
-- Step 1: Find your user ID
-- ============================================

-- Run this first to see all users and their current roles:
SELECT 
  p.id,
  p.email,
  p.full_name,
  COALESCE(
    (
      SELECT STRING_AGG(r.name, ', ')
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = p.id AND ur.class_id IS NULL
    ),
    'No roles'
  ) as current_roles
FROM profiles p
ORDER BY p.created_at DESC;

-- ============================================
-- Step 2: Assign teacher role
-- ============================================

-- Replace 'YOUR_EMAIL_HERE' with the email of the user you want to make a teacher
-- For example: 'teacher@test.com'

INSERT INTO user_roles (user_id, role_id, class_id)
SELECT 
  p.id,
  (SELECT id FROM roles WHERE name = 'teacher'),
  NULL
FROM profiles p
WHERE p.email = 'YOUR_EMAIL_HERE'  -- ← CHANGE THIS!
ON CONFLICT DO NOTHING;

-- ============================================
-- Step 3: Verify the role was assigned
-- ============================================

SELECT 
  p.email,
  p.full_name,
  r.name as role,
  'Successfully assigned!' as status
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE p.email = 'YOUR_EMAIL_HERE'  -- ← CHANGE THIS!
  AND ur.class_id IS NULL;

-- ============================================
-- Quick Commands (Copy & Paste)
-- ============================================

-- Make teacher@test.com a teacher:
/*
INSERT INTO user_roles (user_id, role_id, class_id)
SELECT p.id, (SELECT id FROM roles WHERE name = 'teacher'), NULL
FROM profiles p WHERE p.email = 'teacher@test.com'
ON CONFLICT DO NOTHING;
*/

-- Make your current account a teacher (replace with your email):
/*
INSERT INTO user_roles (user_id, role_id, class_id)
SELECT p.id, (SELECT id FROM roles WHERE name = 'teacher'), NULL
FROM profiles p WHERE p.email = 'your@email.com'
ON CONFLICT DO NOTHING;
*/
