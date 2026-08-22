-- ── Deleting a session should mean no class was held that day ─────────────
--
-- Right now it means considerably more. Both session_materials and
-- homework_assignments hang off class_occurrences ON DELETE CASCADE, and
-- homework_submissions, homework_grades and homework_submission_comments
-- cascade off the assignment. So removing one session from a timetable takes
-- the graded homework of every student in that class with it, silently, with
-- no undo.
--
-- That has to be fixed before anything can offer a teacher a delete button on
-- a calendar. This migration makes homework and materials belong to the CLASS,
-- and keeps the session only as a soft link that may be broken.
--
-- ── THE HALF THAT IS NOT THE FOREIGN KEYS ─────────────────
-- Thirteen RLS policies currently reach the class by joining through the
-- occurrence. Null the occurrence_id without moving them and the homework is
-- not deleted — it becomes INVISIBLE, to the teacher and to the student who
-- submitted it, which looks like data loss without being it. They are rewritten
-- here in the same transaction, and each one loses a join in the process.
--
--   session_materials      4   read / upload / update / delete
--   homework_assignments   4   read / create / update / delete
--   homework_submissions   2   student insert, teacher read-all
--   homework_grades        3   teacher read-all / create / update
--
-- ── RUNNING IT ────────────────────────────────────────────
-- One transaction: if the backfill misses a row, SET NOT NULL fails and the
-- whole thing rolls back rather than leaving the policies half-moved.
--
-- There is no staging database. Read it before you run it, and run the counts
-- at the bottom afterwards.

BEGIN;

-- ── 1. Give the work its own class ────────────────────────────────────────
-- Nullable to begin with; the backfill fills it and step 3 constrains it. The
-- three-step shape is deliberate — adding it NOT NULL outright would fail on
-- any existing row.
ALTER TABLE homework_assignments
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;

ALTER TABLE session_materials
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;

-- ── 2. Backfill from the session it currently hangs off ───────────────────
UPDATE homework_assignments ha
   SET class_id = co.class_id
  FROM class_occurrences co
 WHERE co.id = ha.occurrence_id
   AND ha.class_id IS NULL;

UPDATE session_materials sm
   SET class_id = co.class_id
  FROM class_occurrences co
 WHERE co.id = sm.occurrence_id
   AND sm.class_id IS NULL;

-- ── 3. Prove the backfill was total, then constrain ───────────────────────
-- occurrence_id is NOT NULL today and enforced by a foreign key, so every row
-- must have resolved. This is here because "must" is doing a lot of work in
-- that sentence and the alternative is finding out later.
DO $$
DECLARE
  orphan_hw  INTEGER;
  orphan_mat INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_hw  FROM homework_assignments WHERE class_id IS NULL;
  SELECT COUNT(*) INTO orphan_mat FROM session_materials    WHERE class_id IS NULL;
  IF orphan_hw > 0 OR orphan_mat > 0 THEN
    RAISE EXCEPTION
      'Backfill incomplete: % homework_assignments and % session_materials still have no class_id. Nothing has been changed.',
      orphan_hw, orphan_mat;
  END IF;
END $$;

ALTER TABLE homework_assignments ALTER COLUMN class_id SET NOT NULL;
ALTER TABLE session_materials    ALTER COLUMN class_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hw_assignments_class ON homework_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_materials_class      ON session_materials(class_id);

-- ── 4. Let the session link be broken ─────────────────────────────────────
-- Found by definition rather than by name: the constraint may have been
-- created by any migration and the generated name is not guaranteed.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT con.conrelid::regclass AS tbl, con.conname
      FROM pg_constraint con
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = ANY (con.conkey)
     WHERE con.contype = 'f'
       AND con.confrelid = 'class_occurrences'::regclass
       AND att.attname = 'occurrence_id'
       AND con.conrelid IN ('homework_assignments'::regclass, 'session_materials'::regclass)
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;

ALTER TABLE homework_assignments ALTER COLUMN occurrence_id DROP NOT NULL;
ALTER TABLE session_materials    ALTER COLUMN occurrence_id DROP NOT NULL;

ALTER TABLE homework_assignments
  ADD CONSTRAINT homework_assignments_occurrence_id_fkey
  FOREIGN KEY (occurrence_id) REFERENCES class_occurrences(id) ON DELETE SET NULL;

ALTER TABLE session_materials
  ADD CONSTRAINT session_materials_occurrence_id_fkey
  FOREIGN KEY (occurrence_id) REFERENCES class_occurrences(id) ON DELETE SET NULL;

COMMENT ON COLUMN homework_assignments.occurrence_id IS
  'The session this was set at, if it still exists. NULL once that session was removed from the timetable — the assignment belongs to class_id, not to a sitting.';
COMMENT ON COLUMN session_materials.occurrence_id IS
  'The session this was uploaded for, if it still exists. NULL once that session was removed; the material belongs to class_id.';

-- ── 5. Move authorization off the occurrence ──────────────────────────────
-- Every policy below is the existing one with the class reached directly
-- instead of through a session that may no longer be there. Same permissions,
-- same names, one less join.

-- session_materials ─────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read session materials" ON session_materials;
CREATE POLICY "Users can read session materials"
  ON session_materials FOR SELECT
  USING (
    is_available = TRUE
    AND EXISTS (
      SELECT 1 FROM class_members cm
       WHERE cm.class_id = session_materials.class_id
         AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can upload materials" ON session_materials;
CREATE POLICY "Teachers can upload materials"
  ON session_materials FOR INSERT
  WITH CHECK (user_has_permission(auth.uid(), 'material:upload', class_id));

DROP POLICY IF EXISTS "Teachers can update materials" ON session_materials;
CREATE POLICY "Teachers can update materials"
  ON session_materials FOR UPDATE
  USING (
    uploaded_by = auth.uid()
    OR user_has_permission(auth.uid(), 'material:upload', class_id)
  );

DROP POLICY IF EXISTS "Teachers can delete materials" ON session_materials;
CREATE POLICY "Teachers can delete materials"
  ON session_materials FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR user_has_permission(auth.uid(), 'material:delete', class_id)
  );

-- homework_assignments ──────────────────────────────────────
DROP POLICY IF EXISTS "Users can read homework assignments" ON homework_assignments;
CREATE POLICY "Users can read homework assignments"
  ON homework_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members cm
       WHERE cm.class_id = homework_assignments.class_id
         AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can create assignments" ON homework_assignments;
CREATE POLICY "Teachers can create assignments"
  ON homework_assignments FOR INSERT
  WITH CHECK (user_has_permission(auth.uid(), 'homework:create', class_id));

DROP POLICY IF EXISTS "Teachers can update assignments" ON homework_assignments;
CREATE POLICY "Teachers can update assignments"
  ON homework_assignments FOR UPDATE
  USING (user_has_permission(auth.uid(), 'homework:update', class_id));

DROP POLICY IF EXISTS "Teachers can delete assignments" ON homework_assignments;
CREATE POLICY "Teachers can delete assignments"
  ON homework_assignments FOR DELETE
  USING (user_has_permission(auth.uid(), 'homework:delete', class_id));

-- homework_submissions ──────────────────────────────────────
-- The two student-own-row policies are untouched: they read student_id and
-- never went near an occurrence.
DROP POLICY IF EXISTS "Students can create submissions" ON homework_submissions;
CREATE POLICY "Students can create submissions"
  ON homework_submissions FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND user_has_permission(auth.uid(), 'submission:create')
    AND EXISTS (
      SELECT 1 FROM homework_assignments ha
      JOIN class_members cm ON cm.class_id = ha.class_id
       WHERE ha.id = assignment_id
         AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can read all submissions" ON homework_submissions;
CREATE POLICY "Teachers can read all submissions"
  ON homework_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM homework_assignments ha
       WHERE ha.id = assignment_id
         AND user_has_permission(auth.uid(), 'submission:read_all', ha.class_id)
    )
  );

-- homework_grades ───────────────────────────────────────────
-- "Students can read own grades" is untouched: it walks to the submission and
-- checks student_id, which never involved an occurrence.
DROP POLICY IF EXISTS "Teachers can read all grades" ON homework_grades;
CREATE POLICY "Teachers can read all grades"
  ON homework_grades FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM homework_submissions hs
      JOIN homework_assignments ha ON ha.id = hs.assignment_id
       WHERE hs.id = submission_id
         AND user_has_permission(auth.uid(), 'grade:read_all', ha.class_id)
    )
  );

DROP POLICY IF EXISTS "Teachers can create grades" ON homework_grades;
CREATE POLICY "Teachers can create grades"
  ON homework_grades FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM homework_submissions hs
      JOIN homework_assignments ha ON ha.id = hs.assignment_id
       WHERE hs.id = submission_id
         AND user_has_permission(auth.uid(), 'grade:create', ha.class_id)
    )
  );

DROP POLICY IF EXISTS "Teachers can update grades" ON homework_grades;
CREATE POLICY "Teachers can update grades"
  ON homework_grades FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM homework_submissions hs
      JOIN homework_assignments ha ON ha.id = hs.assignment_id
       WHERE hs.id = submission_id
         AND user_has_permission(auth.uid(), 'grade:create', ha.class_id)
    )
  );

COMMIT;

-- ── Afterwards ────────────────────────────────────────────────────────────
-- Every count should be 0. The first two are the migration; the third proves
-- no policy still reaches a class through a session.
--
--   SELECT COUNT(*) FROM homework_assignments WHERE class_id IS NULL;
--   SELECT COUNT(*) FROM session_materials    WHERE class_id IS NULL;
--
--   SELECT COUNT(*) FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('session_materials','homework_assignments',
--                        'homework_submissions','homework_grades')
--      AND (qual LIKE '%class_occurrences%' OR with_check LIKE '%class_occurrences%');
--
-- And the behaviour this was all for — deleting a session must not touch the
-- homework. On a throwaway class:
--
--   DELETE FROM class_occurrences WHERE id = '<a session with homework on it>';
--   SELECT occurrence_id, class_id FROM homework_assignments WHERE class_id = '<that class>';
--   -- occurrence_id NULL, class_id intact, submissions and grades still there.
