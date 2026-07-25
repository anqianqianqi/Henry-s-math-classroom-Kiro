-- TA Suggested Solutions Cache
-- Stores the TA's own clean solution to a problem, keyed by challenge/bank item.
-- Generated once, reused on all subsequent "Ask TA" calls.
-- Multiple solutions per problem are supported (different approaches).

CREATE TABLE IF NOT EXISTS ta_suggested_solutions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to problem — one of these will be set
  challenge_id   UUID REFERENCES daily_challenges(id) ON DELETE CASCADE,
  bank_item_id   UUID REFERENCES challenge_bank(id) ON DELETE CASCADE,

  -- The solution text (TA's own clean walkthrough)
  solution_text  TEXT NOT NULL,

  -- Optional: label the approach (e.g. "reciprocal substitution", "direct substitution")
  approach_label TEXT,

  created_at     TIMESTAMPTZ DEFAULT NOW(),

  -- Enforce: at least one of challenge_id or bank_item_id must be set
  CONSTRAINT has_problem_ref CHECK (challenge_id IS NOT NULL OR bank_item_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_ta_solutions_challenge  ON ta_suggested_solutions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_ta_solutions_bank_item  ON ta_suggested_solutions(bank_item_id);

-- RLS
ALTER TABLE ta_suggested_solutions ENABLE ROW LEVEL SECURITY;

-- Teachers and admins can read all
CREATE POLICY "Teachers can read ta_suggested_solutions"
  ON ta_suggested_solutions FOR SELECT
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
CREATE POLICY "Service role can manage ta_suggested_solutions"
  ON ta_suggested_solutions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
