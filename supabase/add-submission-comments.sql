-- Add submission comments table for teacher feedback
-- This allows teachers to provide feedback on student submissions

CREATE TABLE IF NOT EXISTS submission_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES challenge_submissions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_submission_comments_submission ON submission_comments(submission_id);
CREATE INDEX idx_submission_comments_user ON submission_comments(user_id);

-- Enable RLS
ALTER TABLE submission_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can create comments on submissions in their classes
CREATE POLICY "Users can create comments on submissions"
  ON submission_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM challenge_submissions cs
      JOIN daily_challenges dc ON cs.challenge_id = dc.id
      JOIN challenge_assignments ca ON dc.id = ca.challenge_id
      JOIN class_members cm ON ca.class_id = cm.class_id
      WHERE cs.id = submission_id
        AND cm.user_id = auth.uid()
    )
  );

-- Users can read comments on submissions they can see
CREATE POLICY "Users can read comments on visible submissions"
  ON submission_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM challenge_submissions cs
      WHERE cs.id = submission_id
        AND (
          cs.user_id = auth.uid()  -- Own submission
          OR user_has_submitted(auth.uid(), cs.challenge_id)  -- Posted to same challenge
          OR user_has_permission(auth.uid(), 'submission:read_all')  -- Teacher
        )
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON submission_comments FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON submission_comments FOR DELETE
  USING (user_id = auth.uid());
