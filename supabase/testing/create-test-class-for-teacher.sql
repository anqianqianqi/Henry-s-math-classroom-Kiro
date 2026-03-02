-- Create a test class for the teacher account
-- This will help test the challenge creation flow

-- First, get the teacher's user ID
DO $$
DECLARE
  v_teacher_id UUID;
  v_class_id UUID;
  v_teacher_role_id UUID;
BEGIN
  -- Get teacher user ID (anqiluo@amazon.com)
  SELECT id INTO v_teacher_id
  FROM auth.users
  WHERE email = 'anqiluo@amazon.com';

  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Teacher account not found. Please sign up first.';
  END IF;

  RAISE NOTICE 'Teacher ID: %', v_teacher_id;

  -- Check if teacher already has classes
  IF EXISTS (SELECT 1 FROM classes WHERE created_by = v_teacher_id) THEN
    RAISE NOTICE 'Teacher already has classes:';
    FOR v_class_id IN 
      SELECT id FROM classes WHERE created_by = v_teacher_id
    LOOP
      RAISE NOTICE '  - Class ID: %', v_class_id;
    END LOOP;
  ELSE
    RAISE NOTICE 'Creating test class for teacher...';
    
    -- Create a test class
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
    )
    RETURNING id INTO v_class_id;

    RAISE NOTICE 'Created class with ID: %', v_class_id;

    -- Get teacher role ID
    SELECT id INTO v_teacher_role_id
    FROM roles
    WHERE name = 'teacher';

    -- Assign teacher role for this class
    INSERT INTO user_roles (user_id, role_id, class_id)
    VALUES (v_teacher_id, v_teacher_role_id, v_class_id);

    RAISE NOTICE 'Assigned teacher role for class';
  END IF;

  -- Show final status
  RAISE NOTICE '---';
  RAISE NOTICE 'Teacher classes:';
  FOR v_class_id IN 
    SELECT id FROM classes WHERE created_by = v_teacher_id
  LOOP
    RAISE NOTICE '  - %', (SELECT name FROM classes WHERE id = v_class_id);
  END LOOP;

END $$;

-- Verify the result
SELECT 
  c.id,
  c.name,
  c.description,
  c.created_by,
  c.is_active,
  u.email as teacher_email
FROM classes c
JOIN auth.users u ON u.id = c.created_by
WHERE u.email = 'anqiluo@amazon.com'
ORDER BY c.created_at DESC;
