-- Add hint_image_url column to support picture hints
ALTER TABLE daily_challenges ADD COLUMN IF NOT EXISTS hint_image_url TEXT;
ALTER TABLE challenge_bank    ADD COLUMN IF NOT EXISTS hint_image_url TEXT;
