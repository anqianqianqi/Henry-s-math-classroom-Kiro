-- Reusable tags table for challenges
CREATE TABLE IF NOT EXISTS challenge_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE challenge_tags ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read tags
CREATE POLICY "Anyone can read tags" ON challenge_tags FOR SELECT TO authenticated USING (true);

-- Teachers can create tags
CREATE POLICY "Teachers can create tags" ON challenge_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Teachers can delete tags
CREATE POLICY "Teachers can delete tags" ON challenge_tags FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );
