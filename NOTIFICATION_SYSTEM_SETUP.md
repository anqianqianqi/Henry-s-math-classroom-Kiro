# Notification System Setup Complete

## ✅ What's Been Implemented

### 1. Database Schema (Complete)
- `notifications` table with proper indexes and RLS policies
- Helper functions for creating and managing notifications
- Automatic triggers for:
  - Homework graded (when grade is published)
  - New comments on submissions
  - Homework submissions received (notifies teachers)
  - New homework assigned (notifies students)
  - New materials uploaded (notifies students)

### 2. UI Components (Complete)
- `NotificationBell.tsx` component with:
  - Bell icon with unread count badge
  - Dropdown showing recent 20 notifications
  - Mark as read functionality
  - Mark all as read functionality
  - Auto-refresh every 30 seconds
  - Click to navigate to related content
- Integrated into dashboard header

### 3. Notification Types
- ⏰ Class Starting Soon (15 min before)
- ✅ Homework Graded
- 💬 New Comment
- ⚠️ Homework Due Soon (24 hours before)
- 📝 Homework Assigned
- 📎 Material Uploaded
- 📬 Submission Received

## 🔧 Setup Required

### Step 1: Run the Migration
Run the SQL migration in Supabase SQL Editor:
```bash
supabase/add-notifications-system.sql
```

### Step 2: Set Up Cron Jobs (Scheduled Notifications)
You need to set up cron jobs to call the scheduled notification functions. There are two options:

#### Option A: Supabase Edge Functions (Recommended)
Create Edge Functions that call the scheduled notification functions:

1. Create `supabase/functions/notify-class-starting/index.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase.rpc('create_class_starting_notifications')
  
  return new Response(
    JSON.stringify({ count: data, error }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

2. Create `supabase/functions/notify-homework-due/index.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase.rpc('create_homework_due_notifications')
  
  return new Response(
    JSON.stringify({ count: data, error }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

3. Set up cron jobs in Supabase Dashboard:
   - Go to Database > Cron Jobs
   - Add job for class starting: `*/5 * * * *` (every 5 minutes)
   - Add job for homework due: `0 9 * * *` (daily at 9 AM)

#### Option B: External Cron Service
Use a service like GitHub Actions, Vercel Cron, or cron-job.org to call your API endpoints:

1. Create API routes in your Next.js app:
```typescript
// app/api/cron/class-starting/route.ts
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase.rpc('create_class_starting_notifications')
  
  return Response.json({ count: data, error })
}
```

2. Set up cron jobs to call these endpoints with the secret token

## 📝 Testing the System

### Test Automatic Notifications
1. Create a homework assignment → Students get notified
2. Student submits homework → Teacher gets notified
3. Teacher grades homework → Student gets notified
4. Add a comment on submission → Submission owner gets notified
5. Upload material to a session → Students get notified

### Test Scheduled Notifications
Call the functions manually in Supabase SQL Editor:
```sql
-- Test class starting notifications
SELECT create_class_starting_notifications();

-- Test homework due notifications
SELECT create_homework_due_notifications();
```

### Verify Notifications
```sql
-- Check recent notifications
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;

-- Check unread count for a user
SELECT COUNT(*) FROM notifications 
WHERE user_id = 'USER_ID' AND is_read = FALSE;
```

## 🎯 Next Steps (Optional Enhancements)

1. **Real-time Updates**: Use Supabase Realtime to push notifications instantly instead of polling
2. **Email Notifications**: Send email for important notifications
3. **Push Notifications**: Add browser push notifications
4. **Notification Preferences**: Let users customize which notifications they receive
5. **Notification History Page**: Create a dedicated page to view all notifications

## 🔍 Troubleshooting

### Notifications not appearing?
- Check if the migration ran successfully
- Verify RLS policies allow reading notifications
- Check browser console for errors
- Verify user is authenticated

### Triggers not firing?
- Check if the trigger functions exist: `\df notify_*` in psql
- Verify the triggers are attached to tables: `\d+ homework_grades`
- Check Supabase logs for errors

### Scheduled notifications not working?
- Verify cron jobs are set up and running
- Check function execution logs
- Manually call the functions to test
