-- Add image_url to bubble room questions and responses.
-- Run this in the Supabase SQL editor.

-- 1. Add image_url columns (nullable — existing rows unaffected)
ALTER TABLE bubble_room_questions
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE bubble_room_responses
  ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Create the storage bucket for bubble room images
-- (Run this separately if the SQL editor doesn't support storage API,
--  or create via Supabase Dashboard → Storage → New bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('bubble-room-images', 'bubble-room-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS: any authenticated user can upload their own images
DROP POLICY IF EXISTS "bubble_room_images_insert" ON storage.objects;
CREATE POLICY "bubble_room_images_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'bubble-room-images'
    AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "bubble_room_images_select" ON storage.objects;
CREATE POLICY "bubble_room_images_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bubble-room-images');

DROP POLICY IF EXISTS "bubble_room_images_delete" ON storage.objects;
CREATE POLICY "bubble_room_images_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'bubble-room-images'
    AND auth.uid() IS NOT NULL
  );
