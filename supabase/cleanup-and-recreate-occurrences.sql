-- Clean up duplicate occurrences and recreate properly

-- Step 1: Delete ALL occurrences for Algebra 1 - Spring 2026
DELETE FROM class_occurrences
WHERE class_id = (
  SELECT id FROM classes 
  WHERE name ILIKE '%Algebra 1%Spring%'
  LIMIT 1
);

-- Step 2: Verify deletion
SELECT COUNT(*) as remaining_occurrences
FROM class_occurrences
WHERE class_id = (
  SELECT id FROM classes 
  WHERE name ILIKE '%Algebra 1%Spring%'
  LIMIT 1
);

-- Step 3: Create fresh occurrences (only 20)
WITH target_class AS (
  SELECT id FROM classes
  WHERE name ILIKE '%Algebra 1%Spring%'
  LIMIT 1
)
INSERT INTO class_occurrences (
  class_id,
  occurrence_date,
  start_time,
  end_time,
  session_number,
  topic,
  status,
  notes
)
SELECT 
  tc.id,
  occurrence_date,
  start_time,
  end_time,
  session_number,
  topic,
  status,
  notes
FROM target_class tc
CROSS JOIN (
  VALUES
    -- Past sessions (8)
    ('2026-02-10'::date, '15:00:00'::time, '16:00:00'::time, 1, 'Introduction to Algebra', 'completed', 'Covered basic concepts and variables'),
    ('2026-02-12'::date, '15:00:00'::time, '16:00:00'::time, 2, 'Linear Equations', 'completed', 'Solving equations with one variable'),
    ('2026-02-17'::date, '15:00:00'::time, '16:00:00'::time, 3, 'Graphing Functions', 'completed', 'Introduction to coordinate plane'),
    ('2026-02-19'::date, '15:00:00'::time, '16:00:00'::time, 4, 'Systems of Equations', 'completed', 'Solving systems using substitution'),
    ('2026-02-24'::date, '15:00:00'::time, '16:00:00'::time, 5, 'Quadratic Equations', 'completed', 'Factoring and solving quadratics'),
    ('2026-02-26'::date, '15:00:00'::time, '16:00:00'::time, 6, 'Polynomials', 'completed', 'Operations with polynomials'),
    ('2026-03-03'::date, '15:00:00'::time, '16:00:00'::time, 7, 'Exponents and Radicals', 'completed', 'Properties of exponents'),
    ('2026-03-05'::date, '15:00:00'::time, '16:00:00'::time, 8, 'Rational Expressions', 'completed', 'Simplifying and operations'),
    
    -- Upcoming sessions (12)
    ('2026-03-10'::date, '15:00:00'::time, '16:00:00'::time, 9, 'Inequalities', 'upcoming', 'Solving and graphing inequalities'),
    ('2026-03-12'::date, '15:00:00'::time, '16:00:00'::time, 10, 'Absolute Value', 'upcoming', 'Equations with absolute value'),
    ('2026-03-17'::date, '15:00:00'::time, '16:00:00'::time, 11, 'Functions and Relations', 'upcoming', 'Domain and range'),
    ('2026-03-19'::date, '15:00:00'::time, '16:00:00'::time, 12, 'Transformations', 'upcoming', 'Graph transformations'),
    ('2026-03-24'::date, '15:00:00'::time, '16:00:00'::time, 13, 'Exponential Functions', 'upcoming', 'Growth and decay'),
    ('2026-03-26'::date, '15:00:00'::time, '16:00:00'::time, 14, 'Logarithmic Functions', 'upcoming', 'Properties of logs'),
    ('2026-03-31'::date, '15:00:00'::time, '16:00:00'::time, 15, 'Sequences and Series', 'upcoming', 'Arithmetic sequences'),
    ('2026-04-02'::date, '15:00:00'::time, '16:00:00'::time, 16, 'Probability', 'upcoming', 'Basic probability'),
    ('2026-04-07'::date, '15:00:00'::time, '16:00:00'::time, 17, 'Statistics', 'upcoming', 'Mean and median'),
    ('2026-04-09'::date, '15:00:00'::time, '16:00:00'::time, 18, 'Review Session', 'upcoming', 'Comprehensive review'),
    ('2026-04-14'::date, '15:00:00'::time, '16:00:00'::time, 19, 'Final Exam Prep', 'upcoming', 'Practice problems'),
    ('2026-04-16'::date, '15:00:00'::time, '16:00:00'::time, 20, 'Final Exam', 'upcoming', 'Final examination')
) AS occurrences(occurrence_date, start_time, end_time, session_number, topic, status, notes);

-- Step 4: Verify correct count
SELECT 
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE status = 'completed') as past_sessions,
  COUNT(*) FILTER (WHERE status = 'upcoming') as upcoming_sessions
FROM class_occurrences
WHERE class_id = (
  SELECT id FROM classes 
  WHERE name ILIKE '%Algebra 1%Spring%'
  LIMIT 1
);

-- Step 5: Show the occurrences
SELECT 
  session_number,
  occurrence_date,
  topic,
  status
FROM class_occurrences
WHERE class_id = (
  SELECT id FROM classes 
  WHERE name ILIKE '%Algebra 1%Spring%'
  LIMIT 1
)
ORDER BY session_number;
