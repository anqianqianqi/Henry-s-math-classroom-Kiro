# ⚠️ IMPORTANT: Run This Migration Now!

## The Problem
You're seeing this error:
```
Failed to save template: Could not find the table 'public.challenge_templates' in the schema cache
```

This means the database table doesn't exist yet. Let's fix it in 2 minutes.

---

## Quick Fix (2 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard at https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"** button

### Step 2: Copy the Migration SQL
Open this file in your editor:
```
supabase/add-challenge-templates.sql
```

Copy the ENTIRE contents (all 200+ lines).

### Step 3: Run the Migration
1. Paste the SQL into the Supabase SQL Editor
2. Click the green **"Run"** button (or press Cmd/Ctrl + Enter)
3. Wait for the success message: "Success. No rows returned"

### Step 4: Verify It Worked
In the same SQL Editor, run this quick check:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'challenge_templates';
```

You should see one row with `challenge_templates`. ✅

### Step 5: Test the Feature
1. Refresh your app in the browser
2. Go to any challenge detail page (e.g., `/challenges/[id]`)
3. Click **"Save as Template"** button
4. Enter a template name
5. Click Save
6. Success! No more errors! 🎉

## What This Migration Does

Creates the `challenge_templates` table with:
- Template storage (title, description, image)
- Public/private visibility
- Usage tracking
- RLS policies for security
- Helper functions for easy template management

## Troubleshooting

### Error: "relation already exists"
- Table already created, you're good to go!

### Error: "permission denied"
- Make sure you're using the SQL Editor in Supabase dashboard
- You need admin access

### Still getting errors?
- Check Supabase logs for details
- Make sure you copied the entire SQL file
- Try refreshing the page after running the migration

## After Migration

Once the migration is complete, you can:
- Save any challenge as a template
- View templates at `/challenges/templates`
- Use templates to create new challenges quickly
- Share templates publicly or keep them private
