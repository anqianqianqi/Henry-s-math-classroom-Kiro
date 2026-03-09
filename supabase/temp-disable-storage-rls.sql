-- =====================================================
-- TEMPORARY: Disable RLS on Storage Buckets for Testing
-- =====================================================
-- WARNING: This is for development/testing only!
-- Re-enable with proper policies before production.

-- Make session-materials bucket public for testing
UPDATE storage.buckets 
SET public = true 
WHERE id = 'session-materials';

-- Make homework-submissions bucket public for testing
UPDATE storage.buckets 
SET public = true 
WHERE id = 'homework-submissions';

-- Drop all existing policies on session-materials
DROP POLICY IF EXISTS "Allow authenticated uploads to session-materials" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated downloads from session-materials" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from session-materials" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads from session-materials" ON storage.objects;

-- Drop all existing policies on homework-submissions
DROP POLICY IF EXISTS "Allow authenticated uploads to homework-submissions" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated downloads from homework-submissions" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from homework-submissions" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads from homework-submissions" ON storage.objects;

-- Create simple public access policies for testing
CREATE POLICY "Public access to session-materials"
ON storage.objects FOR ALL
USING (bucket_id = 'session-materials');

CREATE POLICY "Public access to homework-submissions"
ON storage.objects FOR ALL
USING (bucket_id = 'homework-submissions');

-- Verify buckets
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('session-materials', 'homework-submissions');

\echo '✅ Storage bucket RLS temporarily disabled for testing'
\echo '⚠️  Remember to add proper RLS policies before production!'
