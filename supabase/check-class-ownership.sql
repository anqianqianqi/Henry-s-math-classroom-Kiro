-- Check who created the classes and verify teacher can see them

-- 1. Check all classes
SELECT 
  c.id,
  c.name,
  c.created_by,
  c.is_active,
  u.email as creator_email,
  c.created_at
FROM classes c
LEFT JOIN auth.users u ON u.id = c.created_by
ORDER BY c.created_at DESC;

-- 2. Check teacher account
SELECT 
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name
FROM auth.users 
WHERE email = 'anqiluo@amazon.com';

-- 3. Check if teacher has teacher role
SELECT 
  ur.user_id,
  u.email,
  r.name as role_name,
  ur.class_id
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
JOIN roles r ON r.id = ur.role_id
WHERE u.email = 'anqiluo@amazon.com';

-- 4. Check class members
SELECT 
  cl.name as class_name,
  u.email as member_email,
  r.name as role_name,
  cm.joined_at
FROM class_members cm
JOIN classes cl ON cl.id = cm.class_id
JOIN auth.users u ON u.id = cm.user_id
JOIN roles r ON r.id = cm.role_id
ORDER BY cl.name, cm.joined_at;

-- 5. Check challenge assignments
SELECT 
  dc.title as challenge_title,
  dc.challenge_date,
  cl.name as assigned_to_class,
  u.email as assigned_by
FROM challenge_assignments ca
JOIN daily_challenges dc ON dc.id = ca.challenge_id
JOIN classes cl ON cl.id = ca.class_id
JOIN auth.users u ON u.id = ca.assigned_by
ORDER BY dc.challenge_date DESC;
