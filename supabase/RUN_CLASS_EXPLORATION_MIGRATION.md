# Run Class Exploration Migration

## Step 1: Run the Migration

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy the contents of `supabase/add-class-exploration.sql`
4. Paste into the SQL Editor
5. Click "Run" to execute the migration

## Step 2: Verify Tables Were Created

Run this query to verify:

```sql
-- Check new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('trial_requests', 'notifications');

-- Check new columns were added to classes
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'classes' 
  AND column_name IN ('is_public', 'cover_image_url', 'age_range', 'skill_level');

-- Check administrator role was created
SELECT name, description FROM roles WHERE name = 'administrator';

-- Check admin permissions were created
SELECT name, resource, action 
FROM permissions 
WHERE resource IN ('trial_requests', 'notifications', 'system');
```

## Step 3: Assign Administrator Role to Test User

Replace `YOUR_USER_EMAIL` with the email of the user you want to make an administrator:

```sql
-- Get the user's profile ID
SELECT id, email FROM profiles WHERE email = 'YOUR_USER_EMAIL';

-- Assign administrator role (replace USER_ID with the ID from above)
INSERT INTO user_roles (user_id, role_id, class_id)
SELECT 'USER_ID', r.id, NULL
FROM roles r
WHERE r.name = 'administrator'
ON CONFLICT DO NOTHING;

-- Verify the role was assigned
SELECT p.email, r.name as role
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE p.email = 'YOUR_USER_EMAIL';
```

## Step 4: Test RLS Policies

```sql
-- Test that trial_requests table has RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'trial_requests';

-- Test that notifications table has RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'notifications';

-- List all policies on trial_requests
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'trial_requests';

-- List all policies on notifications
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'notifications';
```

## Expected Results

After running the migration successfully, you should see:
- ✅ `trial_requests` table created with 14 columns
- ✅ `notifications` table created with 7 columns
- ✅ `classes` table has 17 new columns
- ✅ `administrator` role exists
- ✅ 6 admin permissions created
- ✅ RLS enabled on both new tables
- ✅ 7 RLS policies created (5 for trial_requests, 3 for notifications, 1 for classes)

## Next Steps

Once the migration is complete and verified:
1. Assign administrator role to your test user (e.g., anqiluo@amazon.com)
2. Move to Phase 2: Update Class Creation/Edit Forms
