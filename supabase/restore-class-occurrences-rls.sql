-- ── Only a teacher or admin may change a timetable ────────────────────────
--
-- class_occurrences has had row level security switched off since
-- temp-disable-occurrences-rls.sql, a file whose own first line calls it
-- "TEMPORARY: ... for testing". With it off, any signed-in student can read,
-- insert, update and delete any class's sessions — including deleting one, now
-- that the dashboard calendar makes that a normal thing to do.
--
-- The dashboard only offers the authoring UI to a teacher, but that is a
-- decision made in the browser and anyone can make a different one.
--
-- ── WHY THE OLD POLICIES CANNOT SIMPLY BE TURNED BACK ON ──
-- They gate writes on user_has_permission(auth.uid(), 'occurrence:manage',
-- class_id), which no administrator can satisfy: seed.sql never creates an
-- administrator role, occurrence:manage was granted to the teacher role alone,
-- and the function is a plain join with no wildcard. Enabling RLS with those
-- policies in place would lock admins out of their own timetables — which is
-- exactly what happened on class_schedule_series, and why that table needed
-- fix-class-schedule-series-rls.sql.
--
-- So the policies are rewritten first, checking the role by name the way the
-- rest of this directory does, and RLS is enabled at the end of the same
-- transaction. Never the other way round.
--
-- ── SAFE TO RUN ───────────────────────────────────────────
-- The only code that writes to this table is lib/classSchedule/operations.ts,
-- reached from the dashboard calendar, which is teacher-and-admin only.
-- SessionsList used to insert here and no longer does. Everything else —
-- ProgressDashboard, SessionDetail, SessionsList, lib/utils/materials.ts and
-- the dashboard calendar — only reads, and the read policy below keeps every
-- one of those working.

BEGIN;

-- ── Reading ───────────────────────────────────────────────────────────────
-- A student sees their own classes' sessions. A teacher or admin sees all of
-- them, which the dashboard calendar depends on: it shows every class running
-- on a day, and a teacher is not usually enrolled in the classes they teach.
DROP POLICY IF EXISTS "Users can read class occurrences" ON class_occurrences;
CREATE POLICY "Users can read class occurrences"
  ON class_occurrences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members cm
      WHERE cm.class_id = class_occurrences.class_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- ── Writing ───────────────────────────────────────────────────────────────
-- A global teacher or administrator role, and nothing else. Matching how the
-- app already behaves: /classes shows a teacher every class, not only the ones
-- they created.
DROP POLICY IF EXISTS "Teachers can insert occurrences" ON class_occurrences;
CREATE POLICY "Teachers can insert occurrences"
  ON class_occurrences FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Teachers can update occurrences" ON class_occurrences;
CREATE POLICY "Teachers can update occurrences"
  ON class_occurrences FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Teachers can delete occurrences" ON class_occurrences;
CREATE POLICY "Teachers can delete occurrences"
  ON class_occurrences FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Last, and only once the policies above are the ones that will apply.
ALTER TABLE class_occurrences ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ── Afterwards ────────────────────────────────────────────────────────────
-- Should report rowsecurity = true:
--
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public' AND tablename = 'class_occurrences';
--
-- Then check both sides, because a policy that is too tight fails silently as
-- an empty list rather than as an error:
--
--   As a teacher   the dashboard calendar still shows every class on a day,
--                  and the assignment window can still add and delete.
--   As a student   the calendar still shows their own classes, and
--                  /classes/[id] still lists that class's sessions.
--
-- temp-disable-occurrences-rls.sql is now superseded and should not be run
-- again. It is left in place only so the history reads.
