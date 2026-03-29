-- STEP 1: Fix class_members
DROP POLICY IF EXISTS "Teachers can manage members"
  ON class_members;

CREATE POLICY "Teachers can manage members"
  ON class_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_members.class_id
      AND classes.created_by = auth.uid()
    )
  );

-- STEP 2: Fix user_roles
DROP POLICY IF EXISTS "Teachers can read all roles"
  ON user_roles;

DROP POLICY IF EXISTS "Teachers can manage roles"
  ON user_roles;

CREATE POLICY "Authenticated can read all roles"
  ON user_roles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Teachers can insert roles"
  ON user_roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.created_by = auth.uid()
    )
  );

CREATE POLICY "Teachers can update roles"
  ON user_roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.created_by = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete roles"
  ON user_roles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.created_by = auth.uid()
    )
  );

-- STEP 3: Fix daily_challenges
DROP POLICY IF EXISTS "Teachers can manage challenges"
  ON daily_challenges;

CREATE POLICY "Teachers can manage challenges"
  ON daily_challenges FOR ALL
  USING (auth.uid() = created_by);

-- STEP 4: Fix challenge_assignments
DROP POLICY IF EXISTS "Teachers can manage assignments"
  ON challenge_assignments;

CREATE POLICY "Teachers can manage assignments"
  ON challenge_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM daily_challenges dc
      WHERE dc.id = challenge_assignments.challenge_id
      AND dc.created_by = auth.uid()
    )
  );

-- STEP 5: Fix class_occurrences
DROP POLICY IF EXISTS "Teachers can manage occurrences"
  ON class_occurrences;

CREATE POLICY "Teachers can manage occurrences"
  ON class_occurrences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_occurrences.class_id
      AND classes.created_by = auth.uid()
    )
  );

-- STEP 6: Fix session_materials
DROP POLICY IF EXISTS "Teachers can manage materials"
  ON session_materials;

CREATE POLICY "Teachers can manage materials"
  ON session_materials FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM class_occurrences co
      JOIN classes c ON c.id = co.class_id
      WHERE co.id = session_materials.occurrence_id
      AND c.created_by = auth.uid()
    )
  );

-- STEP 7: Fix homework_assignments
DROP POLICY IF EXISTS "Teachers can manage homework"
  ON homework_assignments;

CREATE POLICY "Teachers can manage homework"
  ON homework_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM class_occurrences co
      JOIN classes c ON c.id = co.class_id
      WHERE co.id = homework_assignments.occurrence_id
      AND c.created_by = auth.uid()
    )
  );
