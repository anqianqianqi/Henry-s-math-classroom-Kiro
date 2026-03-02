-- Create Test Accounts for Development
-- One teacher account and one student account

-- ============================================
-- IMPORTANT: Run this in Supabase SQL Editor
-- ============================================

-- Note: These are test accounts for development only
-- Passwords: "password123" for both accounts

-- ============================================
-- 1. Create Teacher Account
-- ============================================

-- Insert teacher profile
INSERT INTO profiles (id, email, full_name, created_at)
VALUES (
  'teacher-test-1111-1111-111111111111',
  'teacher@test.com',
  'Henry Teacher',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Assign teacher role (global)
INSERT INTO user_roles (user_id, role_id, class_id)
VALUES (
  'teacher-test-1111-1111-111111111111',
  (SELECT id FROM roles WHERE name = 'teacher'),
  NULL  -- NULL means global teacher role
)
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. Create Student Account
-- ============================================

-- Insert student profile
INSERT INTO profiles (id, email, full_name, created_at)
VALUES (
  'student-test-2222-2222-222222222222',
  'student@test.com',
  'Alex Student',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Assign student role (global)
INSERT INTO user_roles (user_id, role_id, class_id)
VALUES (
  'student-test-2222-2222-222222222222',
  (SELECT id FROM roles WHERE name = 'student'),
  NULL  -- NULL means global student role
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Verification
-- ============================================

-- Check created accounts
SELECT 
  p.id,
  p.email,
  p.full_name,
  r.name as role
FROM profiles p
LEFT JOIN user_roles ur ON p.id = ur.user_id AND ur.class_id IS NULL
LEFT JOIN roles r ON ur.role_id = r.id
WHERE p.email IN ('teacher@test.com', 'student@test.com')
ORDER BY p.email;

-- Success message
SELECT '✅ Test accounts created!' as status;
SELECT '' as info;
SELECT 'Teacher Account:' as info;
SELECT '  Email: teacher@test.com' as info;
SELECT '  Password: (set via Supabase Auth)' as info;
SELECT '' as info;
SELECT 'Student Account:' as info;
SELECT '  Email: student@test.com' as info;
SELECT '  Password: (set via Supabase Auth)' as info;
SELECT '' as info;
SELECT '⚠️  IMPORTANT: You need to create these users in Supabase Auth!' as warning;
SELECT 'Go to: Authentication → Users → Add User' as next_step;
