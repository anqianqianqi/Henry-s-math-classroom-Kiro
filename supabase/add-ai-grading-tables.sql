-- AI Grading system tables
-- Run this in Supabase SQL editor

-- ── 1. Fine-tune job metadata ─────────────────────────────────────────────────
-- One row per fine-tune job launched. Stores OpenAI references + status.
CREATE TABLE IF NOT EXISTS ai_grading_config (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  openai_job_id        TEXT NOT NULL,
  openai_file_id       TEXT NOT NULL,
  model_id             TEXT,                          -- set once job completes
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','training','ready','failed')),
  examples_count       INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only admins/teachers should read/write this
ALTER TABLE ai_grading_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage ai_grading_config"
  ON ai_grading_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- ── 2. Henry's feedback on AI suggestions ────────────────────────────────────
-- Records what Henry thought of each AI suggestion — powers the next retrain.
CREATE TABLE IF NOT EXISTS ai_grading_feedback (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id   UUID REFERENCES challenge_submissions(id) ON DELETE CASCADE NOT NULL,
  ai_suggestion   TEXT NOT NULL,         -- what the model proposed (comment + points)
  action          TEXT NOT NULL
                    CHECK (action IN ('used','edited','regenerated','ignored')),
  final_comment   TEXT,                  -- what Henry actually wrote (null if ignored)
  final_points    INTEGER,               -- what Henry actually graded (null if ignored)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_grading_feedback_submission ON ai_grading_feedback(submission_id);
CREATE INDEX idx_ai_grading_feedback_action ON ai_grading_feedback(action);

ALTER TABLE ai_grading_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage ai_grading_feedback"
  ON ai_grading_feedback
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );
