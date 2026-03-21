# Run All Pending Migrations - Quick Guide

## Overview
You need to run 3 migrations to enable all the new features:
1. **Fix Profiles Search** - Allows teachers to search for students by name
2. **Join Requests System** - Students can request to join classes
3. **Challenge Templates** - Save and reuse challenge templates

**Total Time**: ~5 minutes

---

## Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"** button

---

## Step 2: Run Migration 1 - Fix Profiles Search

### What it does:
Allows teachers to search for students by name (not just email) when adding them to classes.

### Instructions:
1. Copy the ENTIRE contents of: `supabase/fix-profiles-search.sql`
2. Paste into Supabase SQL Editor
3. Click **"Run"** (or press Cmd/Ctrl + Enter)
4. Wait for: "Success. No rows returned" ✅

### Verify it worked:
```sql
SELECT policyname FROM pg_policies 
WHERE tablename = 'profiles' 
AND policyname = 'Teachers can search all profiles';
```
Should return 1 row.

---

## Step 3: Run Migration 2 - Join Requests System

### What it does:
- Students can request to join classes
- Teachers get notifications
- Teachers can approve/deny requests
- Approved students are auto-enrolled

### Instructions:
1. Copy the ENTIRE contents of: `supabase/add-join-requests.sql`
2. Paste into Supabase SQL Editor
3. Click **"Run"** (or press Cmd/Ctrl + Enter)
4. Wait for: "Success. No rows returned" ✅

### Verify it worked:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'class_join_requests';
```
Should return 1 row with `class_join_requests`.

---

## Step 4: Run Migration 3 - Challenge Templates

### What it does:
- Teachers can save challenges as templates
- Reuse templates to create new challenges
- Share templates publicly (optional)
- Track template usage

### Instructions:
1. Copy the ENTIRE contents of: `supabase/add-challenge-templates.sql`
2. Paste into Supabase SQL Editor
3. Click **"Run"** (or press Cmd/Ctrl + Enter)
4. Wait for: "Success. No rows returned" ✅

### Verify it worked:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'challenge_templates';
```
Should return 1 row with `challenge_templates`.

---

## Step 5: Test the Features

### Test 1: Teacher Search (Fixed)
1. Log in as a teacher
2. Go to a class detail page
3. Try to add a student by typing their name
4. You should now see search results! ✅

### Test 2: Join Requests
**As Student:**
1. Go to `/classes/explore`
2. Find a public class
3. Click **"Request to Join"**
4. Should see "Request Pending" status ✅

**As Teacher:**
1. Go to your class detail page
2. Should see **"Join Requests"** section
3. Should see the pending request
4. Can approve or deny ✅

### Test 3: Challenge Templates
1. Go to `/challenges/new`
2. Create a challenge
3. Save it
4. Templates feature is ready (UI coming next) ✅

---

## Troubleshooting

### Error: "relation already exists"
- Table already created, you're good! ✅
- Skip to next migration

### Error: "permission denied"
- Make sure you're in Supabase dashboard (not local)
- You need admin access to the project

### Error: "policy already exists"
- Policy already created, you're good! ✅
- Skip to next migration

### Still getting errors?
1. Check you copied the ENTIRE SQL file
2. Make sure there are no extra characters
3. Try refreshing the page
4. Check Supabase logs for details

---

## What's Enabled After Migrations

### ✅ Profile Search Fix
- Teachers can search students by name
- Search dropdown shows all users
- Already-enrolled students marked with "✓ Enrolled"

### ✅ Join Request System
- "Request to Join" button on explore page
- "Request to Join" button on class detail page
- Status indicators (pending/approved/enrolled)
- Teacher notification when request received
- Student notification when request processed
- Auto-enrollment on approval
- Join request manager in class detail page

### ✅ Challenge Templates
- Database ready for templates
- Helper functions created
- RLS policies in place
- Ready for UI implementation

---

## Next Steps After Migrations

1. **Test join requests** - Try the full flow as student and teacher
2. **Test teacher search** - Verify name search works
3. **Complete templates UI** - Add "Save as Template" button to challenges
4. **Enhance explore page** - Add colorful tags and better UI

---

## Quick Reference

### Migration Files
```
supabase/fix-profiles-search.sql       (30 lines)
supabase/add-join-requests.sql         (300 lines)
supabase/add-challenge-templates.sql   (200 lines)
```

### Features Enabled
- Profile search by name ✅
- Join request system ✅
- Challenge templates (backend) ✅

### Time Required
- Migration 1: 30 seconds
- Migration 2: 1 minute
- Migration 3: 1 minute
- Testing: 2-3 minutes
- **Total: ~5 minutes**

---

## Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Verify you're logged into the correct Supabase project
3. Make sure you have admin permissions
4. Check browser console for errors
5. Check Supabase logs in the dashboard

---

**Ready to go!** Start with Step 1 and work through each migration in order.
