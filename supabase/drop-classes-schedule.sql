-- ── The last of the weekly schedule ───────────────────────────────────────
--
-- classes.schedule held a weekly pattern — Mondays and Wednesdays at four —
-- from which sessions were expanded. Sessions are now authored on the dashboard
-- calendar, one day or one repeating run at a time, and class_schedule_series
-- holds the recurrence. Nothing reads this column any more.
--
-- ── RUN THIS LAST ─────────────────────────────────────────
-- Every one of these has to have shipped first, or dropping the column takes a
-- working screen down with it:
--
--   classes/new           the schedule field, its validation and the
--                         occurrence generation on create. It was also part of
--                         isFormValid, so until that changed a class could not
--                         be created without one.
--   classes/[id]/edit     the schedule field and the write.
--   classes/[id]          the two places it was displayed, and the
--                         "+ Sessions" button that generated from it.
--   classes, classes/explore
--                         both showed it under "Schedule". They now derive the
--                         pattern from upcoming class_occurrences — see
--                         lib/classSchedule/derive.ts. This is the one that
--                         would have been noticed by students rather than by
--                         a teacher.
--   SessionsList          silently topped a class up to five upcoming sessions
--                         from this column. That one mattered most: it would
--                         have put back sessions a teacher had just deleted
--                         from the calendar, from a different screen, with no
--                         indication it had happened.
--
-- ── WHAT IS NOT LOST ──────────────────────────────────────
-- Every session ever generated from this column is a row in class_occurrences
-- and is untouched. What goes is the rule, not the history.
--
-- Irreversible in the sense that the JSONB is gone. If that is a worry, take
-- the backup below first — it costs nothing and can be dropped later.

BEGIN;

-- Uncomment to keep a copy of the patterns before they go.
-- CREATE TABLE classes_schedule_backup AS
--   SELECT id, name, schedule, NOW() AS archived_at
--     FROM classes
--    WHERE schedule IS NOT NULL;

ALTER TABLE classes DROP COLUMN IF EXISTS schedule;

COMMIT;

-- ── Afterwards ────────────────────────────────────────────────────────────
-- Should return no rows:
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'classes' AND column_name = 'schedule';
--
-- And the screens that used to read it: /classes and /classes/explore should
-- still show when each class meets, now derived from its upcoming sessions. A
-- class with nothing scheduled correctly shows nothing rather than a pattern
-- left over from last term.
