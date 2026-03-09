-- =====================================================
-- Enroll Test Students in Algebra 1 Class
-- =====================================================

-- Enroll sarah@test.com in Algebra 1
INSERT INTO class_members (class_id, user_id, role)
SELECT 
  c.id,
  (SELECT id FROM auth.users WHERE email = 'sarah@test.com'),
  'student'
FROM classes c
WHERE c.name LIKE '%Algebra%'
ON CONFLICT (class_id, user_id) DO NOTHING;

-- Enroll mike@test.com in Algebra 1
INSERT INTO class_members (class_id, user_id, role)
SELECT 
  c.id,
  (SELECT id FROM auth.users WHERE email = 'mike@test.com'),
  'student'
FROM classes c
WHERE c.name LIKE '%Algebra%'
ON CONFLICT (class_id, user_id) DO NOTHING;

-- Verify enrollments
SELECT 
  c.name as class_name,
  p.full_name,
  p.email,
  cm.role,
  cm.enrolled_at
FROM class_members cm
JOIN profiles p ON p.id = cm.user_id
JOIN classes c ON c.id = cm.class_id
WHERE c.name LIKE '%Algebra%'
ORDER BY cm.role, p.full_name;

\echo ''
\echo '✅ Students enrolled in Algebra 1 class'
\echo ''
