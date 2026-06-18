-- Add prompt column to pet_room_backgrounds so we can use it for iterative refinement
-- Run this in your Supabase SQL editor

ALTER TABLE pet_room_backgrounds
  ADD COLUMN IF NOT EXISTS prompt TEXT;
