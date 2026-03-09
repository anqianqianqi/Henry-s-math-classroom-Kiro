# Manual Storage Bucket Creation Guide

## What are Storage Buckets?

Storage buckets are like folders in the cloud where you store files. Think of them like:
- Google Drive folders
- Dropbox folders
- AWS S3 buckets

In our case, we need 2 buckets:
1. **session-materials** - For class materials (PDFs, slides, etc.)
2. **homework-submissions** - For student homework files

## Why Can't We Create Them with SQL?

Supabase storage buckets are managed separately from the database. They must be created through:
- Supabase Dashboard (easiest)
- Supabase API (programmatic)
- Supabase CLI (command line)

## Option 1: Use the Script (Recommended)

We created a Node.js script that does this automatically:

```bash
# Make sure you have Node.js installed
node supabase/create-storage-buckets.js
```

**Requirements:**
- Your `.env.local` file must have:
  - `NEXT_PUBLIC_SUPABASE_URL` (your Supabase project URL)
  - `SUPABASE_SERVICE_ROLE_KEY` (service role key, NOT anon key)

**Where to find these:**
1. Go to Supabase Dashboard
2. Click on your project
3. Go to Settings → API
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - service_role key (under "Project API keys") → `SUPABASE_SERVICE_ROLE_KEY`

## Option 2: Manual Creation (Step-by-Step)

### Step 1: Access Supabase Dashboard

1. Go to https://supabase.com
2. Sign in to your account
3. Select your project (Henry's Math Classroom)

### Step 2: Navigate to Storage

1. In the left sidebar, click **Storage**
2. You'll see a list of existing buckets (you might already have `class-covers` and `avatars`)

### Step 3: Create session-materials Bucket

1. Click the **"New bucket"** button (top right)
2. Fill in the form:

   **Bucket name:** `session-materials`
   
   **Public bucket:** ❌ UNCHECK (keep it private)
   
   **File size limit:** `52428800` (this is 50MB in bytes)
   
   **Allowed MIME types:** (click "Add MIME type" for each)
   ```
   application/pdf
   application/msword
   application/vnd.openxmlformats-officedocument.wordprocessingml.document
   application/vnd.ms-powerpoint
   application/vnd.openxmlformats-officedocument.presentationml.presentation
   image/*
   video/*
   ```

3. Click **"Create bucket"**

### Step 4: Create homework-submissions Bucket

1. Click **"New bucket"** again
2. Fill in the form:

   **Bucket name:** `homework-submissions`
   
   **Public bucket:** ❌ UNCHECK (keep it private)
   
   **File size limit:** `52428800` (50MB)
   
   **Allowed MIME types:**
   ```
   application/pdf
   application/msword
   application/vnd.openxmlformats-officedocument.wordprocessingml.document
   image/*
   text/plain
   ```

3. Click **"Create bucket"**

### Step 5: Verify Buckets Created

You should now see both buckets in the Storage page:
- ✅ session-materials (Private)
- ✅ homework-submissions (Private)

## What These Buckets Are For

### session-materials
**Purpose:** Store class materials uploaded by teachers

**File structure:**
```
session-materials/
  {class_id}/
    {occurrence_id}/
      lecture-notes.pdf
      slides.pptx
      homework-worksheet.docx
```

**Who can access:**
- Teachers: Upload, update, delete
- Students: Download only (if enrolled in class)

### homework-submissions
**Purpose:** Store homework files submitted by students

**File structure:**
```
homework-submissions/
  {assignment_id}/
    {student_id}/
      v1_homework.pdf
      v2_homework.pdf  (if resubmitted)
```

**Who can access:**
- Students: Upload their own submissions only
- Teachers: View all submissions for their classes

## After Creating Buckets

Once both buckets are created, you need to set up access policies:

```bash
# Run this SQL in Supabase SQL Editor
# File: supabase/setup-storage-buckets.sql
```

This creates the security rules that control who can upload/download files.

## Troubleshooting

### "Bucket name already exists"
- Good news! The bucket is already created
- Just verify it has the correct settings (private, 50MB limit)

### "Permission denied"
- Make sure you're logged in as the project owner
- Check that you're in the correct project

### "Invalid MIME type"
- Copy the MIME types exactly as shown above
- Use `image/*` and `video/*` for wildcards (not `image/all`)

### Can't find Storage in sidebar
- Make sure you're in the project dashboard (not organization settings)
- Storage should be between "Database" and "Edge Functions"

## Verification

After creating buckets, verify they work:

1. Go to Storage in Dashboard
2. Click on `session-materials`
3. Try uploading a test PDF file
4. If it uploads successfully, the bucket is working!
5. Delete the test file

## Next Steps

After buckets are created:

1. ✅ Buckets created
2. ⏭️ Run `supabase/setup-storage-buckets.sql` (set up access policies)
3. ⏭️ Test file upload from your app
4. ⏭️ Continue to Phase 2 (Occurrence Generation)

## Need Help?

If you're stuck:
1. Check Supabase documentation: https://supabase.com/docs/guides/storage
2. Verify your project URL and service role key are correct
3. Make sure you have owner/admin access to the project
4. Try the automated script instead of manual creation

## Summary

**What we're creating:**
- 2 storage buckets (like cloud folders)
- Private (not publicly accessible)
- 50MB file size limit
- Specific file types allowed

**Why:**
- Store class materials (PDFs, slides, videos)
- Store student homework submissions
- Secure file access with RLS policies

**How long:**
- Manual: 5-10 minutes
- Script: 1 minute

Choose whichever method you're more comfortable with!
