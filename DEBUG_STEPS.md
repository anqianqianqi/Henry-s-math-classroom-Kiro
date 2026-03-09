# Debug Steps - Grade Not Showing

## Step 1: Check if grade exists in database

Run this in Supabase SQL Editor:

```sql
-- Check all grades
SELECT 
  hg.id,
  hg.submission_id,
  hg.points_earned,
  hg.feedback,
  hg.status,
  hg.published_at,
  hg.graded_at,
  p.full_name as student_name
FROM homework_grades hg
JOIN homework_submissions hs ON hg.submission_id = hs.id
JOIN profiles p ON hs.student_id = p.id
ORDER BY hg.graded_at DESC
LIMIT 5;
```

**Expected:** You should see Mike Johnson's grade with `status = 'published'`

## Step 2: Check browser console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for this log message:
   ```
   📊 Loaded submissions for grading: [...]
   ```
4. Expand it and look for Mike Johnson's entry
5. Check if `hasGrade: true` and what the grade data shows

**What to look for:**
- `hasGrade: false` → Grade not loaded from database
- `hasGrade: true` but `gradeStatus: 'draft'` → Grade saved as draft, not published
- `hasGrade: true` and `gradeStatus: 'published'` → Grade loaded correctly

## Step 3: Check what you see in the UI

When you expand Mike Johnson's submission:
- Do you see "✓ Graded" badge in the header?
- Do you see the score (e.g., "85/100") in the header?
- Are the Points and Feedback fields empty or filled?

## Step 4: Try this SQL to check RLS

```sql
-- Check if teacher can see the grade
SELECT 
  hg.*,
  hs.student_id,
  ha.occurrence_id,
  co.class_id
FROM homework_grades hg
JOIN homework_submissions hs ON hg.submission_id = hs.id
JOIN homework_assignments ha ON hs.assignment_id = ha.id
JOIN class_occurrences co ON ha.occurrence_id = co.id
WHERE hg.status = 'published'
ORDER BY hg.graded_at DESC
LIMIT 5;
```

## Step 5: Temporary RLS bypass (for testing only)

If you want to test if RLS is the issue, temporarily disable it:

```sql
-- TEMPORARY - for testing only
ALTER TABLE homework_grades DISABLE ROW LEVEL SECURITY;
```

Then refresh the page and see if grades show up.

**If grades show up after disabling RLS:** The RLS policy is blocking access
**If grades still don't show:** The issue is in the UI code or data loading

Don't forget to re-enable RLS after testing:
```sql
ALTER TABLE homework_grades ENABLE ROW LEVEL SECURITY;
```

## What to tell me

Please share:
1. Results from Step 1 SQL query (does the grade exist?)
2. Console log output from Step 2 (what does it say about hasGrade?)
3. What you see in the UI from Step 3
