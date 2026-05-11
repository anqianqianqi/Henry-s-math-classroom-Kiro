-- Generative Challenge Templates
-- Extends challenge_templates with generative fields and adds template tracking to daily_challenges

-- ============================================
-- EXTEND challenge_templates TABLE
-- ============================================

ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS is_generative BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS title_template TEXT;
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS description_template TEXT;
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS variables JSONB;
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS answer_formula TEXT;
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS max_points INTEGER NOT NULL DEFAULT 10;
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS tag_ids UUID[] DEFAULT '{}';

-- ============================================
-- EXTEND daily_challenges TABLE
-- ============================================

ALTER TABLE daily_challenges ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES challenge_templates(id);
ALTER TABLE daily_challenges ADD COLUMN IF NOT EXISTS expected_answer TEXT;

-- ============================================
-- INDEXES
-- ============================================

-- Partial unique index for deduplication: same template + same title = duplicate
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_challenges_template_title
  ON daily_challenges(template_id, title)
  WHERE template_id IS NOT NULL;

-- Index for looking up generative templates
CREATE INDEX IF NOT EXISTS idx_challenge_templates_generative
  ON challenge_templates(is_generative)
  WHERE is_generative = true;

-- GIN index for tag overlap queries on challenge_templates
CREATE INDEX IF NOT EXISTS idx_challenge_templates_tag_ids
  ON challenge_templates USING GIN(tag_ids);

-- ============================================
-- RLS POLICIES FOR GENERATIVE TEMPLATES
-- ============================================

-- Teachers can read all generative templates
CREATE POLICY "Teachers can read generative templates"
  ON challenge_templates FOR SELECT TO authenticated
  USING (
    is_generative = true
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Teachers can create generative templates
CREATE POLICY "Teachers can create generative templates"
  ON challenge_templates FOR INSERT TO authenticated
  WITH CHECK (
    is_generative = true
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Teachers can update generative templates
CREATE POLICY "Teachers can update generative templates"
  ON challenge_templates FOR UPDATE TO authenticated
  USING (
    is_generative = true
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Teachers can delete generative templates
CREATE POLICY "Teachers can delete generative templates"
  ON challenge_templates FOR DELETE TO authenticated
  USING (
    is_generative = true
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- ============================================
-- GRANTS
-- ============================================

GRANT ALL ON challenge_templates TO authenticated;
GRANT ALL ON challenge_templates TO anon;

-- Notify PostgREST to reload schema cache
SELECT pg_notify('pgrst', 'reload schema');
