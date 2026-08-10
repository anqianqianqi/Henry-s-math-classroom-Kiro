-- ── Administrators could not create a repeating schedule ──────────────────
--
--   new row violates row-level security policy for table "class_schedule_series"
--
-- add-class-schedule-series.sql gated writes on
-- user_has_permission(auth.uid(), 'occurrence:manage', class_id), copying the
-- policies already on class_occurrences. That check cannot pass for an
-- administrator, for three reasons that only add up to a visible bug together:
--
--   1. seed.sql creates three roles — teacher, student, observer. There is no
--      administrator row in it; that role was added to the live database later.
--   2. occurrence:manage is granted to the TEACHER role only
--      (add-class-occurrences-system.sql), and nothing ever granted it to
--      administrator.
--   3. user_has_permission is a plain join through role_permissions with no
--      wildcard — admin:full_access exists as a permission name but the
--      function does not treat it, or the administrator role, as special. So an
--      administrator fails every permission check by name.
--
-- The reason nobody hit this before: class_occurrences has RLS DISABLED
-- (temp-disable-occurrences-rls.sql), so its identical policies have never
-- actually run. class_schedule_series shipped with RLS enabled, which is what
-- made the gap visible.
--
-- ── THE FIX ───────────────────────────────────────────────
-- Check the role by name, which is what nearly forty other migrations in this
-- directory already do — add-announcements, add-challenge-scheduler,
-- migrate-tags-multilingual and the rest all write
-- r.name IN ('teacher', 'administrator') and ignore user_has_permission
-- entirely. Earlier work clearly met this same wall and routed around it; the
-- new table was the odd one out.
--
-- A global role (class_id IS NULL) is what grants this, matching how the app
-- already behaves: /classes shows a teacher every class, not only their own.

BEGIN;

DROP POLICY IF EXISTS "Teachers can create schedule series" ON class_schedule_series;
CREATE POLICY "Teachers can create schedule series"
  ON class_schedule_series FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Teachers can update schedule series" ON class_schedule_series;
CREATE POLICY "Teachers can update schedule series"
  ON class_schedule_series FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Teachers can delete schedule series" ON class_schedule_series;
CREATE POLICY "Teachers can delete schedule series"
  ON class_schedule_series FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Reading is unchanged in intent but restated so a teacher can see the
-- schedules of classes they are not enrolled in — the previous version only
-- let class_members read, which would have hidden every series from the very
-- people who manage them.
DROP POLICY IF EXISTS "Users can read schedule series" ON class_schedule_series;
CREATE POLICY "Users can read schedule series"
  ON class_schedule_series FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members cm
      WHERE cm.class_id = class_schedule_series.class_id
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

COMMIT;

-- ── Afterwards ────────────────────────────────────────────────────────────
-- Creating a repeating schedule from the dashboard calendar should now work
-- for an administrator as well as a teacher.
--
-- Worth knowing separately, and NOT changed here: class_occurrences still has
-- row level security switched off, from a file whose own first line calls it
-- "TEMPORARY: ... for testing". Any signed-in user can read, insert, update and
-- delete any class's sessions. Turning it back on needs its policies rewritten
-- the same way this file rewrites these, and it deserves its own change rather
-- than riding along with a bug fix.
