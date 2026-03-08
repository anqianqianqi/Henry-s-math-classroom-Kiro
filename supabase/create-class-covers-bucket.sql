-- Create storage bucket for class cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('class-covers', 'class-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view public class covers
CREATE POLICY "Public class covers are viewable by anyone"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'class-covers');

-- Allow authenticated users to upload class covers
CREATE POLICY "Authenticated users can upload class covers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'class-covers' 
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to update their own class covers
CREATE POLICY "Users can update own class covers"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'class-covers'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their own class covers
CREATE POLICY "Users can delete own class covers"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'class-covers'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
