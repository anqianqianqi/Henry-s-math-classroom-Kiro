-- Challenge Templates System
-- Allows teachers to save challenges as reusable templates

-- ============================================
-- CHALLENGE TEMPLATES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS challenge_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_challenge_templates_created_by ON challenge_templates(created_by);
CREATE INDEX idx_challenge_templates_public ON challenge_templates(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_challenge_templates_created_at ON challenge_templates(created_at DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE challenge_templates ENABLE ROW LEVEL SECURITY;

-- Users can read their own templates
CREATE POLICY "Users can read own templates"
  ON challenge_templates FOR SELECT
  USING (created_by = auth.uid());

-- Users can read public templates
CREATE POLICY "Users can read public templates"
  ON challenge_templates FOR SELECT
  USING (is_public = TRUE);

-- Users can create templates
CREATE POLICY "Users can create templates"
  ON challenge_templates FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Users can update their own templates
CREATE POLICY "Users can update own templates"
  ON challenge_templates FOR UPDATE
  USING (created_by = auth.uid());

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates"
  ON challenge_templates FOR DELETE
  USING (created_by = auth.uid());

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to create template from challenge
CREATE OR REPLACE FUNCTION create_template_from_challenge(
  p_challenge_id UUID,
  p_template_title TEXT DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
  v_template_id UUID;
  v_challenge RECORD;
BEGIN
  -- Get challenge data
  SELECT * INTO v_challenge
  FROM daily_challenges
  WHERE id = p_challenge_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;
  
  -- Create template
  INSERT INTO challenge_templates (
    title,
    description,
    created_by,
    image_url,
    is_public
  )
  VALUES (
    COALESCE(p_template_title, v_challenge.title || ' (Template)'),
    v_challenge.description,
    auth.uid(),
    v_challenge.image_url,
    p_is_public
  )
  RETURNING id INTO v_template_id;
  
  RETURN v_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create challenge from template
CREATE OR REPLACE FUNCTION create_challenge_from_template(
  p_template_id UUID,
  p_challenge_date DATE,
  p_title TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_challenge_id UUID;
  v_template RECORD;
BEGIN
  -- Get template data
  SELECT * INTO v_template
  FROM challenge_templates
  WHERE id = p_template_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;
  
  -- Create challenge
  INSERT INTO daily_challenges (
    title,
    description,
    challenge_date,
    created_by,
    image_url
  )
  VALUES (
    COALESCE(p_title, v_template.title),
    v_template.description,
    p_challenge_date,
    auth.uid(),
    v_template.image_url
  )
  RETURNING id INTO v_challenge_id;
  
  -- Increment usage count
  UPDATE challenge_templates
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = p_template_id;
  
  RETURN v_challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check templates table
-- SELECT * FROM challenge_templates ORDER BY created_at DESC;

-- Test creating template from challenge
-- SELECT create_template_from_challenge('CHALLENGE_ID', 'My Template', FALSE);

-- Test creating challenge from template
-- SELECT create_challenge_from_template('TEMPLATE_ID', '2026-03-15', 'New Challenge');
