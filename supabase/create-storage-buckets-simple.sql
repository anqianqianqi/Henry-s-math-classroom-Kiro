-- Create Storage Buckets for Materials and Submissions
-- Run this in Supabase SQL Editor

-- Note: Storage buckets cannot be created via SQL in Supabase
-- You must create them manually in the Supabase Dashboard

-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard
-- 2. Click "Storage" in the left sidebar
-- 3. Click "New bucket" button
-- 4. Create bucket: "session-materials"
--    - Name: session-materials
--    - Public: YES (check the box)
--    - File size limit: 52428800 (50MB in bytes)
--    - Allowed MIME types: Leave empty for all types
-- 5. Click "Create bucket"
-- 6. Repeat for "homework-submissions"
--    - Name: homework-submissions
--    - Public: YES (check the box)
--    - File size limit: 52428800 (50MB in bytes)
--    - Allowed MIME types: Leave empty for all types
-- 7. Click "Create bucket"

-- After creating buckets, verify they exist:
SELECT 
  id,
  name,
  public,
  file_size_limit,
  created_at
FROM storage.buckets
WHERE name IN ('session-materials', 'homework-submissions');

-- If buckets exist, you should see 2 rows
-- If you see 0 rows, the buckets haven't been created yet
