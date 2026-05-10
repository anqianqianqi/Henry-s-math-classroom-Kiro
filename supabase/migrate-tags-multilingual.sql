-- Multilingual Tag System Migration
-- Tags have a unique ID and multiple language versions of their name

-- Drop old table if exists (we're replacing it)
DROP TABLE IF EXISTS challenge_tags CASCADE;

-- New tag table - just the ID and a slug for internal reference
CREATE TABLE challenge_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tag names in different languages
CREATE TABLE challenge_tag_names (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_id UUID NOT NULL REFERENCES challenge_tags(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('en', 'zh')),
  name TEXT NOT NULL,
  UNIQUE(tag_id, language)
);

-- Index for fast lookup
CREATE INDEX idx_tag_names_tag ON challenge_tag_names(tag_id);
CREATE INDEX idx_tag_names_lang ON challenge_tag_names(language);

-- RLS
ALTER TABLE challenge_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_tag_names ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "Anyone can read tags" ON challenge_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read tag names" ON challenge_tag_names FOR SELECT TO authenticated USING (true);

-- Teachers can manage
CREATE POLICY "Teachers can create tags" ON challenge_tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('teacher', 'administrator') AND ur.class_id IS NULL));
CREATE POLICY "Teachers can delete tags" ON challenge_tags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('teacher', 'administrator') AND ur.class_id IS NULL));

CREATE POLICY "Teachers can create tag names" ON challenge_tag_names FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('teacher', 'administrator') AND ur.class_id IS NULL));
CREATE POLICY "Teachers can update tag names" ON challenge_tag_names FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('teacher', 'administrator') AND ur.class_id IS NULL));
CREATE POLICY "Teachers can delete tag names" ON challenge_tag_names FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('teacher', 'administrator') AND ur.class_id IS NULL));

-- Change daily_challenges.tags from TEXT[] to UUID[] for tag IDs
-- (If tags column already exists as TEXT[], drop and recreate)
ALTER TABLE daily_challenges DROP COLUMN IF EXISTS tags;
ALTER TABLE daily_challenges ADD COLUMN tag_ids UUID[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_challenges_tag_ids ON daily_challenges USING GIN(tag_ids);
