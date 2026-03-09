-- Create Mock Class Occurrences for Testing
-- This script generates sample occurrences for existing classes

-- First, let's see what classes we have
SELECT id, name, created_by, start_date, end_date 
FROM classes 
ORDER BY created_at DESC 
LIMIT 5;

-- Get the first class (you can change this to target a specific class)
DO $$
DECLARE
  target_class_id UUID;
  class_name TEXT;
BEGIN
  -- Get the most recent class
  SELECT id, name INTO target_class_id, class_name
  FROM classes
  ORDER BY created_at DESC
  LIMIT 1;

  RAISE NOTICE 'Creating occurrences for class: % (ID: %)', class_name, target_class_id;

  -- Delete existing occurrences for this class (if any)
  DELETE FROM class_occurrences WHERE class_id = target_class_id;

  -- Insert mock occurrences
  -- Creating a mix of past, current, and future sessions
  INSERT INTO class_occurrences (
    class_id,
    occurrence_date,
    start_time,
    end_time,
    session_number,
    topic,
    status,
    notes
  ) VALUES
    -- Past sessions (completed)
    (target_class_id, '2026-02-10', '15:00:00', '16:00:00', 1, 'Introduction to Algebra', 'completed', 'Covered basic concepts and variables'),
    (target_class_id, '2026-02-12', '15:00:00', '16:00:00', 2, 'Linear Equations', 'completed', 'Solving equations with one variable'),
    (target_class_id, '2026-02-17', '15:00:00', '16:00:00', 3, 'Graphing Functions', 'completed', 'Introduction to coordinate plane'),
    (target_class_id, '2026-02-19', '15:00:00', '16:00:00', 4, 'Systems of Equations', 'completed', 'Solving systems using substitution'),
    (target_class_id, '2026-02-24', '15:00:00', '16:00:00', 5, 'Quadratic Equations', 'completed', 'Factoring and solving quadratics'),
    (target_class_id, '2026-02-26', '15:00:00', '16:00:00', 6, 'Polynomials', 'completed', 'Operations with polynomials'),
    (target_class_id, '2026-03-03', '15:00:00', '16:00:00', 7, 'Exponents and Radicals', 'completed', 'Properties of exponents'),
    (target_class_id, '2026-03-05', '15:00:00', '16:00:00', 8, 'Rational Expressions', 'completed', 'Simplifying and operations'),
    
    -- Upcoming sessions
    (target_class_id, '2026-03-10', '15:00:00', '16:00:00', 9, 'Inequalities', 'upcoming', 'Solving and graphing inequalities'),
    (target_class_id, '2026-03-12', '15:00:00', '16:00:00', 10, 'Absolute Value', 'upcoming', 'Equations and inequalities with absolute value'),
    (target_class_id, '2026-03-17', '15:00:00', '16:00:00', 11, 'Functions and Relations', 'upcoming', 'Domain, range, and function notation'),
    (target_class_id, '2026-03-19', '15:00:00', '16:00:00', 12, 'Transformations', 'upcoming', 'Translations, reflections, and dilations'),
    (target_class_id, '2026-03-24', '15:00:00', '16:00:00', 13, 'Exponential Functions', 'upcoming', 'Growth and decay models'),
    (target_class_id, '2026-03-26', '15:00:00', '16:00:00', 14, 'Logarithmic Functions', 'upcoming', 'Properties and applications of logs'),
    (target_class_id, '2026-03-31', '15:00:00', '16:00:00', 15, 'Sequences and Series', 'upcoming', 'Arithmetic and geometric sequences'),
    (target_class_id, '2026-04-02', '15:00:00', '16:00:00', 16, 'Probability', 'upcoming', 'Basic probability concepts'),
    (target_class_id, '2026-04-07', '15:00:00', '16:00:00', 17, 'Statistics', 'upcoming', 'Mean, median, mode, and standard deviation'),
    (target_class_id, '2026-04-09', '15:00:00', '16:00:00', 18, 'Review Session', 'upcoming', 'Comprehensive review of all topics'),
    (target_class_id, '2026-04-14', '15:00:00', '16:00:00', 19, 'Final Exam Prep', 'upcoming', 'Practice problems and Q&A'),
    (target_class_id, '2026-04-16', '15:00:00', '16:00:00', 20, 'Final Exam', 'upcoming', 'Comprehensive final examination');

  RAISE NOTICE 'Created 20 occurrences (8 past, 12 upcoming)';
END $$;

-- Verify the occurrences were created
SELECT 
  session_number,
  occurrence_date,
  topic,
  status,
  CASE 
    WHEN occurrence_date < CURRENT_DATE THEN '✓ Past'
    WHEN occurrence_date = CURRENT_DATE THEN '→ Today'
    ELSE '→ Future'
  END as timeline
FROM class_occurrences
WHERE class_id = (SELECT id FROM classes ORDER BY created_at DESC LIMIT 1)
ORDER BY session_number;

-- Show summary
SELECT 
  status,
  COUNT(*) as count
FROM class_occurrences
WHERE class_id = (SELECT id FROM classes ORDER BY created_at DESC LIMIT 1)
GROUP BY status;
