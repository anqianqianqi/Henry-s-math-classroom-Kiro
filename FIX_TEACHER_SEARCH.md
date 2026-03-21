# Fix Teacher Search for Students

## Problem
Teachers can search by email but not by name when trying to add students to their class.

## Root Cause
The `profiles` table has Row Level Security (RLS) policies that restrict who can read profile data. Currently, teachers can only see:
1. Their own profile
2. Profiles of students already in their classes

This prevents them from searching ALL profiles to find new students to add.

## Solution
Add an RLS policy that allows teachers (anyone who has created a class) to search all profiles.

## Quick Fix (1 minute)

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the left sidebar
3. Click "New query"

### Step 2: Run the Fix
1. Open this file: `supabase/fix-profiles-search.sql`
2. Copy the ENTIRE contents
3. Paste into Supabase SQL Editor
4. Click "Run"

### Step 3: Test It
1. Go to a class detail page as a teacher
2. Try to add a student by typing their name
3. You should now see search results! ✅

## What This Does

Adds a new RLS policy:
```sql
CREATE POLICY "Teachers can search all profiles"
  ON profiles FOR SELECT
  USING (
    -- User is a teacher (has created at least one class)
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.created_by = auth.uid()
    )
    OR
    -- User has teacher/admin role
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'admin', 'administrator')
    )
  );
```

This allows:
- Anyone who has created a class (teacher) to search all profiles
- Anyone with teacher/admin role to search all profiles
- Students can still only see profiles of classmates

## Security Note

This is safe because:
- Only teachers can search all profiles
- Students can only see classmates
- Profile data (name, email) is not sensitive
- Teachers need this to add students to classes

## Troubleshooting

**Still can't search by name?**
- Make sure you ran the migration
- Try refreshing the page
- Check browser console for errors
- Verify you're logged in as a teacher

**Error running migration?**
- Make sure you copied the entire SQL file
- Check for any syntax errors
- Try running in Supabase dashboard (not local)

## Alternative: Temporary Workaround

If you can't run the migration right now, teachers can still add students by:
1. Asking students for their exact email address
2. Typing the full email in the search box
3. Clicking "Add Student"

This works because email search uses exact matching, which doesn't require reading all profiles.
