-- Create Mock Occurrences for a Specific Class
-- Replace 'Algebra I' with your class name

-- Step 1: Find your class
SELECT id, name, created_by, start_date, end_date 
FROM classes 
WHERE name ILIKE '%algebra%'  -- Change this to match your class name
ORDER BY created_at DESC;

-- Step 2: Insert occurrences (replace the class_id in the WHERE clause below)
-- Copy the class ID from the query above and use it below

-- For example, if your class ID is: 12345678-1234-1234-1234-123456789abc
-- Replace 'YOUR_CLASS_ID_HERE' with that ID

DO $$
DECLARE
  target_class_id UUID := 'YOUR_CLASS_ID_HERE'; -- REPLACE THIS!
BEGIN
  -- Delete existing occurrences
  DELETE FROM class_occurrences WHERE class_id = target_class_id;
  
  RAISE NOTICE 'Deleted existing occurrences';

  -- Insert new occurrences
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
    -- Past sessions
    (target_class_id, '2026-02-10', '15:00:00', '16:00:00', 1, 'Introduction to Algebra', 'completed', 'Covered basic concepts'),
    (target_class_id, '2026-02-12', '15:00:00', '16:00:00', 2, 'Linear Equations', 'completed', 'Solving equations'),
    (target_class_id, '2026-02-17', '15:00:00', '16:00:00', 3, 'Graphing Functions', 'completed', 'Coordinate plane'),
    (target_class_id, '2026-02-19', '15:00:00', '16:00:00', 4, 'Systems of Equations', 'completed', 'Substitution method'),
    (target_class_id, '2026-02-24', '15:00:00', '16:00:00', 5, 'Quadratic Equations', 'completed', 'Factoring'),
    (target_class_id, '2026-02-26', '15:00:00', '16:00:00', 6, 'Polynomials', 'completed', 'Operations'),
    (target_class_id, '2026-03-03', '15:00:00', '16:00:00', 7, 'Exponents', 'completed', 'Properties'),
    (target_class_id, '2026-03-05', '15:00:00', '16:00:00', 8, 'Rational Expressions', 'completed', 'Simplifying'),
    
    -- Upcoming sessions
    (target_class_id, '2026-03-10', '15:00:00', '16:00:00', 9, 'Inequalities', 'upcoming', 'Solving inequalities'),
    (target_class_id, '2026-03-12', '15:00:00', '16:00:00', 10, 'Absolute Value', 'upcoming', 'Absolute value equations'),
    (target_class_id, '2026-03-17', '15:00:00', '16:00:00', 11, 'Functions', 'upcoming', 'Function notation'),
    (target_class_id, '2026-03-19', '15:00:00', '16:00:00', 12, 'Transformations', 'upcoming', 'Graph transformations'),
    (target_class_id, '2026-03-24', '15:00:00', '16:00:00', 13, 'Exponential Functions', 'upcoming', 'Growth models'),
    (target_class_id, '2026-03-26', '15:00:00', '16:00:00', 14, 'Logarithms', 'upcoming', 'Log properties'),
    (target_class_id, '2026-03-31', '15:00:00', '16:00:00', 15, 'Sequences', 'upcoming', 'Arithmetic sequences'),
    (target_class_id, '2026-04-02', '15:00:00', '16:00:00', 16, 'Probability', 'upcoming', 'Basic probability'),
    (target_class_id, '2026-04-07', '15:00:00', '16:00:00', 17, 'Statistics', 'upcoming', 'Mean and median'),
    (target_class_id, '2026-04-09', '15:00:00', '16:00:00', 18, 'Review', 'upcoming', 'Comprehensive review'),
    (target_class_id, '2026-04-14', '15:00:00', '16:00:00', 19, 'Exam Prep', 'upcoming', 'Practice problems'),
    (target_class_id, '2026-04-16', '15:00:00', '16:00:00', 20, 'Final Exam', 'upcoming', 'Final examination');

  RAISE NOTICE 'Created 20 occurrences';
END $$;

-- Verify
SELECT 
  session_number,
  occurrence_date,
  topic,
  status
FROM class_occurrences
WHERE class_id = 'YOUR_CLASS_ID_HERE'  -- REPLACE THIS!
ORDER BY session_number;
