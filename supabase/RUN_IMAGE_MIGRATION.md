# Run Image Upload Migration

To enable image uploads for challenges, run this SQL in your Supabase SQL Editor:

## Steps:

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `add-challenge-images.sql`
4. Click "Run"

## What it does:

1. Adds `image_url` column to `daily_challenges` table
2. Creates `challenge-images` storage bucket (public read)
3. Sets up RLS policies for storage:
   - Authenticated users can upload to their own folder
   - Authenticated users can update/delete their own images
   - Anyone can view images (public read)

## Testing:

After running the migration:

1. Login as teacher (anqiluo@amazon.com)
2. Go to Create Challenge or Edit Challenge
3. Upload an image (PNG, JPG, GIF up to 5MB)
4. Save the challenge
5. View the challenge - image should display above description
6. Students should also see the image when viewing the challenge

## File Structure:

Images are stored as:
```
challenge-images/
  {user_id}/
    {challenge_id}.{ext}
```

This ensures:
- Each user can only manage their own images
- Images are organized by creator
- Easy to find and manage
