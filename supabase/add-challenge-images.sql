-- Add image support to daily challenges

-- 1. Add image_url column to daily_challenges table
ALTER TABLE daily_challenges 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create storage bucket for challenge images
INSERT INTO storage.buckets (id, name, public)
VALUES ('challenge-images', 'challenge-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up storage policies for challenge images

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload challenge images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'challenge-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own images
CREATE POLICY "Users can update own challenge images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'challenge-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete own challenge images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'challenge-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all challenge images
CREATE POLICY "Anyone can view challenge images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'challenge-images');
