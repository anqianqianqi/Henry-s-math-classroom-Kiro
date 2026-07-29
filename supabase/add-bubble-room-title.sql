-- Add optional title field to bubble_room_questions.
-- Title is a short (≤120 char) label separate from the body text.
-- Nullable so existing rows are unaffected.
ALTER TABLE bubble_room_questions
  ADD COLUMN IF NOT EXISTS title text CHECK (char_length(title) <= 120);
