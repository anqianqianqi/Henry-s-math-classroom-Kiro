-- Create separate challenge_bank table
-- Bank items are reusable templates; daily_challenges are published instances

CREATE TABLE IF NOT EXISTS challenge_bank (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tag_ids UUID[] DEFAULT '{}',
  max_points INTEGER DEFAULT 100,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE challenge_bank ENABLE ROW LEVEL SECURITY;

-- Teachers/admins can read all bank items
CREATE POLICY "Teachers can read challenge bank"
  ON challenge_bank FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );

-- Teachers/admins can insert bank items
CREATE POLICY "Teachers can insert challenge bank"
  ON challenge_bank FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );

-- Teachers/admins can update bank items
CREATE POLICY "Teachers can update challenge bank"
  ON challenge_bank FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );

-- Teachers/admins can delete bank items
CREATE POLICY "Teachers can delete challenge bank"
  ON challenge_bank FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );

-- Migrate existing bank items from daily_challenges
INSERT INTO challenge_bank (id, created_by, title, description, tag_ids, max_points, image_url, created_at, updated_at)
SELECT id, created_by, title, description, COALESCE(tag_ids, '{}'), COALESCE(max_points, 100), image_url, created_at, updated_at
FROM daily_challenges
WHERE is_pool = true;

-- Remove bank items from daily_challenges (they now live in challenge_bank)
DELETE FROM daily_challenges WHERE is_pool = true;
