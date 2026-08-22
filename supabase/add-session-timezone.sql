-- ── Which clock a session's time was written on ───────────────────────────
--
-- class_occurrences.start_time is a bare TIME. "16:00" is 16:00 somewhere, and
-- until now nothing on the row said where — its meaning was inherited from
-- classes.timezone, set once when the class was created, from the creating
-- teacher's own zone.
--
-- That held while only the class's creator could set its schedule. The
-- dashboard calendar lists every class, so an administrator in one zone can now
-- schedule a class whose timezone belongs to a teacher in another. They type
-- 19:00 looking at their own clock and it is stored, then read back, as 19:00
-- on someone else's. Silently out by however far apart they are.
--
-- ── WHY ON THE ROW AND NOT ON THE CLASS ───────────────────
-- A session is a fact about a particular afternoon. Once it exists, what it
-- means must not change because someone edited the class, or because the
-- teacher who created it moved house. Storing the zone alongside the time makes
-- each session self-describing and immune to both.
--
-- It also lets one class hold sessions authored from different places, which a
-- single column on classes cannot express and which is exactly what happens
-- when a teacher covers for another.
--
-- ── NULLABLE ON PURPOSE ───────────────────────────────────
-- Backfilled from classes.timezone, which is the correct answer for every row
-- that exists: those sessions were generated from a schedule that meant the
-- class's zone. Left nullable rather than constrained so a client that has not
-- been redeployed keeps working — the reader falls back to the class's zone,
-- which is what it would have used anyway.

BEGIN;

ALTER TABLE class_occurrences
  ADD COLUMN IF NOT EXISTS timezone TEXT;

ALTER TABLE class_schedule_series
  ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Every existing session was expanded from classes.schedule, which meant the
-- class's zone. COALESCE to the school's for any class predating that column.
UPDATE class_occurrences co
   SET timezone = COALESCE(c.timezone, 'America/New_York')
  FROM classes c
 WHERE c.id = co.class_id
   AND co.timezone IS NULL;

UPDATE class_schedule_series s
   SET timezone = COALESCE(c.timezone, 'America/New_York')
  FROM classes c
 WHERE c.id = s.class_id
   AND s.timezone IS NULL;

COMMENT ON COLUMN class_occurrences.timezone IS
  'IANA zone the start_time and end_time on this row are written in — the zone of whoever scheduled it. NULL falls back to classes.timezone. Never an offset: the school observes daylight saving, so an offset would be an hour out for half the year.';

COMMENT ON COLUMN class_schedule_series.timezone IS
  'IANA zone this schedule''s times are written in. Copied onto every session it generates, so a session keeps its meaning even if the series is later changed from somewhere else.';

COMMIT;

-- ── Afterwards ────────────────────────────────────────────────────────────
-- Should be 0 — every session knows its clock:
--
--   SELECT COUNT(*) FROM class_occurrences WHERE timezone IS NULL;
--
-- And worth an eye, because it is the number this whole change is about:
--
--   SELECT c.name, co.occurrence_date, co.start_time, co.timezone
--     FROM class_occurrences co JOIN classes c ON c.id = co.class_id
--    WHERE co.occurrence_date >= CURRENT_DATE
--    ORDER BY co.occurrence_date LIMIT 20;
--
-- A student in Shanghai reading a 21:00 New York class sees it at 09:00 the
-- following morning, on the following day's cell. That is correct, and it is
-- the case to check first — a calendar that converted the time but kept the
-- stored date would look right to anyone testing from New York.
