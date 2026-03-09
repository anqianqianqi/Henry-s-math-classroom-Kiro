# Storage Download Fix - March 9, 2026

## Problem
- File uploads succeeded but downloads failed with "Bucket not found" error (404)
- Issue: Storage buckets had restrictive RLS policies blocking access

## Solution Applied

### 1. Updated Download Function
**File**: `lib/utils/materials.ts`

Improved `downloadMaterial()` function with:
- Better path extraction from URLs
- Fallback to direct fetch if storage API fails
- Handles both public and private bucket configurations
- More robust error handling

### 2. Created Storage Access Fix Script
**File**: `supabase/fix-storage-access.sql`

This script:
- Makes buckets public (required for `getPublicUrl()`)
- Removes restrictive policies
- Adds permissive policies for authenticated users
- Allows public read access for downloads

## How to Fix

### Step 1: Run the SQL Script
```bash
# Connect to your Supabase database and run:
psql -h <your-db-host> -U postgres -d postgres -f supabase/fix-storage-access.sql
```

Or copy/paste the contents of `supabase/fix-storage-access.sql` into your Supabase SQL Editor.

### Step 2: Verify Bucket Configuration
After running the script, check:
1. Go to Supabase Dashboard → Storage
2. Verify both buckets show as "Public"
3. Check policies show authenticated users can upload/view/delete

### Step 3: Test Upload and Download
1. Login as teacher/admin: admin@test.com / 123456
2. Navigate to Algebra 1 class
3. Click on any upcoming session
4. Upload a test file (PDF, image, or document)
5. Verify file appears in materials list
6. Click download button - file should download successfully

## What Changed

### Before
- Buckets were private with restrictive RLS
- `getPublicUrl()` returned URLs that weren't accessible
- Download function couldn't access files

### After
- Buckets are public
- Authenticated users can upload/view/delete
- Public users can view (read-only)
- Download function has fallback to direct fetch

## Production Considerations

For production, you should:
1. Keep buckets public (required for `getPublicUrl()`)
2. Add more restrictive policies based on class membership:
   - Teachers can upload/delete materials for their classes
   - Students can only view materials for classes they're enrolled in
   - Admins have full access

Example production policy:
```sql
CREATE POLICY "Teachers can manage their class materials"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'session-materials' AND
  EXISTS (
    SELECT 1 FROM classes c
    WHERE c.created_by = auth.uid()
    AND (storage.foldername(name))[1] = c.id::text
  )
);
```

## Troubleshooting

If downloads still fail:

1. **Check browser console** for detailed error messages
2. **Verify bucket exists**: 
   ```sql
   SELECT * FROM storage.buckets WHERE id = 'session-materials';
   ```
3. **Check file was uploaded**:
   ```sql
   SELECT * FROM storage.objects WHERE bucket_id = 'session-materials' LIMIT 5;
   ```
4. **Test public URL directly**: Copy the file_url from database and paste in browser
5. **Check CORS settings**: Ensure Supabase allows requests from localhost:3000

## Files Modified
- ✅ `lib/utils/materials.ts` - Improved download function
- ✅ `supabase/fix-storage-access.sql` - Storage configuration script
- ✅ `supabase/temp-disable-storage-rls.sql` - Alternative simple fix

## Next Steps
1. Run the SQL script
2. Test upload/download workflow
3. If working, proceed to test homework submission uploads
4. Once all working, add proper production RLS policies
