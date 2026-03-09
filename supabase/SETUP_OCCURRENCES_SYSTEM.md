# Class Occurrences & Materials System - Setup Guide

## Overview
This guide walks you through setting up the complete learning management system for Henry's Math Classroom.

## Prerequisites
- Supabase project is running
- You have access to Supabase SQL Editor
- You have access to Supabase Dashboard (for storage buckets)

## Step 1: Run Database Migration

1. Open Supabase SQL Editor
2. Copy the contents of `supabase/add-class-occurrences-system.sql`
3. Paste and run the entire script
4. Verify no errors occurred

**What this does:**
- Creates 5 new tables (class_occurrences, session_materials, homework_assignments, homework_submissions, homework_grades)
- Adds 14 new permissions
- Assigns permissions to teacher, student, and administrator roles
- Enables RLS on all new tables
- Creates RLS policies for data access control

**Verification:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('class_occurrences', 'session_materials', 'homework_assignments', 'homework_submissions', 'homework_grades');

-- Should return 5 rows
```

## Step 2: Create Storage Buckets

### Create session-materials bucket

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Configure:
   - **Name**: `session-materials`
   - **Public**: NO (uncheck)
   - **File size limit**: 52428800 (50MB)
   - **Allowed MIME types**: 
     ```
     application/pdf
     application/msword
     application/vnd.openxmlformats-officedocument.wordprocessingml.document
     application/vnd.ms-powerpoint
     application/vnd.openxmlformats-officedocument.presentationml.presentation
     image/*
     video/*
     ```
4. Click "Create bucket"

### Create homework-submissions bucket

1. Click "New bucket" again
2. Configure:
   - **Name**: `homework-submissions`
   - **Public**: NO (uncheck)
   - **File size limit**: 52428800 (50MB)
   - **Allowed MIME types**:
     ```
     application/pdf
     application/msword
     application/vnd.openxmlformats-officedocument.wordprocessingml.document
     image/*
     text/plain
     ```
3. Click "Create bucket"

**Verification:**
- You should see both buckets listed in Storage
- Both should show "Private" status

## Step 3: Set Up Storage Policies

1. Open Supabase SQL Editor
2. Copy the contents of `supabase/setup-storage-buckets.sql`
3. Paste and run the entire script
4. Verify no errors occurred

**What this does:**
- Creates RLS policies for session-materials bucket (teachers upload, class members read)
- Creates RLS policies for homework-submissions bucket (students upload their own, teachers read all)

**Verification:**
```sql
-- Check storage policies exist
SELECT policyname FROM pg_policies 
WHERE tablename = 'objects' 
AND (policyname LIKE '%session%' OR policyname LIKE '%homework%');

-- Should return 10 rows (5 for each bucket)
```

## Step 4: Test the Setup

### Test 1: Verify Permissions

```sql
-- Check teacher has correct permissions
SELECT p.name 
FROM permissions p
JOIN role_permissions rp ON p.id = rp.permission_id
JOIN roles r ON rp.role_id = r.id
WHERE r.name = 'teacher'
AND p.resource IN ('occurrence', 'material', 'homework', 'submission', 'grade')
ORDER BY p.name;

-- Should return 11 permissions
```

### Test 2: Create Test Occurrence

```sql
-- Get a test class ID (replace with your actual class ID)
SELECT id, name FROM classes LIMIT 1;

-- Create a test occurrence
INSERT INTO class_occurrences (
  class_id,
  occurrence_date,
  start_time,
  end_time,
  session_number,
  topic,
  status
) VALUES (
  'YOUR_CLASS_ID_HERE',
  '2026-03-10',
  '15:00',
  '16:00',
  1,
  'Introduction to Algebra',
  'upcoming'
);

-- Verify it was created
SELECT * FROM class_occurrences ORDER BY created_at DESC LIMIT 1;
```

### Test 3: Test RLS Policies

```sql
-- This should work (reading your own class occurrences)
-- Run as a teacher who owns the class
SELECT * FROM class_occurrences WHERE class_id = 'YOUR_CLASS_ID';

-- This should return empty (reading another teacher's occurrences)
-- Run as a different user
SELECT * FROM class_occurrences WHERE class_id = 'ANOTHER_CLASS_ID';
```

## Step 5: Clean Up Test Data (Optional)

```sql
-- Remove test occurrence if you created one
DELETE FROM class_occurrences WHERE topic = 'Introduction to Algebra';
```

## Troubleshooting

### Error: "permission denied for table class_occurrences"
- **Cause**: RLS policies not set up correctly
- **Fix**: Re-run the migration script, ensure you're logged in as a user with class membership

### Error: "bucket not found"
- **Cause**: Storage buckets not created
- **Fix**: Go to Supabase Dashboard → Storage and create the buckets manually

### Error: "violates foreign key constraint"
- **Cause**: Trying to create occurrence for non-existent class
- **Fix**: Use a valid class_id from your classes table

### Storage upload fails
- **Cause**: Storage policies not set up or user doesn't have permission
- **Fix**: 
  1. Verify buckets exist
  2. Run setup-storage-buckets.sql
  3. Ensure user has teacher role for the class

## Next Steps

After setup is complete:

1. ✅ Database tables created
2. ✅ Storage buckets created
3. ✅ Permissions configured
4. ✅ RLS policies active

**Ready to implement:**
- Occurrence generation algorithm
- Material upload/download functions
- React components for UI

See `IMPLEMENTATION_PLAN.md` for next steps.

## Rollback (If Needed)

If you need to undo this migration:

```sql
-- Drop tables (CASCADE removes all dependent objects)
DROP TABLE IF EXISTS homework_grades CASCADE;
DROP TABLE IF EXISTS homework_submissions CASCADE;
DROP TABLE IF EXISTS homework_assignments CASCADE;
DROP TABLE IF EXISTS session_materials CASCADE;
DROP TABLE IF EXISTS class_occurrences CASCADE;

-- Remove permissions
DELETE FROM permissions WHERE resource IN ('occurrence', 'material', 'homework', 'submission', 'grade');

-- Note: Storage buckets must be deleted manually from Dashboard
```

## Support

If you encounter issues:
1. Check Supabase logs for detailed error messages
2. Verify your user has the correct role assignments
3. Test RLS policies with different user accounts
4. Review the design document for expected behavior
