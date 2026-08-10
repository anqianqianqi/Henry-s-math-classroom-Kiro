-- ── Recurrence, moved off the class and onto its own rows ─────────────────
--
-- A class stops having "a schedule". Sessions are authored on the dashboard
-- calendar instead: a teacher picks a class, a weekday and a time, and that
-- generates forward. classes.schedule goes away in a later change, once the
-- class list stops reading it.
--
-- ── WHY THE SERIES IS STORED AT ALL ───────────────────────
-- The first sketch had no recurring rule anywhere: expand a pattern into rows
-- and forget it. But the assignment window has to LIST existing recurring
-- schedules so they can be modified or deleted, and a single session has to
-- know whether it belongs to one so a delete can offer "this one" or "this and
-- all future". Neither is possible without keeping the series.
--
-- This is still not a schedule on the class. A class has zero or more series,
-- each with its own effective range, and nothing is stored on classes.
--
-- ── WHAT A NULL series_id MEANS ───────────────────────────
-- A one-off, added by hand on the calendar — "delete the series" does not
-- apply to it. It is also what an instance becomes once it has been edited on
-- its own: detaching it is how an individual change survives the series being
-- regenerated, rather than being silently overwritten by it. One nullable
-- column does both jobs.
--
-- Deleting a series NULLs series_id rather than cascading, so the sessions that
-- already happened stay exactly where they are. Removing future ones is the
-- UI's job and has to be explicit — see decouple-homework-from-occurrences.sql
-- for why a delete that reaches backwards is not something to leave to a
-- foreign key.
--
-- Run decouple-homework-from-occurrences.sql first.

BEGIN;

CREATE TABLE IF NOT EXISTS class_schedule_series (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,

  -- 0 = Sunday, matching JavaScript's Date.getDay() and the calendar grid, so
  -- no translation table sits between the picker and the row.
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,

  -- The window the pattern applies to. effective_until NULL means open-ended,
  -- which is why the generator asks for an end date rather than reading one:
  -- an unbounded series would have to decide for itself how far forward to go.
  effective_from  DATE NOT NULL,
  effective_until DATE,

  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT css_ends_after_start CHECK (end_time > start_time),
  CONSTRAINT css_range_ordered
    CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_css_class ON class_schedule_series(class_id);

ALTER TABLE class_occurrences
  ADD COLUMN IF NOT EXISTS series_id UUID
  REFERENCES class_schedule_series(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_occurrences_series ON class_occurrences(series_id);

COMMENT ON COLUMN class_occurrences.series_id IS
  'The recurring schedule that generated this session. NULL for a one-off added by hand, and NULL once an instance has been edited on its own — detaching is what lets an individual change survive the series being regenerated.';

-- ── Row level security ────────────────────────────────────────────────────
-- Mirrors the policies already on class_occurrences: a member of the class can
-- see when it meets, and changing it needs the same permission as changing a
-- session.
ALTER TABLE class_schedule_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read schedule series" ON class_schedule_series;
CREATE POLICY "Users can read schedule series"
  ON class_schedule_series FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members cm
       WHERE cm.class_id = class_schedule_series.class_id
         AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can create schedule series" ON class_schedule_series;
CREATE POLICY "Teachers can create schedule series"
  ON class_schedule_series FOR INSERT
  WITH CHECK (user_has_permission(auth.uid(), 'occurrence:manage', class_id));

DROP POLICY IF EXISTS "Teachers can update schedule series" ON class_schedule_series;
CREATE POLICY "Teachers can update schedule series"
  ON class_schedule_series FOR UPDATE
  USING (user_has_permission(auth.uid(), 'occurrence:manage', class_id));

DROP POLICY IF EXISTS "Teachers can delete schedule series" ON class_schedule_series;
CREATE POLICY "Teachers can delete schedule series"
  ON class_schedule_series FOR DELETE
  USING (user_has_permission(auth.uid(), 'occurrence:manage', class_id));

COMMIT;

-- ── Afterwards ────────────────────────────────────────────────────────────
-- Nothing writes to this table yet; the calendar's authoring UI is the next
-- change. Existing sessions keep series_id NULL, which is correct — they were
-- generated from classes.schedule by a pattern nobody kept, so none of them
-- belongs to a series that still exists.
--
--   SELECT COUNT(*) FROM class_occurrences WHERE series_id IS NULL;  -- all of them, for now
--
-- Two things the generator has to get right, neither of which the schema can
-- enforce:
--
--   session_number is assigned index+1 WITHIN a batch by generateOccurrences
--   (lib/utils/occurrences.ts). Called a second time on a class that already
--   has sessions it restarts at 1 and collides. It needs to continue from the
--   class's current maximum, or be recomputed across the class after insert.
--
--   Generation must never reach backwards. effective_from is the earliest a
--   series may produce a session, but the generator should start from the
--   later of that and today — a mid-term change to a time should not
--   retroactively rewrite sessions that already happened.
