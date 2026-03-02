-- Enroll Sarah and Mike in the Math 101 - Test Class

-- Check current state
SELECT '=== CURRENT CLASSES ===' as section;
SELECT id, name, created_by FROM classes ORDER BY created_at DESC;

SELECT '=== CURRENT CLASS MEMBERS ===' as section;
SELECT 
  cm.class_id,
  c.name as class_name,
  u.email as student_email
FROM class_members cm
JOIN classes c ON c.id = cm.class_id
JOIN auth.users u ON u.id = cm.user_id
ORDER BY c.name, u.email;

-- Get the Math 101 class ID
DO $$
DECLARE
  v_class_id UUID;
  v_sarah_id UUID;
  v_mike_id UUID;
  v_student_role_id UUID;
BEGIN
  -- Get class ID
  SELECT id INTO v_class_id
  FROM classes
  WHERE name = 'Math 101 - Test Class'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'Math 101 - Test Class not found!';
  END IF;

  RAISE NOTICE 'Class ID: %', v_class_id;

  -- Get student IDs
  SELECT id INTO v_sarah_id FROM auth.users WHERE email = 'sarah@test.com';
  SELECT id INTO v_mike_id FROM auth.users WHERE email = 'mike@test.com';

  IF v_sarah_id IS NULL OR v_mike_id IS NULL THEN
    RAISE EXCEPTION 'Sarah or Mike not found!';
  END IF;

  -- Get student role ID
  SELECT id INTO v_student_role_id FROM roles WHERE name = 'student';

  -- Clear old enrollments for these students
  DELETE FROM class_members WHERE user_id IN (v_sarah_id, v_mike_id);

  -- Enroll Sarah and Mike
  INSERT INTO class_members (class_id, user_id, role_id, joined_at) VALUES
    (v_class_id, v_sarah_id, v_student_role_id, NOW()),
    (v_class_id, v_mike_id, v_student_role_id, NOW());

  RAISE NOTICE '✅ Sarah and Mike enrolled!';
END $$;

-- Verify
SELECT '=== AFTER ENROLLMENT ===' as section;
SELECT 
  c.name as class_name,
  u.email as student_email,
  cm.joined_at
FROM class_members cm
JOIN classes c ON c.id = cm.class_id
JOIN auth.users u ON u.id = cm.user_id
WHERE c.name = 'Math 101 - Test Class'
ORDER BY u.email;

SELECT '✅ Students enrolled! Refresh the challenge page' as result;
