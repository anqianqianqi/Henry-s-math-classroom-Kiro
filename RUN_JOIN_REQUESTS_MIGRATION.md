# Run Join Requests Migration

## Quick Setup (2 minutes)

This adds the "Request to Join" feature for students and notifications for teachers.

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard at https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"** button

### Step 2: Run the Migration
1. Open this file in your editor:
   ```
   supabase/add-join-requests.sql
   ```

2. Copy the ENTIRE contents

3. Paste into the Supabase SQL Editor

4. Click the green **"Run"** button (or press Cmd/Ctrl + Enter)

5. Wait for success message: "Success. No rows returned"

### Step 3: Verify It Worked
In the same SQL Editor, run this check:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'class_join_requests';
```

You should see one row with `class_join_requests`. ✅

### Step 4: Test the Feature

#### As a Student:
1. Go to `/classes/explore`
2. Find a public class
3. Click **"Request to Join"** button
4. You should see "Request Pending" status

#### As a Teacher:
1. Go to your class detail page
2. You should see a **"Join Requests"** section
3. You should see the pending request
4. You can approve or deny the request
5. You should receive a notification

### What This Migration Does

Creates:
- `class_join_requests` table for storing join requests
- RLS policies for security
- Automatic notifications when:
  - Student requests to join (teacher gets notified)
  - Teacher approves/denies (student gets notified)
- Automatic enrollment when request is approved

### Troubleshooting

**Error: "relation already exists"**
- Table already created, you're good to go!

**Error: "permission denied"**
- Make sure you're using the SQL Editor in Supabase dashboard
- You need admin access

**Still getting errors?**
- Check Supabase logs for details
- Make sure you copied the entire SQL file
- Try refreshing the page after running the migration

## Features Added

1. **Request to Join Button** - Students can request to join classes
2. **Join Request Manager** - Teachers see pending requests in class detail page
3. **Notifications** - Both teachers and students get notified
4. **Auto-enrollment** - Students are automatically added when approved
5. **Status Tracking** - Shows pending/approved/denied status

## Next Steps

After the migration:
- Students can browse classes and request to join
- Teachers receive notifications for new requests
- Teachers can approve/deny requests with optional messages
- Students get notified of the decision
- Approved students are automatically enrolled
