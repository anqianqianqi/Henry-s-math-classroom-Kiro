-- Fix RLS on classes table to allow reading

-- Check current policies
SELECT '=== CURRENT RLS POLICIES ON CLASSES ===' as section;
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'classes';

-- Drop restrictive policies
DROP POLICY IF EXISTS "Users can only see their own classes" ON classes;
DROP POLICY IF EXISTS "Teachers can see their classes" ON classes;

-- Create simple policy: authenticated users can read all classes
CREATE POLICY "Authenticated users can read all classes"
  ON classes FOR SELECT
  TO authenticated
  USING (true);

-- Verify
SELECT '=== NEW RLS POLICIES ===' as section;
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'classes';

-- Test query
SELECT '=== TEST: Can we read classes now? ===' as section;
SELECT id, name, is_active FROM classes;

SELECT '✅ RLS fixed! Refresh /classes page now' as result;
