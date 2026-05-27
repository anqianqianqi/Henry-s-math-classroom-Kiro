-- Create the shop-images storage bucket for shop item images
-- Run this in your Supabase SQL editor

INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow teachers to upload images
CREATE POLICY "shop_images_teacher_upload" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'shop-images'
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Allow anyone to read shop images (they're public)
CREATE POLICY "shop_images_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'shop-images');

-- Allow teachers to delete their own uploads
CREATE POLICY "shop_images_teacher_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'shop-images'
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );
