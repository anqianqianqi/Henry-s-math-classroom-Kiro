-- Add frame overlay support to pet_room_backgrounds
-- The frame_overlay_url is a full-size (1536x1024) PNG of a decorative picture
-- frame on a white background. Rendered on top of the room background using
-- CSS mix-blend-mode: multiply so the white pixels become transparent.
--
-- frame_slot stores the inner photo area as percentages:
-- { "x": 58, "y": 5, "w": 22, "h": 35 }
-- meaning the photo goes at 58% from left, 5% from top, 22% wide, 35% tall.
-- This is where the user's blindbox photo is clipped and placed.

ALTER TABLE pet_room_backgrounds
  ADD COLUMN IF NOT EXISTS frame_overlay_url TEXT,
  ADD COLUMN IF NOT EXISTS frame_slot JSONB;
