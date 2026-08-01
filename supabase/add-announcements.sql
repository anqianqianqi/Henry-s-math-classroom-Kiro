-- ============================================================
-- Announcements — the "New Feature" button
-- ============================================================
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Purely additive: two new tables and their policies. Nothing existing is
-- altered, so nothing currently working can regress from this migration.
--
-- ── APPEND-ONLY ─────────────────────────────────────────────
-- announcements is never edited in place. Saving new text DEACTIVATES the
-- current row and INSERTS a new one, so the table is itself the modification
-- timeline — every version, who wrote it, when. That is also what resets the
-- shine: a new row has a new id, so no student has a view row for it, so
-- everyone sees it shine again. The reset falls out of the data model rather
-- than being a step someone has to remember.
--
-- ── THE FOUR GUARDS ─────────────────────────────────────────
--   one_active_announcement   at most one live announcement
--   body not blank            an empty save cannot blank the announcement
--   no in-place body UPDATE   an edit that skipped history and skipped the reset
--   no duplicate insert       pressing Save without typing re-shining the school
--
-- The last two are triggers rather than application checks because this
-- database is edited directly with SQL, and both failures are invisible until
-- students have already been affected — you cannot un-shine 200 people.
-- ============================================================

-- ── Announcements ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What the admin typed. Never updated; a change means a new row.
  body            TEXT NOT NULL CHECK (length(btrim(body)) > 0),

  -- Filled on first read in the other language, by /api/i18n/translate-post.
  body_en         TEXT,
  body_zh         TEXT,
  body_lang       TEXT CHECK (body_lang IS NULL OR body_lang IN ('en', 'zh', 'other')),

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES auth.users(id),
  deactivated_at  TIMESTAMPTZ,
  deactivated_by  UUID REFERENCES auth.users(id)
);

-- At most one live announcement, enforced by the database rather than by
-- every caller remembering to deactivate the old one first.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_announcement
  ON announcements (is_active) WHERE is_active;

-- The timeline is read newest-first.
CREATE INDEX IF NOT EXISTS announcements_created_at_idx
  ON announcements (created_at DESC);

-- ── Who has seen the current announcement ───────────────────

CREATE TABLE IF NOT EXISTS announcement_views (
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  -- Written the first time the button RENDERS for this student, not on click:
  -- somebody who never opens it should still stop being shone at.
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (announcement_id, user_id)
);

-- ── Guard: the body is immutable ────────────────────────────
-- Deactivating a row is allowed; rewording one is not. An in-place edit would
-- lose the previous text and leave every student's view row intact, so nobody
-- would see that anything had changed.

CREATE OR REPLACE FUNCTION announcements_body_is_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    RAISE EXCEPTION
      'announcements.body is immutable — insert a new row instead (see supabase/add-announcements.sql)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS announcements_no_body_update ON announcements;
CREATE TRIGGER announcements_no_body_update
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION announcements_body_is_immutable();

-- ── Guard: re-posting identical text is a no-op ─────────────
-- Opening the panel and pressing Save without typing would otherwise insert a
-- row, and every student would be shone at for three days over nothing.
-- Returning NULL skips the insert silently, which is the honest outcome: the
-- announcement genuinely did not change.
--
-- Comparison is on trimmed text, so a stray trailing newline is not a new
-- announcement either.

CREATE OR REPLACE FUNCTION announcements_skip_if_unchanged()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM announcements
    WHERE is_active AND btrim(body) = btrim(NEW.body)
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS announcements_no_duplicate ON announcements;
CREATE TRIGGER announcements_no_duplicate
  BEFORE INSERT ON announcements
  FOR EACH ROW EXECUTE FUNCTION announcements_skip_if_unchanged();

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE announcements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_views ENABLE ROW LEVEL SECURITY;

-- Everyone signed in reads the live announcement. Deactivated rows are the
-- history and are not exposed to students; the server reads them with the
-- service role when it needs to.
DROP POLICY IF EXISTS "Anyone signed in can read the active announcement" ON announcements;
CREATE POLICY "Anyone signed in can read the active announcement"
  ON announcements FOR SELECT
  USING (is_active AND auth.uid() IS NOT NULL);

-- Teachers and administrators read the whole timeline.
DROP POLICY IF EXISTS "Staff can read every announcement" ON announcements;
CREATE POLICY "Staff can read every announcement"
  ON announcements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Staff can post announcements" ON announcements;
CREATE POLICY "Staff can post announcements"
  ON announcements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Update is only ever used to deactivate; the trigger above blocks anything else.
DROP POLICY IF EXISTS "Staff can retire announcements" ON announcements;
CREATE POLICY "Staff can retire announcements"
  ON announcements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- A student may only ever see and write their own view row.
DROP POLICY IF EXISTS "Read own announcement views" ON announcement_views;
CREATE POLICY "Read own announcement views"
  ON announcement_views FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Record own announcement view" ON announcement_views;
CREATE POLICY "Record own announcement view"
  ON announcement_views FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ── Check ───────────────────────────────────────────────────
-- Expect two rows, both with rowsecurity = true.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('announcements', 'announcement_views');
