# URGENT: Run This Migration Now

## The Problem
The table `homework_submission_comments` doesn't exist in your database yet.

## The Solution
You need to run the SQL migration file.

## Steps:

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the entire contents of `supabase/add-homework-submission-comments.sql`
5. Click "Run" or press Ctrl+Enter

### Option 2: Command Line (if you have Supabase CLI)
```bash
# If you have the Supabase CLI installed
supabase db push

# Or run the specific file
psql $DATABASE_URL -f supabase/add-homework-submission-comments.sql
```

### Option 3: Copy-Paste the SQL
If you can't access the file, here's the SQL to run:

```sql
-- Add homework submission comments table
-- This allows teachers and students to comment on homework submissions

CREATE TABLE IF NOT EXISTS homework_submission_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES homework_submissions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_homework_submission_comments_submission ON homework_submission_comments(submission_id);
CREATE INDEX idx_homework_submission_comments_user ON homework_submission_comments(user_id);

-- Enable RLS
ALTER TABLE homework_submission_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can create comments on submissions they can see
CREATE POLICY "Users can create homework submission comments"
  ON homework_submission_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- Student can comment on their own submission
      EXISTS (
        SELECT 1 FROM homework_submissions hs
        WHERE hs.id = submission_id
          AND hs.student_id = auth.uid()
      )
      OR
      -- Teacher can comment on submissions in their classes
      EXISTS (
        SELECT 1 FROM homework_submissions hs
        JOIN homework_assignments ha ON hs.assignment_id = ha.id
        JOIN class_occurrences co ON ha.occurrence_id = co.id
        WHERE hs.id = submission_id
          AND user_has_permission(auth.uid(), 'submission:read_all', co.class_id)
      )
    )
  );

-- Users can read comments on submissions they can see
CREATE POLICY "Users can read homework submission comments"
  ON homework_submission_comments FOR SELECT
  USING (
    -- Student can read comments on their own submission
    EXISTS (
      SELECT 1 FROM homework_submissions hs
      WHERE hs.id = submission_id
        AND hs.student_id = auth.uid()
    )
    OR
    -- Teacher can read comments on submissions in their classes
    EXISTS (
      SELECT 1 FROM homework_submissions hs
      JOIN homework_assignments ha ON hs.assignment_id = ha.id
      JOIN class_occurrences co ON ha.occurrence_id = co.id
      WHERE hs.id = submission_id
        AND user_has_permission(auth.uid(), 'submission:read_all', co.class_id)
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own homework comments"
  ON homework_submission_comments FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete own homework comments"
  ON homework_submission_comments FOR DELETE
  USING (user_id = auth.uid());
```

## After Running the Migration

1. Refresh your browser page
2. The error should be gone
3. You should now see the comments section when grading submissions
4. Students should be able to comment on their submissions too

## Verification

After running the migration, you can verify it worked by running this query in the SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'homework_submission_comments';
```

You should see one row returned with the table name.
