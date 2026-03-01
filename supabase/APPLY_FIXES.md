# Fix User Profile and Role Issues

## Problem
User `anqiluo@amazon.com` signed up but profile wasn't created in the database. This prevents role assignment and dashboard access.

## Solution
Run these SQL scripts in order in your Supabase SQL Editor:

### Step 1: Fix Existing User (Run First)
Open `supabase/fix-existing-user.sql` and run it in Supabase SQL Editor.

This will:
- Create the missing profile for anqiluo@amazon.com
- Assign teacher role to this user
- Verify the fix worked

### Step 2: Install Auto-Profile Creation Trigger (Run Second)
Open `supabase/fix-profile-creation.sql` and run it in Supabase SQL Editor.

This will:
- Install a trigger that automatically creates profiles for new signups
- Automatically assign student role to new users
- Prevent this issue from happening again

## How to Run SQL in Supabase

1. Go to https://supabase.com/dashboard
2. Select your project (thgaokonzsabpvhfbfdy)
3. Click "SQL Editor" in the left sidebar
4. Click "New Query"
5. Copy and paste the SQL from the file
6. Click "Run" or press Cmd/Ctrl + Enter

## Create Second Test Account

After running both scripts, create a second test account:

### Option A: Via Supabase Dashboard (Recommended - No Email Rate Limit)
1. Go to Authentication → Users
2. Click "Add User"
3. Fill in:
   - Email: `student@test.com`
   - Password: `password123`
   - Check "Auto Confirm User"
4. Click "Create User"
5. The trigger will automatically create profile and assign student role

### Option B: Via Signup Page (If rate limit cleared)
1. Go to http://localhost:3000/signup
2. Sign up with:
   - Full Name: Student Test
   - Email: student@test.com
   - Password: password123

## Verify Everything Works

After running the scripts, verify:

```sql
-- Check both users exist with profiles
SELECT p.email, p.full_name, r.name as role
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE p.email IN ('anqiluo@amazon.com', 'student@test.com')
AND ur.class_id IS NULL;
```

You should see:
- anqiluo@amazon.com with teacher role
- student@test.com with student role

## Test the Application

1. Login as teacher: anqiluo@amazon.com
   - Should see teacher dashboard with "Let's inspire some students today!"
   - Should be able to assign roles at /admin/roles

2. Login as student: student@test.com
   - Should see student dashboard with "Let's learn some math today!"
