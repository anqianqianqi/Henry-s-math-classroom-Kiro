# Grade Visibility Fix

## Problem
Published grades are not showing up when students (or teachers) view homework submissions.

## What I Fixed

### Changed in `components/SessionDetail.tsx`
Previously, the code was loading submissions with grades using a nested query:
```typescript
.select(`
  *,
  homework_grades(*)
`)
```

This was problematic because:
1. RLS policies filter grades by status='published'
2. Nested queries in Supabase can have issues with RLS filtering
3. The grades might be filtered out silently

### New Approach
Now we:
1. Load submissions first
2. Load published grades separately with explicit filter
3. Manually join them together in JavaScript

This ensures:
- Explicit filtering for `status = 'published'`
- Better debugging (we can see exactly what's loaded)
- More reliable data loading

## Testing Steps

1. **Clear your browser cache** or do a hard refresh (Ctrl+Shift+R)

2. **As a teacher:**
   - Grade a submission
   - Click "Publish Grade"
   - Check the console logs - you should see the grade saved

3. **As a student:**
   - Navigate to the class session
   - Look at your submission
   - Check the console logs - you should see:
     ```
     📝 Loaded student submissions: [...]
       Submission 1: {
         hasGrades: true,
         gradeStatus: 'published',
         grades: [{ points_earned: X, ... }]
       }
     ```
   - The grade should now display

4. **If still not working:**
   - Run `supabase/test-grade-visibility.sql` in your SQL Editor
   - Check if grades exist and have `status = 'published'`
   - Check the RLS policies are correct

## Debug Queries

Run these in Supabase SQL Editor:

```sql
-- Check all grades
SELECT * FROM homework_grades ORDER BY graded_at DESC LIMIT 5;

-- Check if any are published
SELECT status, COUNT(*) FROM homework_grades GROUP BY status;

-- Check RLS policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'homework_grades';
```

## Common Issues

1. **Grade saved as 'draft' instead of 'published'**
   - Make sure you clicked "Publish Grade" not "Save as Draft"
   - Check the database: `SELECT status FROM homework_grades;`

2. **RLS blocking access**
   - Students can only see grades with `status = 'published'`
   - Check the RLS policy is correct

3. **Browser cache**
   - Do a hard refresh (Ctrl+Shift+R)
   - Or open in incognito mode

4. **Not reloading after grading**
   - The page should auto-reload after publishing
   - If not, manually refresh the page
