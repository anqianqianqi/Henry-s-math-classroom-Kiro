# Student Homework Submission - Enabled March 9, 2026

## What Changed
Students can now submit homework through the "Submit Homework" button!

## How to Test

### Step 1: Ensure Students Are Enrolled
First, make sure test students are enrolled in the class:

```sql
-- Check if students are enrolled in Algebra 1
SELECT 
  cm.id,
  p.full_name,
  p.email,
  c.name as class_name
FROM class_members cm
JOIN profiles p ON p.id = cm.user_id
JOIN classes c ON c.id = cm.class_id
WHERE c.name LIKE '%Algebra%';
```

If not enrolled, run:
```sql
-- Enroll sarah@test.com in Algebra 1
INSERT INTO class_members (class_id, user_id, role)
SELECT 
  c.id,
  (SELECT id FROM auth.users WHERE email = 'sarah@test.com'),
  'student'
FROM classes c
WHERE c.name LIKE '%Algebra%'
ON CONFLICT DO NOTHING;

-- Enroll mike@test.com in Algebra 1
INSERT INTO class_members (class_id, user_id, role)
SELECT 
  c.id,
  (SELECT id FROM auth.users WHERE email = 'mike@test.com'),
  'student'
FROM classes c
WHERE c.name LIKE '%Algebra%'
ON CONFLICT DO NOTHING;
```

### Step 2: Create Homework Assignment (As Teacher)
1. Login as admin: admin@test.com / 123456
2. Navigate to Algebra 1 class
3. Click on any upcoming session
4. Click "Create Assignment"
5. Fill in:
   - Title: "Practice Problems - Chapter 1"
   - Description: "Complete problems 1-10"
   - Due Date: Pick a future date
   - Points: 100
   - Submission Type: Choose File, Text, or Link
6. Click "Create Assignment"

### Step 3: Submit Homework (As Student)
1. Logout and login as student: sarah@test.com / test123
2. Navigate to the same class (Algebra 1)
3. Click on the same session
4. You should see the homework assignment with details
5. Click "Submit Homework" button
6. The SubmissionForm will open with:
   - Assignment info (title, due date, points)
   - Submission input based on type:
     - **File**: Drag/drop or click to upload
     - **Text**: Text area to type answer
     - **Link**: URL input field
   - Comments field (optional)
7. Fill in your submission
8. Click "Submit"

### Step 4: Verify Submission (As Teacher)
1. Logout and login back as admin
2. Navigate to the same session
3. Click "View Submissions"
4. You should see the student's submission
5. Click to expand and grade it

## Submission Types

### File Submission
- Upload any file (max 50MB)
- Stored in `homework-submissions` bucket
- Student can see file name and size before submitting
- Teacher can download the file to review

### Text Submission
- Type answer directly in text area
- Good for short answers, essays, code
- Teacher sees the text content inline

### Link Submission
- Paste a URL (e.g., Google Doc, GitHub repo)
- Must be a valid URL starting with https://
- Teacher can click to open the link

## Features

### For Students:
- ✅ See homework assignment details
- ✅ Submit homework (file, text, or link)
- ✅ Add optional comments
- ✅ See late warning if past due date
- ✅ Resubmit (creates new version)
- ✅ File validation (size, type)
- ✅ Upload progress indicator

### For Teachers:
- ✅ View all submissions
- ✅ See submission content
- ✅ Grade submissions
- ✅ Provide feedback
- ✅ See late submissions marked
- ✅ See version numbers

## Technical Details

### Files Modified
- ✅ `components/SessionDetail.tsx`
  - Added `showSubmissionForm` state
  - Imported `SubmissionForm` component
  - Added onClick handler to "Submit Homework" button
  - Conditionally render SubmissionForm when clicked

### Component Flow
```
SessionDetail (Student View)
  ├── Materials Section (read-only)
  └── Homework Section
      ├── Homework Display (view assignment)
      └── SubmissionForm (submit homework) ← NEW
```

### Props Passed to SubmissionForm
```typescript
<SubmissionForm
  assignmentId={homework.id}
  assignmentTitle={homework.title}
  dueDate={homework.due_date}
  submissionType={homework.submission_type}
  pointsPossible={homework.points_possible}
  onSubmit={() => {
    setShowSubmissionForm(false)
    loadSessionData()
  }}
  onCancel={() => setShowSubmissionForm(false)}
/>
```

## Database Tables Used

### homework_submissions
```sql
CREATE TABLE homework_submissions (
  id UUID PRIMARY KEY,
  assignment_id UUID REFERENCES homework_assignments(id),
  student_id UUID REFERENCES auth.users(id),
  submission_type TEXT NOT NULL,
  file_url TEXT,
  text_content TEXT,
  link_url TEXT,
  comments TEXT,
  is_late BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Storage Buckets

### homework-submissions
- Used for file uploads
- Path: `{assignment_id}/{student_id}/v{version}_{filename}`
- Max size: 50MB
- Public bucket (for getPublicUrl)

## RLS Policies

Currently RLS is disabled for testing. For production, add:

```sql
-- Students can insert their own submissions
CREATE POLICY "Students can submit homework"
ON homework_submissions FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

-- Students can view their own submissions
CREATE POLICY "Students can view own submissions"
ON homework_submissions FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Teachers can view submissions for their classes
CREATE POLICY "Teachers can view class submissions"
ON homework_submissions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM homework_assignments ha
    JOIN class_occurrences co ON co.id = ha.occurrence_id
    JOIN classes c ON c.id = co.class_id
    WHERE ha.id = homework_submissions.assignment_id
    AND c.created_by = auth.uid()
  )
);
```

## Troubleshooting

### "Not authenticated" error
- Make sure student is logged in
- Check browser console for auth errors

### "Assignment not found" error
- Verify homework assignment exists
- Check assignment_id is correct

### File upload fails
- Check file size (max 50MB)
- Verify storage bucket exists
- Check storage bucket policies

### Submission doesn't appear
- Check RLS policies on homework_submissions table
- Verify student is enrolled in the class
- Check browser console for errors

## Next Steps

1. Test all three submission types (file, text, link)
2. Test late submissions
3. Test resubmissions (version tracking)
4. Test teacher grading workflow
5. Add proper RLS policies for production
6. Consider adding:
   - Draft submissions
   - Submission history view
   - File preview
   - Plagiarism detection
