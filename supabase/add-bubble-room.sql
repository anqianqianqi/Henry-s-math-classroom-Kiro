-- ============================================================
-- Bubble Room Q&A Feature — Database Migration
-- ============================================================
-- Creates:
--   bubble_room_questions  — student questions (class-scoped)
--   bubble_room_responses  — replies to questions
--   bubble_room_question_views — per-user view tracking for engagement scoring
--
-- RLS policies enforce class-level data isolation.
-- Requirements: 1.1, 8.1, 8.3, 8.4, 8.5
-- ============================================================

-- ── Questions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bubble_room_questions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     uuid        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id uuid        REFERENCES daily_challenges(id) ON DELETE SET NULL,
  text         text        NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brq_class_id   ON bubble_room_questions(class_id);
CREATE INDEX IF NOT EXISTS idx_brq_user_id    ON bubble_room_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_brq_created_at ON bubble_room_questions(class_id, created_at DESC);

-- ── Responses ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bubble_room_responses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid        NOT NULL REFERENCES bubble_room_questions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text        text        NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brr_question_id ON bubble_room_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_brr_user_id     ON bubble_room_responses(user_id);

-- ── Question Views ─────────────────────────────────────────
-- Tracks per-user views for engagement scoring.
-- One row per (question, user) pair — upserted when modal opens.
CREATE TABLE IF NOT EXISTS bubble_room_question_views (
  question_id uuid        NOT NULL REFERENCES bubble_room_questions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_brvw_question_id ON bubble_room_question_views(question_id);

-- ============================================================
-- Enable RLS
-- ============================================================
ALTER TABLE bubble_room_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bubble_room_responses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bubble_room_question_views ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies: bubble_room_questions
-- ============================================================

-- SELECT: only questions from classes the current user is a member of
DROP POLICY IF EXISTS "brq_select" ON bubble_room_questions;
CREATE POLICY "brq_select"
  ON bubble_room_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members cm
      WHERE cm.class_id = bubble_room_questions.class_id
        AND cm.user_id  = auth.uid()
    )
  );

-- INSERT: only into classes the user is a member of;
--         challenge_id class must match question class (Req 8.5)
DROP POLICY IF EXISTS "brq_insert" ON bubble_room_questions;
CREATE POLICY "brq_insert"
  ON bubble_room_questions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM class_members cm
      WHERE cm.class_id = bubble_room_questions.class_id
        AND cm.user_id  = auth.uid()
    )
    AND (
      challenge_id IS NULL
      OR EXISTS (
        SELECT 1 FROM challenge_assignments ca
        WHERE ca.challenge_id = bubble_room_questions.challenge_id
          AND ca.class_id     = bubble_room_questions.class_id
      )
    )
  );

-- DELETE: own question (any role) OR teacher role
DROP POLICY IF EXISTS "brq_delete" ON bubble_room_questions;
CREATE POLICY "brq_delete"
  ON bubble_room_questions FOR DELETE
  USING (
    user_id = auth.uid()
    OR user_has_permission(auth.uid(), 'class:update', class_id)
  );

-- ============================================================
-- RLS Policies: bubble_room_responses
-- ============================================================

-- SELECT: if the user can read the parent question (member of its class)
DROP POLICY IF EXISTS "brr_select" ON bubble_room_responses;
CREATE POLICY "brr_select"
  ON bubble_room_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM bubble_room_questions q
      JOIN class_members cm ON cm.class_id = q.class_id
      WHERE q.id       = bubble_room_responses.question_id
        AND cm.user_id = auth.uid()
    )
  );

-- INSERT: user is enrolled in the question's class
DROP POLICY IF EXISTS "brr_insert" ON bubble_room_responses;
CREATE POLICY "brr_insert"
  ON bubble_room_responses FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM bubble_room_questions q
      JOIN class_members cm ON cm.class_id = q.class_id
      WHERE q.id       = bubble_room_responses.question_id
        AND cm.user_id = auth.uid()
    )
  );

-- DELETE: own response OR teacher of the question's class
DROP POLICY IF EXISTS "brr_delete" ON bubble_room_responses;
CREATE POLICY "brr_delete"
  ON bubble_room_responses FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM bubble_room_questions q
      WHERE q.id = bubble_room_responses.question_id
        AND user_has_permission(auth.uid(), 'class:update', q.class_id)
    )
  );

-- ============================================================
-- RLS Policies: bubble_room_question_views
-- ============================================================

-- SELECT: enrolled students can read view records for their class's questions
DROP POLICY IF EXISTS "brvw_select" ON bubble_room_question_views;
CREATE POLICY "brvw_select"
  ON bubble_room_question_views FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM bubble_room_questions q
      JOIN class_members cm ON cm.class_id = q.class_id
      WHERE q.id       = bubble_room_question_views.question_id
        AND cm.user_id = auth.uid()
    )
  );

-- UPSERT (INSERT + UPDATE): users can only upsert their own view records
DROP POLICY IF EXISTS "brvw_upsert" ON bubble_room_question_views;
CREATE POLICY "brvw_upsert"
  ON bubble_room_question_views FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM bubble_room_questions q
      JOIN class_members cm ON cm.class_id = q.class_id
      WHERE q.id       = bubble_room_question_views.question_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "brvw_update" ON bubble_room_question_views;
CREATE POLICY "brvw_update"
  ON bubble_room_question_views FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
