# Class Exploration Setup Guide

## What We've Done

### 1. Database Migration Created ✅
- Created `supabase/add-class-exploration.sql` with:
  - `trial_requests` table for trial class requests
  - `notifications` table for in-app notifications
  - 17 new columns added to `classes` table for marketing/discovery
  - Administrator role and permissions
  - RLS policies for all new tables
  - Indexes for performance
  - Helper functions and triggers

### 2. Storage Bucket Created ✅
- Created `supabase/create-class-covers-bucket.sql` for class cover images
- Includes RLS policies for secure image uploads

### 3. Class Forms Updated ✅
- Updated `app/classes/new/page.tsx` (Create Class)
- Updated `app/classes/[id]/edit/page.tsx` (Edit Class)
- Both forms now include:
  - Public/Private toggle
  - Cover image upload
  - Target audience description
  - Age/grade range
  - Skill level (beginner/intermediate/advanced)
  - Prerequisites
  - Syllabus/curriculum
  - Learning objectives (array)
  - Materials provided
  - Homework expectations
  - Teacher bio
  - Teaching style
  - Max students
  - Price
  - Location

## Next Steps to Complete Phase 1

### Step 1: Run Database Migrations

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Run `supabase/add-class-exploration.sql`
4. Run `supabase/create-class-covers-bucket.sql`
5. Verify tables and bucket were created

### Step 2: Assign Administrator Role

```sql
-- Replace with your email
INSERT INTO user_roles (user_id, role_id, class_id)
SELECT p.id, r.id, NULL
FROM profiles p
CROSS JOIN roles r
WHERE p.email = 'anqiluo@amazon.com'
  AND r.name = 'administrator'
ON CONFLICT DO NOTHING;
```

### Step 3: Test the Forms

1. Start your dev server
2. Log in as a teacher
3. Create a new class
4. Toggle "Make this class public"
5. Fill in the new marketing fields
6. Upload a cover image
7. Save and verify data is stored correctly

### Step 4: Verify Database

```sql
-- Check that new columns exist
SELECT is_public, cover_image_url, age_range, skill_level, syllabus
FROM classes
WHERE id = 'YOUR_CLASS_ID';

-- Check that cover image was uploaded
SELECT * FROM storage.objects
WHERE bucket_id = 'class-covers';
```

## What's Next (Phase 2)

After Phase 1 is complete and tested, we'll move to Phase 2:

1. Create public class directory page (`/classes/explore`)
2. Build class card component for browsing
3. Implement filters (age, skill level, schedule, price)
4. Add search functionality
5. Create public class detail page (`/classes/[id]/public`)

## Files Modified

- `app/classes/new/page.tsx` - Added all new fields
- `app/classes/[id]/edit/page.tsx` - Added all new fields
- `supabase/add-class-exploration.sql` - Database migration
- `supabase/create-class-covers-bucket.sql` - Storage bucket
- `supabase/RUN_CLASS_EXPLORATION_MIGRATION.md` - Migration instructions
- `supabase/CLASS_EXPLORATION_SETUP.md` - This file

## Testing Checklist

- [ ] Database migration runs without errors
- [ ] Storage bucket created successfully
- [ ] Administrator role assigned
- [ ] Can create new class with public fields
- [ ] Can upload cover image
- [ ] Can edit existing class and add public fields
- [ ] Can toggle class between public/private
- [ ] All new fields save correctly to database
- [ ] Cover images display correctly
- [ ] Learning objectives array works
