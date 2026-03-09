-- Debug: Check if occurrences exist and RLS policies are working

-- 1. Check if class_occurrences table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'class_occurrences'
) as table_exists;

-- 2. Check if any occurrences exist (bypass RLS)
SELECT COUNT(*) as total_occurrences
FROM class_occurrences;

-- 3. Show all occurrences (bypass RLS)
SELECT 
  co.id,
  co.class_id,
  co.session_number,
  co.topic,
  co.occurrence_date,
  co.status,
  c.name as class_name
FROM class_occurrences co
LEFT JOIN classes c ON c.id = co.class_id
ORDER BY co.occurrence_date
LIMIT 10;

-- 4. Check RLS policies on class_occurrences
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'class_occurrences';

-- 5. Check if current user can see occurrences
SELECT 
  auth.uid() as current_user_id,
  auth.email() as current_user_email;

-- 6. Check class membership for current user
SELECT 
  cm.class_id,
  c.name as class_name,
  cm.user_id,
  p.email
FROM class_members cm
JOIN classes c ON c.id = cm.class_id
JOIN profiles p ON p.id = cm.user_id
WHERE cm.user_id = auth.uid();

-- 7. Try to select occurrences as current user (with RLS)
SELECT 
  co.id,
  co.class_id,
  co.session_number,
  co.topic,
  co.occurrence_date,
  co.status
FROM class_occurrences co
WHERE co.class_id IN (
  SELECT class_id FROM class_members WHERE user_id = auth.uid()
)
ORDER BY co.occurrence_date
LIMIT 10;

-- 8. Check if user is class creator
SELECT 
  c.id,
  c.name,
  c.created_by,
  c.created_by = auth.uid() as is_creator
FROM classes c
WHERE c.created_by = auth.uid()
ORDER BY c.created_at DESC
LIMIT 5;
