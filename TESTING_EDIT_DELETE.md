# Testing Guide - Edit & Delete Challenge Features

**Date**: 2026-03-02  
**Features**: Edit Challenge, Delete Challenge  
**Status**: Ready for Testing

---

## Prerequisites

### 1. Start Development Server

```bash
# Using Docker (recommended due to GLIBC issues)
docker run --rm -d -v $(pwd):/app -w /app --env-file .env.local -p 3000:3000 --name henry-math-dev node:18 npm run dev

# Access app
http://localhost:3000
```

### 2. Test Accounts

**Teacher Account**:
- Email: `anqiluo@amazon.com`
- Has existing challenges and classes

**Student Accounts** (for verification):
- `sarah@test.com` (has submitted to challenges)
- `mike@test.com` (enrolled but not submitted)
- Password for all: `test123`

---

## Test Suite 1: Edit Challenge

### Test 1.1: Access Edit Page

**Steps**:
1. Login as teacher (`anqiluo@amazon.com`)
2. Go to `/challenges`
3. Click on any challenge
4. Look for "Edit" button in header (next to "Delete")
5. Click "Edit" button

**Expected**:
- ✅ Edit button is visible (teacher only)
- ✅ Edit button has outline styling
- ✅ Redirects to `/challenges/[id]/edit`
- ✅ Form loads with current challenge data
- ✅ Title field is pre-filled
- ✅ Description field is pre-filled
- ✅ Date field is pre-filled
- ✅ Classes are pre-selected (checkboxes checked)

**Screenshot Locations**:
- Header with Edit button
- Edit form loaded

---

### Test 1.2: Edit Challenge Without Submissions

**Steps**:
1. Create a new challenge (no submissions yet)
2. Immediately click "Edit" on the new challenge
3. Change the title to "Updated Title"
4. Change the description to "Updated description"
5. Change the date to tomorrow
6. Add or remove a class
7. Click "Save Changes"

**Expected**:
- ✅ No warning banner appears (no submissions)
- ✅ Form accepts changes
- ✅ "Save Changes" button shows loading state
- ✅ Redirects to challenge detail page
- ✅ Updated title is displayed
- ✅ Updated description is displayed
- ✅ Updated date is displayed
- ✅ Class assignments are updated

**Verification**:
```sql
-- Check challenge was updated
SELECT title, description, challenge_date 
FROM daily_challenges 
WHERE id = '<challenge_id>';

-- Check class assignments
SELECT ca.*, c.name as class_name
FROM challenge_assignments ca
JOIN classes c ON c.id = ca.class_id
WHERE ca.challenge_id = '<challenge_id>';
```

---

### Test 1.3: Edit Challenge With Submissions

**Steps**:
1. Go to a challenge that has submissions (e.g., today's challenge)
2. Click "Edit" button
3. Observe the warning banner
4. Change the title
5. Click "Save Changes"

**Expected**:
- ✅ Warning banner appears at top
- ✅ Banner shows submission count
- ✅ Banner has yellow/warning styling
- ✅ Warning icon (⚠️) is visible
- ✅ Message explains submissions won't be deleted
- ✅ Can still save changes
- ✅ Submissions remain after save

**Verification**:
```sql
-- Check submissions still exist
SELECT COUNT(*) FROM challenge_submissions 
WHERE challenge_id = '<challenge_id>';
```

---

### Test 1.4: Edit Form Validation

**Steps**:
1. Go to edit page
2. Clear the title field
3. Try to save
4. Observe error message
5. Fill title, clear description
6. Try to save
7. Observe error message
8. Fill description, uncheck all classes
9. Try to save
10. Observe error message

**Expected**:
- ✅ Empty title → Shows "Please enter a title" error
- ✅ Empty description → Shows "Please enter a description" error
- ✅ No classes selected → Shows "Please select at least one class" error
- ✅ Error messages appear in red banner
- ✅ Form doesn't submit with errors
- ✅ Save button remains enabled (not stuck)

---

### Test 1.5: Edit Class Assignments

**Setup**:
- Challenge currently assigned to "Math 101"
- Want to add "Math 102" and remove "Math 101"

**Steps**:
1. Go to edit page
2. Uncheck "Math 101"
3. Check "Math 102"
4. Save changes
5. Login as student in Math 101
6. Go to `/challenges`
7. Verify challenge is NOT visible
8. Login as student in Math 102
9. Go to `/challenges`
10. Verify challenge IS visible

**Expected**:
- ✅ Can change class assignments
- ✅ Students in removed class don't see challenge
- ✅ Students in added class see challenge
- ✅ Existing submissions from removed class are preserved

---

### Test 1.6: Cancel Edit

**Steps**:
1. Go to edit page
2. Make some changes
3. Click "Cancel" button
4. Observe behavior

**Expected**:
- ✅ Redirects back to challenge detail page
- ✅ Changes are NOT saved
- ✅ Challenge data remains unchanged

---

## Test Suite 2: Delete Challenge

### Test 2.1: Delete Button Visibility

**Steps**:
1. Login as teacher
2. Go to any challenge detail page
3. Look for "Delete" button in header
4. Logout
5. Login as student
6. Go to same challenge detail page
7. Look for "Delete" button

**Expected**:
- ✅ Teacher sees "Delete" button
- ✅ Delete button has red/danger styling
- ✅ Delete button has trash icon (🗑️)
- ✅ Student does NOT see "Delete" button
- ✅ Button is next to "Edit" button

---

### Test 2.2: Delete Confirmation Modal

**Steps**:
1. Login as teacher
2. Go to any challenge
3. Click "Delete" button
4. Observe modal

**Expected**:
- ✅ Modal appears immediately
- ✅ Modal has dark backdrop overlay
- ✅ Modal is centered on screen
- ✅ Modal has warning icon (⚠️)
- ✅ Modal title is "Delete Challenge?"
- ✅ Modal has red/danger styling
- ✅ Modal shows confirmation message
- ✅ Modal has two buttons: "Delete Challenge" and "Cancel"

---

### Test 2.3: Delete Without Submissions

**Steps**:
1. Create a new challenge (no submissions)
2. Click "Delete" button
3. Observe modal content
4. Click "Delete Challenge" button
5. Wait for deletion

**Expected**:
- ✅ Modal appears
- ✅ No submission warning (count is 0)
- ✅ Delete button shows loading state
- ✅ Redirects to `/challenges` list
- ✅ Challenge is removed from list
- ✅ Challenge is deleted from database

**Verification**:
```sql
-- Should return no rows
SELECT * FROM daily_challenges WHERE id = '<challenge_id>';

-- Should return no rows
SELECT * FROM challenge_assignments WHERE challenge_id = '<challenge_id>';
```

---

### Test 2.4: Delete With Submissions

**Steps**:
1. Go to challenge with submissions (e.g., today's challenge)
2. Note the submission count
3. Click "Delete" button
4. Observe modal content
5. Read the warning
6. Click "Delete Challenge" button
7. Wait for deletion

**Expected**:
- ✅ Modal shows submission count
- ✅ Warning banner appears in modal
- ✅ Warning says "This challenge has X submissions that will also be deleted"
- ✅ Warning has red/danger styling
- ✅ Delete button shows loading state
- ✅ Redirects to challenges list
- ✅ Challenge is deleted
- ✅ All submissions are deleted (CASCADE)

**Verification**:
```sql
-- Should return no rows
SELECT * FROM daily_challenges WHERE id = '<challenge_id>';

-- Should return no rows
SELECT * FROM challenge_submissions WHERE challenge_id = '<challenge_id>';

-- Should return no rows
SELECT * FROM challenge_assignments WHERE challenge_id = '<challenge_id>';
```

---

### Test 2.5: Cancel Delete

**Steps**:
1. Go to any challenge
2. Click "Delete" button
3. Modal appears
4. Click "Cancel" button
5. Observe behavior

**Expected**:
- ✅ Modal closes immediately
- ✅ Challenge is NOT deleted
- ✅ Still on challenge detail page
- ✅ Challenge data unchanged

---

### Test 2.6: Delete During Network Error

**Steps**:
1. Open browser DevTools
2. Go to Network tab
3. Set throttling to "Offline"
4. Try to delete a challenge
5. Observe behavior

**Expected**:
- ✅ Delete button shows loading state
- ✅ Eventually shows error alert
- ✅ Modal remains open
- ✅ Challenge is NOT deleted
- ✅ Can try again after fixing network

---

## Test Suite 3: UI/UX

### Test 3.1: Button Styling

**Steps**:
1. Go to challenge detail page as teacher
2. Observe Edit and Delete buttons
3. Hover over each button
4. Click each button

**Expected**:
- ✅ Edit button has outline styling (border, no fill)
- ✅ Delete button has danger styling (red background)
- ✅ Both buttons have proper hover effects
- ✅ Both buttons have proper active states
- ✅ Icons are visible (✏️ and 🗑️)

---

### Test 3.2: Modal Styling

**Steps**:
1. Click "Delete" button
2. Observe modal appearance
3. Try clicking outside modal
4. Try pressing Escape key

**Expected**:
- ✅ Modal has rounded corners (Duolingo style)
- ✅ Modal has proper shadow
- ✅ Backdrop is semi-transparent black
- ✅ Modal is properly centered
- ✅ Text is readable
- ✅ Buttons are properly styled
- ⚠️ Clicking outside doesn't close (by design)
- ⚠️ Escape key doesn't close (by design)

---

### Test 3.3: Loading States

**Steps**:
1. Edit a challenge and save
2. Observe "Save Changes" button
3. Delete a challenge
4. Observe "Delete Challenge" button

**Expected**:
- ✅ Save button shows spinner during save
- ✅ Save button text changes to "Loading..."
- ✅ Save button is disabled during save
- ✅ Delete button shows spinner during delete
- ✅ Delete button text changes to "Loading..."
- ✅ Delete button is disabled during delete
- ✅ Cancel button is disabled during operations

---

### Test 3.4: Error Messages

**Steps**:
1. Try to save edit with invalid data
2. Observe error message
3. Fix error and save
4. Observe error disappears

**Expected**:
- ✅ Error appears in red banner
- ✅ Error message is clear and helpful
- ✅ Error doesn't block form
- ✅ Error disappears after fixing

---

## Test Suite 4: Responsive Design

### Test 4.1: Mobile View (< 768px)

**Steps**:
1. Resize browser to mobile width
2. Go to challenge detail page
3. Observe Edit/Delete buttons
4. Click Delete button
5. Observe modal

**Expected**:
- ✅ Buttons stack vertically or wrap properly
- ✅ Buttons remain accessible
- ✅ Modal fits on screen
- ✅ Modal is scrollable if needed
- ✅ Form is usable on mobile

---

### Test 4.2: Tablet View (768px - 1024px)

**Steps**:
1. Resize browser to tablet width
2. Test all features
3. Observe layout

**Expected**:
- ✅ Layout looks good
- ✅ Buttons have proper spacing
- ✅ Modal is properly sized
- ✅ Form is comfortable to use

---

### Test 4.3: Desktop View (> 1024px)

**Steps**:
1. Use full desktop width
2. Test all features
3. Observe layout

**Expected**:
- ✅ Full layout works
- ✅ Modal is centered and properly sized
- ✅ Buttons are properly spaced
- ✅ Everything is readable

---

## Test Suite 5: Edge Cases

### Test 5.1: Edit Non-Existent Challenge

**Steps**:
1. Go to `/challenges/00000000-0000-0000-0000-000000000000/edit`
2. Observe behavior

**Expected**:
- ✅ Shows "Challenge Not Found" message
- ✅ Provides "Back to Challenges" button
- ✅ Doesn't crash

---

### Test 5.2: Delete Already Deleted Challenge

**Steps**:
1. Open challenge in two tabs
2. Delete in first tab
3. Try to delete in second tab
4. Observe behavior

**Expected**:
- ✅ Shows error or redirects
- ✅ Doesn't crash
- ✅ Handles gracefully

---

### Test 5.3: Edit With No Classes Available

**Steps**:
1. Delete all classes (or use fresh account)
2. Try to edit a challenge
3. Observe class selection section

**Expected**:
- ✅ Shows "No classes available" message
- ✅ Can still save (if at least one class was selected before)
- ✅ Doesn't crash

---

## Test Suite 6: Database Integrity

### Test 6.1: Cascade Delete Verification

**Steps**:
1. Create a challenge
2. Add submissions to it
3. Note the IDs
4. Delete the challenge
5. Check database

**SQL Queries**:
```sql
-- Before delete - should have rows
SELECT * FROM daily_challenges WHERE id = '<challenge_id>';
SELECT * FROM challenge_submissions WHERE challenge_id = '<challenge_id>';
SELECT * FROM challenge_assignments WHERE challenge_id = '<challenge_id>';

-- After delete - should have no rows
SELECT * FROM daily_challenges WHERE id = '<challenge_id>';
SELECT * FROM challenge_submissions WHERE challenge_id = '<challenge_id>';
SELECT * FROM challenge_assignments WHERE challenge_id = '<challenge_id>';
```

**Expected**:
- ✅ All related records are deleted
- ✅ No orphaned submissions
- ✅ No orphaned assignments

---

### Test 6.2: Edit Preserves Submissions

**Steps**:
1. Edit a challenge that has submissions
2. Change title and description
3. Save changes
4. Check database

**SQL Queries**:
```sql
-- Should still have same submissions
SELECT COUNT(*) FROM challenge_submissions WHERE challenge_id = '<challenge_id>';

-- Should have updated title/description
SELECT title, description FROM daily_challenges WHERE id = '<challenge_id>';
```

**Expected**:
- ✅ Submission count unchanged
- ✅ Challenge data updated
- ✅ No data loss

---

## Bug Report Template

If you find a bug, report it using this template:

```markdown
### Bug: [Short Description]

**Severity**: Critical / High / Medium / Low

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Behavior**:
- 

**Actual Behavior**:
- 

**Screenshots**:
[Attach if applicable]

**Browser**: Chrome / Firefox / Safari / Edge
**Screen Size**: Desktop / Tablet / Mobile
**User Role**: Teacher / Student

**Console Errors**:
```
[Paste any console errors]
```

**Additional Context**:
- 
```

---

## Success Criteria

All tests pass when:
- [ ] All Test Suite 1 tests pass (Edit Challenge)
- [ ] All Test Suite 2 tests pass (Delete Challenge)
- [ ] All Test Suite 3 tests pass (UI/UX)
- [ ] All Test Suite 4 tests pass (Responsive)
- [ ] All Test Suite 5 tests pass (Edge Cases)
- [ ] All Test Suite 6 tests pass (Database)
- [ ] No critical bugs found
- [ ] No TypeScript errors
- [ ] No console errors

---

## Quick Test Checklist

For a quick smoke test, run these:

- [ ] Login as teacher
- [ ] Edit a challenge and save
- [ ] Verify changes appear
- [ ] Delete a challenge
- [ ] Verify it's gone
- [ ] Check no console errors
- [ ] Test on mobile view

**Estimated Testing Time**: 30-45 minutes for full suite, 5 minutes for quick test

---

**Ready to test!** 🧪

Report any issues found and we'll fix them before moving to Phase 1.3 (Enhanced Challenge List).

