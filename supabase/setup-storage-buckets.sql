-- ============================================
-- STORAGE BUCKETS SETUP
-- Create buckets for session materials and homework submissions
-- ============================================

-- IMPORTANT: This file contains SQL for storage bucket policies only.
-- Buckets must be created manually via Supabase Dashboard first!

-- ============================================
-- MANUAL STEPS (Do these in Supabase Dashboard)
-- ============================================

-- 1. Go to Storage in Supabase Dashboard
-- 2. Create bucket: session-materials
--    - Public: NO (private bucket)
--    - File size limit: 52428800 (50MB)
--    - Allowed MIME types: application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-powerpoint, application/vnd.openxmlformats-officedocument.presentationml.presentation, image/*, video/*
-- 3. Create bucket: homework-submissions
--    - Public: NO (private bucket)
--    - File size limit: 52428800 (50MB)
--    - Allowed MIME types: application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, image/*, text/plain

-- ============================================
-- STORAGE POLICIES - session-materials bucket
-- ============================================

-- Teachers can upload materials to their class folders
CREATE POLICY "Teachers can upload session materials"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'session-materials'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM classes
      WHERE user_has_permission(auth.uid(), 'material:upload', id)
    )
  );

-- Class members can read materials from their classes
CREATE POLICY "Class members can read session materials"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'session-materials'
    AND (storage.foldername(name))[1] IN (
      SELECT class_id::text FROM class_members
      WHERE user_id = auth.uid()
    )
  );

-- Teachers can update materials in their class folders
CREATE POLICY "Teachers can update session materials"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'session-materials'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM classes
      WHERE user_has_permission(auth.uid(), 'material:upload', id)
    )
  );

-- Teachers can delete materials from their class folders
CREATE POLICY "Teachers can delete session materials"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'session-materials'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM classes
      WHERE user_has_permission(auth.uid(), 'material:delete', id)
    )
  );

-- ============================================
-- STORAGE POLICIES - homework-submissions bucket
-- ============================================

-- Students can upload to their own submission folders
CREATE POLICY "Students can upload homework submissions"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'homework-submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Students can read their own submissions
CREATE POLICY "Students can read own homework submissions"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'homework-submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Teachers can read submissions for their class assignments
CREATE POLICY "Teachers can read homework submissions"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'homework-submissions'
    AND (storage.foldername(name))[1] IN (
      SELECT ha.id::text
      FROM homework_assignments ha
      JOIN class_occurrences co ON ha.occurrence_id = co.id
      WHERE user_has_permission(auth.uid(), 'submission:read_all', co.class_id)
    )
  );

-- Students can update their own submissions (for resubmission)
CREATE POLICY "Students can update own homework submissions"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'homework-submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Students can delete their own submissions
CREATE POLICY "Students can delete own homework submissions"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'homework-submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ============================================
-- VERIFICATION
-- ============================================

-- Check if policies were created:
-- SELECT policyname, tablename FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%session%' OR policyname LIKE '%homework%';
