-- Add student anqiluo1997@gmail.com to classes
-- This will allow them to see challenges

-- First, let's check what we have
SELECT 'Current Classes:' as info;
SELECT id, name, created_by 
FROM classes 
WHERE created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
ORDER BY created_at DESC;

SELECT '' as spacer;
SELECT 'Student Account:' as info;
SELECT id, email, full_name 
FROM profiles 
WHERE email = 'anqiluo1997@gmail.com';

-- Add student to ALL classes created by teacher
INSERT INTO class_members (class_id, user_id, role_id, joined_at)
SELECT 
  cl.id,
  (SELECT id FROM auth.users WHERE email = 'anqiluo1997@gmail.com'),
  (SELECT id FROM roles WHERE name = 'student'),
  NOW()
FROM classes cl
WHERE cl.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
AND NOT EXISTS (
  SELECT 1 FROM class_members cm
  WHERE cm.class_id = cl.id
  AND cm.user_id = (SELECT id FROM auth.users WHERE email = 'anqiluo1997@gmail.com')
);

-- Verify the student was added
SELECT '' as spacer;
SELECT '✅ Student added to classes!' as status;
SELECT '' as spacer;
SELECT 'Verification:' as info;
SELECT 
  cl.name as class_name,
  p.full_name as student_name,
  p.email as student_email,
  cm.joined_at
FROM class_members cm
JOIN classes cl ON cm.class_id = cl.id
JOIN profiles p ON cm.user_id = p.id
WHERE p.email = 'anqiluo1997@gmail.com';

-- Check what challenges they should now see
SELECT '' as spacer;
SELECT 'Challenges available to this student:' as info;
SELECT 
  dc.title,
  dc.challenge_date,
  cl.name as assigned_to_class
FROM daily_challenges dc
JOIN challenge_assignments ca ON dc.id = ca.challenge_id
JOIN classes cl ON ca.class_id = cl.id
JOIN class_members cm ON cl.id = cm.class_id
WHERE cm.user_id = (SELECT id FROM auth.users WHERE email = 'anqiluo1997@gmail.com')
ORDER BY dc.challenge_date DESC;
