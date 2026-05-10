-- Challenge Scheduler System
-- Allows teachers to auto-assign challenges from tag pools to classes on a schedule

CREATE TABLE IF NOT EXISTS class_challenge_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  tag_ids UUID[] NOT NULL DEFAULT '{}',  -- which tag pools to pick from
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekdays', 'weekly')),
  challenges_per_day INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_assigned_at TIMESTAMPTZ,  -- when the scheduler last ran for this schedule
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track which challenges have been assigned by the scheduler (for no-repeat logic)
CREATE TABLE IF NOT EXISTS schedule_assignment_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES class_challenge_schedules(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
  assigned_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedules_class ON class_challenge_schedules(class_id);
CREATE INDEX idx_schedules_active ON class_challenge_schedules(is_active) WHERE is_active = true;
CREATE INDEX idx_schedule_log_schedule ON schedule_assignment_log(schedule_id);
CREATE INDEX idx_schedule_log_challenge ON schedule_assignment_log(challenge_id);

-- RLS
ALTER TABLE class_challenge_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_assignment_log ENABLE ROW LEVEL SECURITY;

-- Teachers can manage schedules
CREATE POLICY "Teachers can read schedules" ON class_challenge_schedules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('teacher', 'administrator') AND ur.class_id IS NULL));
CREATE POLICY "Teachers can create schedules" ON class_challenge_schedules FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('teacher', 'administrator') AND ur.class_id IS NULL));
CREATE POLICY "Teachers can update schedules" ON class_challenge_schedules FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('teacher', 'administrator') AND ur.class_id IS NULL));
CREATE POLICY "Teachers can delete schedules" ON class_challenge_schedules FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('teacher', 'administrator') AND ur.class_id IS NULL));

-- Log readable by teachers, writable by anyone (scheduler runs client-side)
CREATE POLICY "Teachers can read schedule log" ON schedule_assignment_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('teacher', 'administrator') AND ur.class_id IS NULL));
CREATE POLICY "Authenticated can insert schedule log" ON schedule_assignment_log FOR INSERT TO authenticated
  WITH CHECK (true);
