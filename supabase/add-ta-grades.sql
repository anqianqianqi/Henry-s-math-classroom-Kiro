-- TA Agent Grades Table
-- Stores AI-suggested grades for Henry to review before they go live.
-- Henry sees the suggestion + full reasoning, then accepts or overrides.

CREATE TABLE IF NOT EXISTS ta_grades (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id    UUID NOT NULL REFERENCES challenge_submissions(id) ON DELETE CASCADE,
  challenge_id     UUID NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- The AI's output
  suggested_score  INTEGER NOT NULL,
  max_score        INTEGER NOT NULL,
  confidence       NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  suggested_comment TEXT NOT NULL,

  -- The 8-step reasoning (stored for Henry's review and for learning)
  reasoning        JSONB NOT NULL DEFAULT '{}',

  -- Review status
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'overridden')),

  -- If Henry overrides: what did he actually give?
  henry_score      INTEGER,
  henry_comment    TEXT,
  override_reason  TEXT,
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES profiles(id),

  created_at       TIMESTAMPTZ DEFAULT NOW(),

  -- One AI grade per submission (re-running replaces)
  UNIQUE(submission_id)
);

CREATE INDEX IF NOT EXISTS idx_ta_grades_submission   ON ta_grades(submission_id);
CREATE INDEX IF NOT EXISTS idx_ta_grades_status       ON ta_grades(status);
CREATE INDEX IF NOT EXISTS idx_ta_grades_student      ON ta_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_ta_grades_challenge    ON ta_grades(challenge_id);

-- RLS
ALTER TABLE ta_grades ENABLE ROW LEVEL SECURITY;

-- Teachers and admins can read all
CREATE POLICY "Teachers can read ta_grades"
  ON ta_grades FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );

-- Only the service role (API routes) can insert/update
-- (no direct client writes — grades come from the API route only)
CREATE POLICY "Service role can manage ta_grades"
  ON ta_grades FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
