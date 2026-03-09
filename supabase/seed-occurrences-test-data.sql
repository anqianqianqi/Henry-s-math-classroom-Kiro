-- ============================================
-- MOCK DATA FOR CLASS OCCURRENCES SYSTEM
-- Creates test data for occurrences and materials
-- ============================================

-- This script creates:
-- 1. Test class with schedule
-- 2. Class occurrences (24 sessions)
-- 3. Enrolls test students
-- 
-- Note: Materials are NOT created yet (no UI to view them)
-- We'll add materials later when the UI is built

-- ============================================
-- PREREQUISITES
-- ============================================
-- Run these first if you haven't:
-- 1. supabase/add-class-occurrences-system.sql (creates tables)
-- 2. Have test users: anqiluo@amazon.com (teacher), sarah@test.com, mike@test.com (students)

-- ============================================
-- STEP 1: CREATE TEST CLASS WITH SCHEDULE
-- ============================================

-- Get teacher user ID (anqiluo@amazon.com)
DO $$
DECLARE
  v_teacher_id UUID;
  v_class_id UUID;
  v_occurrence_id UUID;
  v_student1_id UUID;
  v_student2_id UUID;
BEGIN
  -- Get teacher ID
  SELECT id INTO v_teacher_id FROM profiles WHERE email = 'anqiluo@amazon.com' LIMIT 1;
  
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Teacher account not found. Please create anqiluo@amazon.com first.';
  END IF;

  -- Create test class
  INSERT INTO classes (
    id,
    created_by,
    name,
    description,
    schedule,
    start_date,
    end_date,
    is_active
  ) VALUES (
    gen_random_uuid(),
    v_teacher_id,
    'Algebra 1 - Spring 2026',
    'Introduction to algebra concepts including linear equations, polynomials, and graphing. Perfect for students in grades 8-9.',
    '[
      {"day": "Monday", "startTime": "15:00", "endTime": "16:00"},
      {"day": "Wednesday", "startTime": "15:00", "endTime": "16:00"}
    ]'::jsonb,
    '2026-03-10',
    '2026-05-30',
    true
  ) RETURNING id INTO v_class_id;

  RAISE NOTICE 'Created class: %', v_class_id;

  -- ============================================
  -- STEP 2: GENERATE CLASS OCCURRENCES
  -- ============================================
  
  -- We'll use a simpler approach: create a temp table first, then insert
  
  -- Create temporary table for occurrences
  CREATE TEMP TABLE temp_occurrences (
    occurrence_date DATE,
    start_time TIME,
    end_time TIME,
    session_number INTEGER,
    topic TEXT,
    status TEXT,
    day_of_week INTEGER
  );
  
  -- Generate Monday occurrences
  INSERT INTO temp_occurrences (occurrence_date, start_time, end_time, session_number, topic, status, day_of_week)
  SELECT 
    date::date,
    '15:00:00'::time,
    '16:00:00'::time,
    0, -- Will update later
    CASE 
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 1 THEN 'Introduction to Variables'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 2 THEN 'Solving Linear Equations'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 3 THEN 'Graphing Linear Functions'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 4 THEN 'Systems of Equations'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 5 THEN 'Polynomials Basics'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 6 THEN 'Factoring Polynomials'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 7 THEN 'Quadratic Equations'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 8 THEN 'Quadratic Formula'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 9 THEN 'Exponential Functions'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 10 THEN 'Review and Practice'
      ELSE 'Advanced Topics'
    END,
    CASE 
      WHEN date < CURRENT_DATE THEN 'completed'
      ELSE 'upcoming'
    END,
    1 -- Monday
  FROM generate_series(
    '2026-03-10'::date,
    '2026-05-30'::date,
    '7 days'::interval
  ) AS date
  WHERE EXTRACT(DOW FROM date) = 1;

  -- Generate Wednesday occurrences
  INSERT INTO temp_occurrences (occurrence_date, start_time, end_time, session_number, topic, status, day_of_week)
  SELECT 
    date::date,
    '15:00:00'::time,
    '16:00:00'::time,
    0, -- Will update later
    CASE 
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 1 THEN 'Variables Practice'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 2 THEN 'Linear Equations Practice'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 3 THEN 'Graphing Practice'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 4 THEN 'Systems Practice'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 5 THEN 'Polynomials Practice'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 6 THEN 'Factoring Practice'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 7 THEN 'Quadratic Practice'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 8 THEN 'Formula Practice'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 9 THEN 'Exponential Practice'
      WHEN ROW_NUMBER() OVER (ORDER BY date) = 10 THEN 'Final Review'
      ELSE 'Practice Session'
    END,
    CASE 
      WHEN date < CURRENT_DATE THEN 'completed'
      ELSE 'upcoming'
    END,
    3 -- Wednesday
  FROM generate_series(
    '2026-03-10'::date,
    '2026-05-30'::date,
    '7 days'::interval
  ) AS date
  WHERE EXTRACT(DOW FROM date) = 3;
  
  -- Update session numbers sequentially
  UPDATE temp_occurrences
  SET session_number = subquery.rn
  FROM (
    SELECT occurrence_date, start_time, ROW_NUMBER() OVER (ORDER BY occurrence_date, start_time) as rn
    FROM temp_occurrences
  ) AS subquery
  WHERE temp_occurrences.occurrence_date = subquery.occurrence_date
    AND temp_occurrences.start_time = subquery.start_time;
  
  -- Insert into actual table
  INSERT INTO class_occurrences (class_id, occurrence_date, start_time, end_time, session_number, topic, status)
  SELECT 
    v_class_id,
    occurrence_date,
    start_time,
    end_time,
    session_number,
    topic,
    status
  FROM temp_occurrences
  ORDER BY occurrence_date, start_time;
  
  -- Clean up temp table
  DROP TABLE temp_occurrences;

  RAISE NOTICE 'Created % occurrences', (SELECT COUNT(*) FROM class_occurrences WHERE class_id = v_class_id);

  -- ============================================
  -- STEP 3: MATERIALS (SKIPPED - NO UI YET)
  -- ============================================
  
  -- Materials will be added later when UI is built
  -- For now, we can test:
  -- - Occurrence generation
  -- - Viewing occurrences list
  -- - Filtering by status (upcoming/completed)
  
  RAISE NOTICE 'Materials skipped - will be added when UI is ready';

  -- ============================================
  -- STEP 4: ENROLL STUDENTS
  -- ============================================
  
  -- Get student IDs
  SELECT id INTO v_student1_id FROM profiles WHERE email = 'sarah@test.com' LIMIT 1;
  SELECT id INTO v_student2_id FROM profiles WHERE email = 'mike@test.com' LIMIT 1;

  IF v_student1_id IS NOT NULL THEN
    -- Enroll student 1
    INSERT INTO class_members (class_id, user_id, role_id, added_by)
    VALUES (
      v_class_id, 
      v_student1_id, 
      (SELECT id FROM roles WHERE name = 'student' LIMIT 1),
      v_teacher_id
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Enrolled sarah@test.com';
  ELSE
    RAISE NOTICE 'Student sarah@test.com not found - skipping enrollment';
  END IF;

  IF v_student2_id IS NOT NULL THEN
    -- Enroll student 2
    INSERT INTO class_members (class_id, user_id, role_id, added_by)
    VALUES (
      v_class_id,
      v_student2_id,
      (SELECT id FROM roles WHERE name = 'student' LIMIT 1),
      v_teacher_id
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Enrolled mike@test.com';
  ELSE
    RAISE NOTICE 'Student mike@test.com not found - skipping enrollment';
  END IF;

  -- ============================================
  -- SUMMARY
  -- ============================================
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MOCK DATA CREATED SUCCESSFULLY!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Class ID: %', v_class_id;
  RAISE NOTICE 'Class Name: Algebra 1 - Spring 2026';
  RAISE NOTICE 'Teacher: anqiluo@amazon.com';
  RAISE NOTICE 'Schedule: Monday & Wednesday 3-4pm';
  RAISE NOTICE 'Date Range: March 10 - May 30, 2026';
  RAISE NOTICE 'Total Occurrences: %', (SELECT COUNT(*) FROM class_occurrences WHERE class_id = v_class_id);
  RAISE NOTICE 'Enrolled Students: %', (SELECT COUNT(*) FROM class_members WHERE class_id = v_class_id);
  RAISE NOTICE '========================================';
  RAISE NOTICE 'What You Can Test Now:';
  RAISE NOTICE '1. View class in /classes page';
  RAISE NOTICE '2. Query occurrences with SQL (see verification queries below)';
  RAISE NOTICE '3. Test occurrence generation algorithm in browser console';
  RAISE NOTICE '4. Verify RLS policies work (students enrolled, can view class)';
  RAISE NOTICE '';
  RAISE NOTICE 'What Needs UI Built:';
  RAISE NOTICE '- Display occurrences list on class detail page';
  RAISE NOTICE '- Show upcoming vs past sessions';
  RAISE NOTICE '- Material upload/download (Phase 3 utilities ready)';
  RAISE NOTICE '- Homework system (Phase 4-5)';
  RAISE NOTICE '========================================';

END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- View created class
SELECT 
  id,
  name,
  description,
  schedule,
  start_date,
  end_date,
  (SELECT COUNT(*) FROM class_occurrences WHERE class_id = classes.id) as occurrence_count,
  (SELECT COUNT(*) FROM class_members WHERE class_id = classes.id) as member_count
FROM classes 
WHERE name = 'Algebra 1 - Spring 2026';

-- View occurrences
SELECT 
  session_number,
  occurrence_date,
  start_time,
  end_time,
  topic,
  status,
  (SELECT COUNT(*) FROM session_materials WHERE occurrence_id = class_occurrences.id) as material_count
FROM class_occurrences
WHERE class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026')
ORDER BY session_number
LIMIT 10;

-- Count occurrences by status
SELECT 
  status,
  COUNT(*) as count
FROM class_occurrences
WHERE class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026')
GROUP BY status;

-- View enrolled students
SELECT 
  p.full_name,
  p.email,
  cm.joined_at
FROM class_members cm
JOIN profiles p ON cm.user_id = p.id
WHERE cm.class_id = (SELECT id FROM classes WHERE name = 'Algebra 1 - Spring 2026');
