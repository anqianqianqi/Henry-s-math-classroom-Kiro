-- Mega Teaching Material Workflows
-- One row per workflow run. Stores the challenge snapshot, each step's raw
-- agent output and Henry's approved (possibly edited) version separately.
-- Henry can close the browser mid-workflow and resume exactly where he left off.

CREATE TABLE IF NOT EXISTS mega_workflows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source challenge — exactly one must be non-null
  challenge_id     UUID REFERENCES daily_challenges(id) ON DELETE SET NULL,
  bank_item_id     UUID REFERENCES challenge_bank(id)   ON DELETE SET NULL,

  created_by       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Snapshot of challenge at workflow creation time so workflow stays coherent
  -- even if the original challenge is edited later
  challenge_title     TEXT NOT NULL,
  challenge_body      TEXT NOT NULL,
  challenge_image_url TEXT,   -- null if no image; passed to vision model in step 1

  -- Workflow progress
  status TEXT NOT NULL DEFAULT 'step1_pending'
    CHECK (status IN (
      'step1_pending', 'step1_done',
      'step2_pending', 'step2_done',
      'step3_pending', 'step3_done',
      'step4_pending', 'completed'
    )),

  -- Raw agent outputs (what OpenAI produced before Henry touched it)
  step1_raw JSONB,
  step2_raw JSONB,
  step3_raw JSONB,
  step4_raw JSONB,

  -- Approved outputs (what Henry approved, possibly after editing)
  -- step1: { answer, solution_steps[], common_mistakes[], core_trap, teaching_hook, difficulty_note }
  -- step2: { core_concept, student_insight, teaching_angle, connection_to_prior_knowledge, story_hook, challenge_extension }
  -- step3: { selected_pitch: StoryPitch, all_pitches: StoryPitch[] }
  -- step4: { story_intro, challenge, solution[], key_insight, common_traps[], challenge_yourself }
  step1_output JSONB,
  step2_output JSONB,
  step3_output JSONB,
  step4_output JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_mega_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mega_workflows_updated_at
  BEFORE UPDATE ON mega_workflows
  FOR EACH ROW EXECUTE FUNCTION update_mega_workflows_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mega_workflows_created_by   ON mega_workflows(created_by);
CREATE INDEX IF NOT EXISTS idx_mega_workflows_challenge_id ON mega_workflows(challenge_id);
CREATE INDEX IF NOT EXISTS idx_mega_workflows_bank_item_id ON mega_workflows(bank_item_id);
CREATE INDEX IF NOT EXISTS idx_mega_workflows_status       ON mega_workflows(status);

-- RLS
ALTER TABLE mega_workflows ENABLE ROW LEVEL SECURITY;

-- Teachers see their own workflows
CREATE POLICY "Teachers can read own mega_workflows"
  ON mega_workflows FOR SELECT
  USING (created_by = auth.uid());

-- Admins see all
CREATE POLICY "Admins can read all mega_workflows"
  ON mega_workflows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name = 'administrator'
    )
  );

-- All writes go through API routes (service role only)
CREATE POLICY "Service role manages mega_workflows"
  ON mega_workflows FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
