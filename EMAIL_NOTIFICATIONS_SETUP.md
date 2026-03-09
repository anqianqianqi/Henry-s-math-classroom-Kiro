# Email Notifications Setup Guide

## Overview
The notification system now includes user preferences for both in-app and email notifications. Users can customize which notifications they want to receive through each channel.

## What's Been Implemented

### 1. Database Schema ✅
**File**: `supabase/add-notification-preferences.sql`

- `notification_preferences` table with:
  - Individual toggles for each notification type (email + in-app)
  - Master email enable/disable switch
  - Default: all notifications enabled
  
- `notification_emails` queue table:
  - Stores pending emails to be sent
  - Tracks sent/failed status
  - Includes error messages for debugging

- Helper functions:
  - `get_user_notification_preferences()` - Get or create user preferences
  - `should_send_email()` - Check if user wants email for notification type
  - `should_send_inapp()` - Check if user wants in-app notification
  - `queue_notification_email()` - Add email to send queue

### 2. UI Components ✅
**Files**: 
- `components/NotificationPreferences.tsx` - Preferences management UI
- `app/settings/page.tsx` - Settings page

Features:
- Master email toggle (enable/disable all email notifications)
- Individual toggles for each notification type (in-app + email)
- Quick actions: Enable/disable all email or in-app notifications
- Visual table showing all notification types with descriptions
- Save/reset functionality
- Success/error messages

### 3. Integration ✅
- Added settings icon (⚙️) to dashboard header
- Links to `/settings` page
- Preferences are checked before creating notifications
- Email queue system ready for email service integration

## Notification Preferences

Users can customize these notification types:

| Type | Default | Description |
|------|---------|-------------|
| Class Starting | ✅ | 15 minutes before class |
| Homework Graded | ✅ | When grade is published |
| New Comment | ✅ | Comment on submission |
| Homework Due Soon | ✅ | 24 hours before due |
| Homework Assigned | ✅ | New homework created |
| Material Uploaded | ✅ | New materials available |
| Submission Received | ✅ | Student submits (teachers) |

Each type can be toggled independently for:
- 🔔 In-app notifications (bell icon)
- 📧 Email notifications

## Setup Steps

### Step 1: Run the Migration
Run in Supabase SQL Editor:
```sql
-- File: supabase/add-notification-preferences.sql
```

This creates:
- `notification_preferences` table
- `notification_emails` queue table
- Helper functions
- Updated trigger functions

### Step 2: Choose Email Service

You need to integrate an email service to actually send the emails. Here are your options:

#### Option A: Supabase Auth Email (Simplest)
Pros: Already configured, no extra setup
Cons: Limited customization, basic templates

```typescript
// In your Edge Function or API route
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Get pending emails
const { data: emails } = await supabase
  .from('notification_emails')
  .select('*')
  .eq('status', 'pending')
  .limit(10)

// Send via Supabase Auth (limited - mainly for auth emails)
// Not recommended for notification emails
```

#### Option B: Resend (Recommended)
Pros: Modern API, great DX, generous free tier
Cons: Requires API key

```bash
npm install resend
```

```typescript
// app/api/send-notification-emails/route.ts
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get pending emails
  const { data: emails } = await supabase
    .from('notification_emails')
    .select('*')
    .eq('status', 'pending')
    .limit(50)

  if (!emails || emails.length === 0) {
    return Response.json({ sent: 0 })
  }

  let sentCount = 0
  let failedCount = 0

  for (const email of emails) {
    try {
      await resend.emails.send({
        from: 'Henry\'s Math Classroom <notifications@yourdomain.com>',
        to: email.email_address,
        subject: email.subject,
        text: email.body
      })

      // Mark as sent
      await supabase
        .from('notification_emails')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        })
        .eq('id', email.id)

      sentCount++
    } catch (error) {
      // Mark as failed
      await supabase
        .from('notification_emails')
        .update({ 
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', email.id)

      failedCount++
    }
  }

  return Response.json({ sent: sentCount, failed: failedCount })
}
```

#### Option C: SendGrid
Pros: Reliable, scalable, good free tier
Cons: More complex setup

```bash
npm install @sendgrid/mail
```

```typescript
import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

await sgMail.send({
  to: email.email_address,
  from: 'notifications@yourdomain.com',
  subject: email.subject,
  text: email.body
})
```

#### Option D: AWS SES
Pros: Very cheap, highly scalable
Cons: More complex setup, requires AWS account

### Step 3: Set Up Cron Job

Schedule the email sending function to run regularly:

**Vercel Cron** (vercel.json):
```json
{
  "crons": [{
    "path": "/api/send-notification-emails",
    "schedule": "*/5 * * * *"
  }]
}
```

**GitHub Actions** (.github/workflows/send-emails.yml):
```yaml
name: Send Notification Emails
on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  send:
    runs-on: ubuntu-latest
    steps:
      - name: Send emails
        run: |
          curl -X POST https://yourapp.com/api/send-notification-emails \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

**External Service** (cron-job.org, EasyCron, etc.):
- Create job to call your API endpoint every 5 minutes
- Include authorization header with CRON_SECRET

### Step 4: Environment Variables

Add to `.env.local`:
```bash
# Email Service (choose one)
RESEND_API_KEY=re_xxxxx
# or
SENDGRID_API_KEY=SG.xxxxx
# or
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx

# Cron Security
CRON_SECRET=your-random-secret-here
```

## Testing

### Test Preferences UI
1. Go to dashboard
2. Click settings icon (⚙️)
3. Toggle notification preferences
4. Click "Save Preferences"
5. Verify preferences are saved (reload page)

### Test Email Queue
```sql
-- Check pending emails
SELECT * FROM notification_emails 
WHERE status = 'pending' 
ORDER BY created_at DESC;

-- Manually trigger a notification to test
-- (e.g., grade a homework, add a comment)

-- Check if email was queued
SELECT * FROM notification_emails 
ORDER BY created_at DESC 
LIMIT 5;
```

### Test Email Sending
```bash
# Call your API endpoint manually
curl -X POST http://localhost:3000/api/send-notification-emails \
  -H "Authorization: Bearer your-cron-secret"
```

### Test User Preferences
```sql
-- Check user preferences
SELECT * FROM notification_preferences WHERE user_id = 'USER_ID';

-- Test preference functions
SELECT should_send_email('USER_ID', 'homework_graded');
SELECT should_send_inapp('USER_ID', 'homework_graded');
```

## Email Templates (Optional Enhancement)

For better-looking emails, create HTML templates:

```typescript
// lib/email-templates.ts
export function getEmailTemplate(type: string, data: any): string {
  const templates = {
    homework_graded: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">✅ Homework Graded</h2>
        <p>Your homework "${data.title}" has been graded!</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 24px; margin: 0;"><strong>${data.points}</strong> points</p>
        </div>
        ${data.feedback ? `<p><strong>Feedback:</strong> ${data.feedback}</p>` : ''}
        <a href="${data.link}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
          View Details
        </a>
      </div>
    `,
    // Add more templates...
  }
  
  return templates[type] || data.message
}
```

## Troubleshooting

### Emails not being queued?
- Check if migration ran successfully
- Verify trigger functions are working
- Check `notification_emails` table for entries
- Look at Supabase logs for errors

### Emails queued but not sent?
- Verify email service API key is correct
- Check cron job is running
- Look at `status` and `error_message` in `notification_emails`
- Test API endpoint manually

### User preferences not saving?
- Check RLS policies on `notification_preferences`
- Verify user is authenticated
- Check browser console for errors
- Test with Supabase SQL Editor

## Next Steps

1. **Run migrations** in Supabase SQL Editor
2. **Choose email service** (Resend recommended)
3. **Create API endpoint** for sending emails
4. **Set up cron job** to call endpoint every 5 minutes
5. **Test thoroughly** with real notifications
6. **Monitor email queue** for failed sends
7. **Optional**: Add HTML email templates for better design

## Files Changed
- ✅ `supabase/add-notification-preferences.sql` (new)
- ✅ `components/NotificationPreferences.tsx` (new)
- ✅ `app/settings/page.tsx` (new)
- ✅ `app/dashboard/page.tsx` (modified - added settings link)
- ✅ `EMAIL_NOTIFICATIONS_SETUP.md` (new)
