-- Fix: Add DELETE and UPDATE policies for daily_challenges
-- Teachers and admins need to be able to delete/archive challenge instances
-- from their dashboard.
--
-- IMPORTANT: challenge_submissions has ON DELETE CASCADE on challenge_id,
-- which means deleting a daily_challenge would delete all submissions.
-- We change this to ON DELETE SET NULL so submissions are preserved
-- (challenge_id becomes null, but the submission content/points/etc remain).

-- Step 1: Change challenge_submissions FK to SET NULL instead of CASCADE
ALTER TABLE challenge_submissions
  DROP CONSTRAINT IF EXISTS challenge_submissions_challenge_id_fkey;

ALTER TABLE challenge_submissions
  ADD CONSTRAINT challenge_submissions_challenge_id_fkey
  FOREIGN KEY (challenge_id) REFERENCES daily_challenges(id)
  ON DELETE SET NULL;

-- Also fix challenge_assignments FK (these SHOULD cascade since an assignment
-- with no challenge makes no sense)
-- challenge_assignments already has ON DELETE CASCADE — leave it as is.

-- Step 2: Add RLS DELETE policy for teachers/admins
CREATE POLICY "Teachers can delete daily challenges"
  ON daily_challenges FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );

-- Step 3: Add UPDATE policy for teachers/admins (for edit functionality)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_challenges'
      AND policyname = 'Teachers can update daily challenges'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Teachers can update daily challenges"
        ON daily_challenges FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid()
              AND ur.class_id IS NULL
              AND r.name IN ('teacher', 'administrator')
          )
        )
    $policy$;
  END IF;
END $$;
