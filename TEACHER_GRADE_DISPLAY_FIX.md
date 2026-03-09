# Teacher Grade Display Fix

## Problem
When a teacher opens the grading interface and expands a submission that was previously graded, the grade fields (points and feedback) are empty instead of showing the existing grade.

## Root Cause
The grading interface was calculating `currentGrade` correctly from the loaded data, but it wasn't initializing the `gradeData` state when expanding a submission. The form fields were bound to `gradeData`, which was empty until the teacher manually typed something.

## Fix Applied

### Changed in `components/GradingInterface.tsx`

1. **Added initialization on expand:**
   When clicking to expand a submission, if a grade exists, it now initializes the `gradeData` state with the existing grade values.

2. **Added debug logging:**
   Console logs now show what submissions and grades are loaded, making it easier to debug.

## How It Works Now

1. Teacher opens grading interface
2. Submissions load with their grades
3. When teacher clicks to expand a submission:
   - If a grade exists, the form fields are pre-filled with:
     - Points earned
     - Feedback text
4. Teacher can edit and re-publish or save as draft

## Testing

1. **Refresh your browser** (Ctrl+Shift+R)
2. Open the grading interface
3. Check the console - you should see:
   ```
   📊 Loaded submissions for grading: [...]
     Submission 1 (Mike Johnson): {
       hasGrade: true,
       gradeStatus: 'published',
       points: 85,
       feedback: '...'
     }
   ```
4. Click to expand Mike Johnson's submission
5. The Points and Feedback fields should now be pre-filled

## Verify Grade Exists

Run this in Supabase SQL Editor:
```sql
-- Check Mike Johnson's grade
SELECT 
  p.full_name,
  hg.points_earned,
  hg.feedback,
  hg.status,
  hg.published_at
FROM profiles p
JOIN homework_submissions hs ON p.id = hs.student_id
LEFT JOIN homework_grades hg ON hs.id = hg.submission_id
WHERE p.full_name LIKE '%Mike%Johnson%'
ORDER BY hs.submitted_at DESC;
```

If the grade exists in the database but still doesn't show:
1. Check the console logs
2. Make sure you're looking at the latest version of the submission
3. Try a hard refresh (Ctrl+Shift+R)

## What Shows in the UI

- **Before expanding:** Shows grade badge (✓ Graded) and score (85/100) in the header
- **After expanding:** Form fields are pre-filled with existing grade data
- **After editing:** Can update and re-publish
