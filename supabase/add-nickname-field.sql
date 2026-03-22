-- Add nickname field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
