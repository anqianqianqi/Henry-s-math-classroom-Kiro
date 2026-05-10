-- First drop old tables if they exist (from failed previous attempts)
DROP TABLE IF EXISTS tag_group_names CASCADE;
DROP TABLE IF EXISTS tag_groups CASCADE;

-- Tag Groups: group multiple tags into a preset for quick assignment
CREATE TABLE tag_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction table: which tags belong to which group
CREATE TABLE tag_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES tag_groups(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES challenge_tags(id) ON DELETE CASCADE,
  UNIQUE(group_id, tag_id)
);

-- Multilingual group names
CREATE TABLE tag_group_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES tag_groups(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(group_id, language)
);

-- RLS
ALTER TABLE tag_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_group_names ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can view tag groups" ON tag_groups FOR SELECT USING (true);
CREATE POLICY "Anyone can view tag group members" ON tag_group_members FOR SELECT USING (true);
CREATE POLICY "Anyone can view tag group names" ON tag_group_names FOR SELECT USING (true);

-- Teachers can manage
CREATE POLICY "Teachers can insert tag groups" ON tag_groups FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND ur.class_id IS NULL AND r.name IN ('teacher', 'administrator')
  ));
CREATE POLICY "Teachers can update tag groups" ON tag_groups FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND ur.class_id IS NULL AND r.name IN ('teacher', 'administrator')
  ));
CREATE POLICY "Teachers can delete tag groups" ON tag_groups FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND ur.class_id IS NULL AND r.name IN ('teacher', 'administrator')
  ));

CREATE POLICY "Teachers can insert tag group members" ON tag_group_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND ur.class_id IS NULL AND r.name IN ('teacher', 'administrator')
  ));
CREATE POLICY "Teachers can delete tag group members" ON tag_group_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND ur.class_id IS NULL AND r.name IN ('teacher', 'administrator')
  ));

CREATE POLICY "Teachers can insert tag group names" ON tag_group_names FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND ur.class_id IS NULL AND r.name IN ('teacher', 'administrator')
  ));
CREATE POLICY "Teachers can update tag group names" ON tag_group_names FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND ur.class_id IS NULL AND r.name IN ('teacher', 'administrator')
  ));
CREATE POLICY "Teachers can delete tag group names" ON tag_group_names FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND ur.class_id IS NULL AND r.name IN ('teacher', 'administrator')
  ));

NOTIFY pgrst, 'reload schema';
