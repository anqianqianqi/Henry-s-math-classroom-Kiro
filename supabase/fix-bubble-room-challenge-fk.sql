-- Fix: bubble_room_questions.challenge_id currently has a FK to daily_challenges(id).
-- Bank challenges use challenge_bank IDs which don't exist in daily_challenges,
-- causing the FK to silently set challenge_id to NULL.
-- Drop the FK so any challenge UUID can be stored.
ALTER TABLE bubble_room_questions
  DROP CONSTRAINT IF EXISTS bubble_room_questions_challenge_id_fkey;
