-- =====================================================
-- Fix Storage Bucket Access for Materials and Homework
-- =====================================================

-- Step 1: Make buckets public (required for getPublicUrl to work)
UPDATE storage.buckets 
SET public = true 
WHERE id IN ('session-materials', 'homework-submissions');

-- Step 2: Drop any existing restrictive policies
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND policyname LIKE '%session-materials%'
           OR policyname LIKE '%homework-submissions%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- Step 3: Create permissive policies for authenticated users

-- Session Materials: Anyone authenticated can upload, view, and delete
CREATE POLICY "Authenticated users can upload session materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'session-materials');

CREATE POLICY "Authenticated users can view session materials"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'session-materials');

CREATE POLICY "Authenticated users can delete session materials"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'session-materials');

CREATE POLICY "Authenticated users can update session materials"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'session-materials');

-- Homework Submissions: Anyone authenticated can upload, view, and delete
CREATE POLICY "Authenticated users can upload homework submissions"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'homework-submissions');

CREATE POLICY "Authenticated users can view homework submissions"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'homework-submissions');

CREATE POLICY "Authenticated users can delete homework submissions"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'homework-submissions');

CREATE POLICY "Authenticated users can update homework submissions"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'homework-submissions');

-- Step 4: Also allow public read access (since buckets are public)
CREATE POLICY "Public can view session materials"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'session-materials');

CREATE POLICY "Public can view homework submissions"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'homework-submissions');

-- Verify configuration
SELECT 
    id,
    name,
    public,
    file_size_limit,
    COALESCE(array_length(allowed_mime_types, 1), 0) as mime_type_count
FROM storage.buckets
WHERE id IN ('session-materials', 'homework-submissions');

\echo ''
\echo '✅ Storage buckets configured:'
\echo '   - Buckets set to public'
\echo '   - Authenticated users can upload/view/delete'
\echo '   - Public users can view (read-only)'
\echo ''
\echo '📝 Note: For production, restrict policies based on class membership'
