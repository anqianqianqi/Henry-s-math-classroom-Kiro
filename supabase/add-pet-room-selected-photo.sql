-- Add selected_photo_url to user_pet_room so users can choose which blindbox
-- image to display in their room frame, independently of which room is selected.
ALTER TABLE user_pet_room
  ADD COLUMN IF NOT EXISTS selected_photo_url TEXT;
