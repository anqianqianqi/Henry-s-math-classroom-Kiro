-- Fix: Ensure teacher can see their classes
-- This checks if classes exist and shows what's wrong

DO $$
DECLARE
  v_teacher_id UUID;
  v_class_count INTEGER;
  v_teacher_role_id UUID;
BEGIN
  -- Get teacher ID
  SELECT id INTO v_teacher_id
  FROM auth.users
  WHERE email = 'anqiluo@amazon.com';

  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Teacher account (anqiluo@amazon.com) not found!';
  END IF;

  RAISE NOTICE 'Teacher ID: %', v_teacher_id;

  -- Check how many classes exist for this teacher
  SELECT COUNT(*) INTO v_class_count
  FROM classes
  WHERE created_by = v_teacher_id;

  RAISE NOTICE 'Classes created by teacher: %', v_class_count;

  -- Get teacher role ID
  SELECT id INTO v_teacher_role_id
  FROM roles
  WHERE name = 'teacher';

  -- If no classes exist, create one
  IF v_class_count = 0 THEN
    RAISE NOTICE 'No classes found. Creating test class...';
    
    INSERT INTO classes (
      name,
      description,
      schedule,
      start_date,
      end_date,
      created_by,
      is_active
    ) VALUES (
      'Math 101 - Test Class',
      'A test class for daily challenges',
      'Mon/Wed/Fri 10:00 AM - 11:30 AM',
      '2026-03-01',
      '2026-06-30',
      v_teacher_id,
      true
    );

    RAISE NOTICE '✅ Created test class';
  ELSE
    RAISE NOTICE '✅ Classes already exist';
  END IF;

  -- Ensure teacher has global teacher role
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = v_teacher_id
    AND role_id = v_teacher_role_id
    AND class_id IS NULL
  ) THEN
    RAISE NOTICE 'Adding global teacher role...';
    
    INSERT INTO user_roles (user_id, role_id, class_id)
    VALUES (v_teacher_id, v_teacher_role_id, NULL)
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE '✅ Added teacher role';
  ELSE
    RAISE NOTICE '✅ Teacher role already exists';
  END IF;

END $$;

-- Show final status
SELECT '=== TEACHER CLASSES ===' as section;
SELECT 
  c.id,
  c.name,
  c.is_active,
  c.created_at,
  (SELECT COUNT(*) FROM class_members WHERE class_id = c.id) as student_count
FROM classes c
WHERE c.created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com')
ORDER BY c.created_at DESC;

SELECT '=== TEACHER ROLES ===' as section;
SELECT 
  r.name as role_name,
  CASE WHEN ur.class_id IS NULL THEN 'Global' ELSE 'Class-specific' END as scope
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com');

SELECT '=== NEXT STEPS ===' as section;
SELECT 'Login as anqiluo@amazon.com and go to /challenges/new' as instruction
UNION ALL
SELECT 'You should now see your classes in the list';
