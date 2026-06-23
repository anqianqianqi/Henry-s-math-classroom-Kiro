-- Fix the read policy on book_skin_overlays
-- Run this in Supabase SQL Editor

-- First, see what policies currently exist on this table
SELECT policyname, cmd, qual FROM pg_policies 
WHERE tablename = 'book_skin_overlays';

-- Drop ALL existing policies on this table and start fresh
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'book_skin_overlays' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON book_skin_overlays';
  END LOOP;
END;
$$;

-- Recreate with simple, working policies
-- Read: anyone authenticated (including admins reading their own skins)
CREATE POLICY "overlays_read"
  ON book_skin_overlays FOR SELECT
  TO authenticated
  USING (true);

-- Write (insert/update/delete): admins and teachers only
CREATE POLICY "overlays_write"
  ON book_skin_overlays FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Verify the policies were created
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'book_skin_overlays';
