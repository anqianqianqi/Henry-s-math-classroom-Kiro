-- Add missing columns to pet_room_backgrounds for the admin manage flow
-- Run this in your Supabase SQL editor

ALTER TABLE pet_room_backgrounds
  ADD COLUMN IF NOT EXISTS prompt TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'admin_only',
  ADD COLUMN IF NOT EXISTS shop_item_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;
