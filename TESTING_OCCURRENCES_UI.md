# Testing Class Occurrences UI

## Quick Start

### Step 1: Create Mock Occurrences

Run this SQL script in your Supabase SQL Editor:

```bash
# Copy and paste the contents of this file:
supabase/quick-create-occurrences.sql
```

This will automatically create 20 mock occurrences (8 past, 12 upcoming) for your most recent class.

### Step 2: View in Browser

1. Start your dev server (if not already running):
   ```bash
   docker run --rm -d -v $(pwd):/app -w /app --env-file .env.local -p 3000:3000 --name henry-math-dev node:18 npm run dev
   ```

2. Login as teacher:
   - Email: `anqiluo@amazon.com`
   - Password: `test123`

3. Navigate to Classes page:
   ```
   http://localhost:3000/classes
   ```

4. Click on any class to see the class detail page

5. Scroll down to see the "Class Sessions" section

### What You Should See

#### SessionsList Component
- Two tabs: "Upcoming" and "Past"
- Upcoming tab shows 12 future sessions
- Past tab shows 8 completed sessions
- Each session card shows:
  - Session number (Session 1, Session 2, etc.)
  - Topic (e.g., "Introduction to Algebra")
  - Date and time (e.g., "Monday, March 10 • 3:00 PM - 4:00 PM")
  - Status badge (blue for upcoming, green for completed)
  - Notes (if any)

#### Click a Session
- Click any session card to view details
- SessionDetail component appears
- Shows:
  - Session header with full info
  - Materials section (empty for now)
  - "Upload Material" button (teacher only)
  - Homework section (empty for now)
  - "Create Assignment" button (teacher only)

### Step 3: Test Material Upload

1. Click on any session
2. Click "Upload Material" button
3. Drag and drop a file or click to browse
4. Fill in title (auto-filled from filename)
5. Add description (optional)
6. Select material type
7. Click "Upload"
8. File should upload and appear in materials list
9. Click "Download" to test download

### Step 4: Test Homework Creation

1. Click on any session
2. Click "Create Assignment" button
3. Fill in the form:
   - Title: "Chapter 3 Practice Problems"
   - Instructions: "Complete problems 1-20 on page 45"
   - Due date: Pick a future date/time
   - Points: 100
   - Submission type: File Upload
   - Allow late: Check or uncheck
4. Click "Create Assignment"
5. Assignment should appear in homework section

### Step 5: Test as Student

1. Logout and login as student:
   - Email: `sarah@test.com`
   - Password: `test123`

2. Navigate to the same class

3. Click on a session with homework

4. You should see:
   - Materials with download buttons (no upload button)
   - Homework assignment details
   - "Submit Homework" button (no create/edit buttons)

5. Click "Submit Homework" to test submission form

## Alternative: Create Occurrences for Specific Class

If you want to create occurrences for a specific class:

1. Find your class ID:
   ```sql
   SELECT id, name FROM classes WHERE name ILIKE '%your class name%';
   ```

2. Edit `supabase/create-occurrences-for-specific-class.sql`

3. Replace `YOUR_CLASS_ID_HERE` with your class ID

4. Run the script

## Troubleshooting

### No Sessions Showing
- Check that the migration was run: `supabase/add-class-occurrences-system.sql`
- Check that occurrences were created: `SELECT * FROM class_occurrences LIMIT 5;`
- Check browser console for errors

### Upload Material Button Not Showing
- Make sure you're logged in as the class creator (teacher)
- Check that user role detection is working (should show "Edit" and "Delete" buttons at top)

### Materials Not Uploading
- Check that storage buckets were created (see `supabase/SETUP_OCCURRENCES_SYSTEM.md`)
- Check browser console for errors
- Verify file size is under 50MB

### Homework Form Not Showing
- Click "Create Assignment" button
- If button doesn't appear, check user role
- Check browser console for errors

## Mock Data Details

The script creates 20 sessions:

**Past Sessions (8):**
1. Introduction to Algebra (Feb 10)
2. Linear Equations (Feb 12)
3. Graphing Functions (Feb 17)
4. Systems of Equations (Feb 19)
5. Quadratic Equations (Feb 24)
6. Polynomials (Feb 26)
7. Exponents and Radicals (Mar 3)
8. Rational Expressions (Mar 5)

**Upcoming Sessions (12):**
9. Inequalities (Mar 10)
10. Absolute Value (Mar 12)
11. Functions and Relations (Mar 17)
12. Transformations (Mar 19)
13. Exponential Functions (Mar 24)
14. Logarithmic Functions (Mar 26)
15. Sequences and Series (Mar 31)
16. Probability (Apr 2)
17. Statistics (Apr 7)
18. Review Session (Apr 9)
19. Final Exam Prep (Apr 14)
20. Final Exam (Apr 16)

All sessions are Monday/Wednesday at 3:00 PM - 4:00 PM.

## Next Steps

After testing the UI:
1. Try uploading different file types (PDF, DOC, images)
2. Create homework assignments with different submission types
3. Test as student: view materials and submit homework
4. Check that late submissions are marked correctly
5. Test resubmission (submit, then submit again)

## Need Help?

- Check `SESSION_PROGRESS_2026-03-08.md` for implementation details
- Check `.kiro/specs/class-occurrences-materials/PHASE6_COMPONENTS.md` for component documentation
- Check browser console for errors
- Check Supabase logs for database errors
