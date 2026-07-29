-- ============================================================
-- Bubble Room Question Assignments
-- Allows question creators to assign a question to specific
-- teachers or TA badge holders for a targeted response.
-- ============================================================

CREATE TABLE IF NOT EXISTS bubble_room_question_assignments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  uuid        NOT NULL REFERENCES bubble_room_questions(id) ON DELETE CASCADE,
  assignee_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  responded_at timestamptz,          -- set when assignee posts a response
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, assignee_id)  -- one assignment per (question, person)
);

CREATE INDEX IF NOT EXISTS idx_brqa_question   ON bubble_room_question_assignments(question_id);
CREATE INDEX IF NOT EXISTS idx_brqa_assignee   ON bubble_room_question_assignments(assignee_id);
CREATE INDEX IF NOT EXISTS idx_brqa_pending    ON bubble_room_question_assignments(assignee_id) WHERE responded_at IS NULL;

ALTER TABLE bubble_room_question_assignments ENABLE ROW LEVEL SECURITY;

-- Assignee can see their own assignments
DROP POLICY IF EXISTS "brqa_select_assignee" ON bubble_room_question_assignments;
CREATE POLICY "brqa_select_assignee"
  ON bubble_room_question_assignments FOR SELECT
  USING (assignee_id = auth.uid() OR assigned_by = auth.uid());

-- Anyone authenticated can create assignments (they are the assigned_by)
DROP POLICY IF EXISTS "brqa_insert" ON bubble_room_question_assignments;
CREATE POLICY "brqa_insert"
  ON bubble_room_question_assignments FOR INSERT
  WITH CHECK (assigned_by = auth.uid() AND auth.uid() IS NOT NULL);

-- Assignee can mark as responded (UPDATE responded_at)
DROP POLICY IF EXISTS "brqa_update" ON bubble_room_question_assignments;
CREATE POLICY "brqa_update"
  ON bubble_room_question_assignments FOR UPDATE
  USING (assignee_id = auth.uid());
