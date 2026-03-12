# Run These Migrations Now

## Quick Start (5 minutes)

You need to run 3 SQL migrations in your Supabase SQL Editor to enable the notification system.

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the left sidebar
3. Click "New query"

### Step 2: Run Migrations (in order)

#### Migration 1: Comments System
```sql
-- Copy and paste the entire contents of:
supabase/add-homework-submission-comments.sql
```
Click "Run" and wait for success message.

#### Migration 2: Notifications System
```sql
-- Copy and paste the entire contents of:
supabase/add-notifications-system.sql
```
Click "Run" and wait for success message.

#### Migration 3: Notification Preferences
```sql
-- Copy and paste the entire contents of:
supabase/add-notification-preferences.sql
```
Click "Run" and wait for success message.

### Step 3: Verify Tables Created
Run this query to check:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'notifications',
  'notification_preferences',
  'notification_emails',
  'homework_submission_comments'
)
ORDER BY table_name;
```

You should see all 4 tables listed.

### Step 4: Test Notification System
1. Start your dev server: `npm run dev`
2. Login as a teacher
3. Go to a class session
4. Grade a homework submission
5. Check the bell icon in the dashboard header
6. You should see a notification!

### Step 5: Test Preferences
1. Click the settings icon (⚙️) in the dashboard header
2. You should see the notification preferences page
3. Toggle some preferences
4. Click "Save Preferences"
5. Reload the page - preferences should persist

## What These Migrations Do

### Comments System
- Adds `homework_submission_comments` table
- Enables two-way comments between teachers and students
- Adds RLS policies for security

### Notifications System
- Adds `notifications` table for in-app notifications
- Creates 7 notification types
- Adds automatic triggers for events
- Creates helper functions
- Adds scheduled notification functions

### Notification Preferences
- Adds `notification_preferences` table
- Adds `notification_emails` queue table
- Creates preference checking functions
- Updates triggers to respect user preferences

## Troubleshooting

### Error: "relation already exists"
- Tables already created, skip that migration
- Or drop the table first: `DROP TABLE IF EXISTS table_name CASCADE;`

### Error: "function already exists"
- Function already created, skip or use `CREATE OR REPLACE FUNCTION`

### Error: "permission denied"
- Make sure you're using the SQL Editor in Supabase dashboard
- You need admin access to create tables

### No notifications appearing
- Check if triggers are created: `\df notify_*` in SQL Editor
- Check if tables exist: `\dt` in SQL Editor
- Check browser console for errors
- Verify you're logged in

## Next Steps After Migrations

Once migrations are complete, you can:
1. Test the notification system
2. Customize your notification preferences
3. Move on to email service integration (optional)
4. Work on other features

See `NOTIFICATION_SYSTEM_SETUP.md` for detailed setup guide.
