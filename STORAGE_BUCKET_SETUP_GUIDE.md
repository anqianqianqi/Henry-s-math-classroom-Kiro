# Storage Bucket Setup Guide

## Why You Can't Upload Materials

The material upload feature requires Supabase Storage buckets to be created. These buckets store the uploaded files. Without them, the upload will fail.

## Quick Fix - Create Storage Buckets

### Option 1: Manual Creation (Recommended - 2 minutes)

1. **Go to Supabase Dashboard**
   - Open your Supabase project dashboard
   - URL: https://supabase.com/dashboard/project/YOUR_PROJECT_ID

2. **Navigate to Storage**
   - Click "Storage" in the left sidebar
   - You'll see a list of existing buckets (if any)

3. **Create First Bucket: session-materials**
   - Click the "New bucket" button (top right)
   - Fill in the form:
     - **Name**: `session-materials`
     - **Public bucket**: ✅ Check this box (files need to be downloadable)
     - **File size limit**: `52428800` (50MB in bytes)
     - **Allowed MIME types**: Leave empty (allows all file types)
   - Click "Create bucket"

4. **Create Second Bucket: homework-submissions**
   - Click "New bucket" again
   - Fill in the form:
     - **Name**: `homework-submissions`
     - **Public bucket**: ✅ Check this box
     - **File size limit**: `52428800` (50MB in bytes)
     - **Allowed MIME types**: Leave empty
   - Click "Create bucket"

5. **Verify Buckets Were Created**
   - You should see both buckets in the Storage list
   - Click on each bucket to confirm it's empty (no files yet)

### Option 2: Using Supabase CLI (Advanced)

If you have Supabase CLI installed:

```bash
# Create session-materials bucket
supabase storage create session-materials --public

# Create homework-submissions bucket
supabase storage create homework-submissions --public
```

### Option 3: Verify via SQL

Run this query in Supabase SQL Editor to check if buckets exist:

```sql
SELECT 
  id,
  name,
  public,
  file_size_limit,
  created_at
FROM storage.buckets
WHERE name IN ('session-materials', 'homework-submissions');
```

**Expected Result**: 2 rows (one for each bucket)
**If you see 0 rows**: Buckets haven't been created yet

## After Creating Buckets

### Test Material Upload

1. **Refresh your browser** (important!)
2. **Navigate to a class** (e.g., Algebra 1 - Spring 2026)
3. **Click on any session**
4. **Click "Upload Material" button**
5. **Try uploading a file**:
   - Drag and drop a PDF or image
   - Fill in the title
   - Click "Upload"
6. **You should see**:
   - Upload progress bar
   - Success message
   - File appears in materials list

### If Upload Still Fails

Check browser console (F12) for errors:

**Common Errors**:

1. **"Bucket not found"**
   - Solution: Buckets weren't created, go back to step 1

2. **"Row Level Security policy violation"**
   - Solution: Run `supabase/temp-disable-occurrences-rls.sql` to disable RLS temporarily
   - Or check that you're logged in as admin/teacher

3. **"File size exceeds limit"**
   - Solution: File is larger than 50MB, try a smaller file

4. **"Invalid file type"**
   - Solution: Check MaterialUpload component's ALLOWED_TYPES array

## Storage Bucket Configuration

### session-materials Bucket

**Purpose**: Store class materials uploaded by teachers

**Structure**:
```
session-materials/
  {class_id}/
    {occurrence_id}/
      {timestamp}-{filename}
```

**Example**:
```
session-materials/
  e0d4c18c-b2fa-48f3-b617-7746d7a17f00/
    200b7fe3-f590-4091-ae40-31e6c450c6d1/
      1709876543-lecture-slides.pdf
```

**Settings**:
- Public: Yes (students need to download)
- Size limit: 50MB
- Allowed types: All (PDF, DOC, PPT, images, videos)

### homework-submissions Bucket

**Purpose**: Store homework files submitted by students

**Structure**:
```
homework-submissions/
  {assignment_id}/
    {student_id}/
      v{version}_{timestamp}-{filename}
```

**Example**:
```
homework-submissions/
  a1b2c3d4-5678-90ab-cdef-1234567890ab/
    student-uuid-here/
      v1_1709876543-homework.pdf
      v2_1709876789-homework-revised.pdf
```

**Settings**:
- Public: Yes (teachers need to view)
- Size limit: 50MB
- Allowed types: All

## Security Notes

### Current Setup (Temporary)
- RLS is disabled for testing
- Anyone can upload/download files
- This is OK for development

### Production Setup (Future)
- Enable RLS policies
- Restrict uploads to teachers/admins
- Restrict downloads to class members
- Add file scanning for malware
- Add audit logging

## Troubleshooting

### Problem: "Upload Material" button doesn't appear

**Possible Causes**:
1. Not logged in as teacher/admin
2. Role detection failed
3. Component not rendering

**Solutions**:
1. Check you're logged in as admin or class creator
2. Check browser console for errors
3. Refresh the page

### Problem: Upload button appears but upload fails

**Possible Causes**:
1. Storage buckets don't exist
2. RLS policies blocking upload
3. File too large
4. Network error

**Solutions**:
1. Create storage buckets (see above)
2. Disable RLS temporarily
3. Try smaller file (< 50MB)
4. Check network connection

### Problem: Upload succeeds but file doesn't appear

**Possible Causes**:
1. Database insert failed
2. RLS blocking read
3. Component not refreshing

**Solutions**:
1. Check browser console for errors
2. Disable RLS temporarily
3. Refresh the page manually

## Next Steps After Setup

Once storage buckets are created:

1. ✅ Test material upload
2. ✅ Test material download
3. ✅ Test homework creation
4. ✅ Test homework submission
5. ✅ Test grading interface
6. ✅ Re-enable RLS policies
7. ✅ Test with different user roles

## Quick Verification Checklist

- [ ] Logged into Supabase Dashboard
- [ ] Navigated to Storage section
- [ ] Created "session-materials" bucket (public)
- [ ] Created "homework-submissions" bucket (public)
- [ ] Verified both buckets appear in list
- [ ] Refreshed browser
- [ ] Tested upload as admin/teacher
- [ ] Upload succeeded
- [ ] File appears in materials list
- [ ] Download works

## Support

If you're still having issues:

1. Check browser console (F12 → Console tab)
2. Check Supabase logs (Dashboard → Logs)
3. Verify buckets exist (run SQL query above)
4. Verify you're logged in as admin/teacher
5. Try with a small test file (< 1MB)

---

**Estimated Time**: 2-5 minutes
**Difficulty**: Easy
**Required Access**: Supabase Dashboard access
