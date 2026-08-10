-- ── Still "violates row-level security policy" ────────────────────────────
--
-- The previous fix swapped user_has_permission for an inline check:
--
--   EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
--            WHERE ur.user_id = auth.uid()
--              AND r.name IN ('teacher', 'administrator')
--              AND ur.class_id IS NULL)
--
-- That is three conditions, and it takes only one of them to be wrong for the
-- insert to be refused with no indication of which:
--
--   1. THE ROLE NAME. This codebase is not consistent about it. Two pages —
--      app/classes/page.tsx and app/classes/[id]/page.tsx — accept 'admin'
--      AND 'administrator', which is not something anyone writes unless both
--      have been seen in a real database. seed.sql creates neither.
--
--   2. class_id IS NULL. It requires the role to be GLOBAL. An account whose
--      administrator row is scoped to a class fails, even though it is plainly
--      an administrator.
--
--   3. RLS on the tables being read. A policy body runs as the calling user,
--      so the subquery is itself subject to user_roles' policies. That is why
--      user_has_permission was written SECURITY DEFINER — and inlining the
--      query threw that protection away. (user_roles does allow a user to read
--      their own rows, so this is the least likely of the three here, but it
--      is the one that would be hardest to see.)
--
-- ── ONE FUNCTION INSTEAD OF THREE CONDITIONS ──────────────
-- SECURITY DEFINER, so it is not at the mercy of the policies on user_roles.
-- Accepts every spelling the application accepts. Does not care whether the
-- role is global or class-scoped: an account holding a teacher or admin role
-- at all is one that manages classes, and per-class membership roles live in
-- class_members, not here.
--
-- Both tables use it, so there is one definition of "may change a timetable"
-- rather than a copy per policy that can drift.

BEGIN;

CREATE OR REPLACE FUNCTION is_class_manager(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = p_user_id
       AND r.name IN ('teacher', 'administrator', 'admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION is_class_manager IS
  'True if this user may author class timetables. SECURITY DEFINER so it is not subject to RLS on user_roles. Accepts admin and administrator because both spellings exist in this database and the app checks for both.';

-- ── class_schedule_series ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers can create schedule series" ON class_schedule_series;
CREATE POLICY "Teachers can create schedule series"
  ON class_schedule_series FOR INSERT
  WITH CHECK (is_class_manager());

DROP POLICY IF EXISTS "Teachers can update schedule series" ON class_schedule_series;
CREATE POLICY "Teachers can update schedule series"
  ON class_schedule_series FOR UPDATE
  USING (is_class_manager());

DROP POLICY IF EXISTS "Teachers can delete schedule series" ON class_schedule_series;
CREATE POLICY "Teachers can delete schedule series"
  ON class_schedule_series FOR DELETE
  USING (is_class_manager());

DROP POLICY IF EXISTS "Users can read schedule series" ON class_schedule_series;
CREATE POLICY "Users can read schedule series"
  ON class_schedule_series FOR SELECT
  USING (
    is_class_manager()
    OR EXISTS (
      SELECT 1 FROM class_members cm
      WHERE cm.class_id = class_schedule_series.class_id
        AND cm.user_id = auth.uid()
    )
  );

-- ── class_occurrences ─────────────────────────────────────────────────────
-- Restated through the same function. If restore-class-occurrences-rls.sql has
-- not been run yet these simply replace policies that are not being enforced,
-- and running it afterwards is still correct.
DROP POLICY IF EXISTS "Teachers can insert occurrences" ON class_occurrences;
CREATE POLICY "Teachers can insert occurrences"
  ON class_occurrences FOR INSERT
  WITH CHECK (is_class_manager());

DROP POLICY IF EXISTS "Teachers can update occurrences" ON class_occurrences;
CREATE POLICY "Teachers can update occurrences"
  ON class_occurrences FOR UPDATE
  USING (is_class_manager());

DROP POLICY IF EXISTS "Teachers can delete occurrences" ON class_occurrences;
CREATE POLICY "Teachers can delete occurrences"
  ON class_occurrences FOR DELETE
  USING (is_class_manager());

DROP POLICY IF EXISTS "Users can read class occurrences" ON class_occurrences;
CREATE POLICY "Users can read class occurrences"
  ON class_occurrences FOR SELECT
  USING (
    is_class_manager()
    OR EXISTS (
      SELECT 1 FROM class_members cm
      WHERE cm.class_id = class_occurrences.class_id
        AND cm.user_id = auth.uid()
    )
  );

COMMIT;

-- ── Confirm, and find out which of the three it was ───────────────────────
-- Run this signed in as the account that was refused. It answers the question
-- rather than leaving it inferred from whether the button works.
--
--   SELECT
--     auth.uid()                                   AS me,
--     is_class_manager()                           AS may_manage_now,
--     (SELECT json_agg(json_build_object(
--        'role', r.name, 'class_id', ur.class_id))
--        FROM user_roles ur JOIN roles r ON r.id = ur.role_id
--       WHERE ur.user_id = auth.uid())             AS my_roles;
--
-- may_manage_now must be true. my_roles shows which of the two likely causes
-- it was: a role named 'admin' rather than 'administrator', or a class_id that
-- is not null. Worth knowing — the same trap is waiting in any policy written
-- against this schema.
