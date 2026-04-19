-- Migration: Split full_name into first_name and last_name
-- Run this in Supabase SQL Editor

-- Step 1: Add new columns
ALTER TABLE profiles ADD COLUMN first_name TEXT;
ALTER TABLE profiles ADD COLUMN last_name TEXT;

-- Step 2: Migrate existing data (split on first space)
UPDATE profiles SET
  first_name = split_part(full_name, ' ', 1),
  last_name = CASE 
    WHEN position(' ' in full_name) > 0 
    THEN substring(full_name from position(' ' in full_name) + 1)
    ELSE ''
  END;

-- Step 3: Make columns NOT NULL now that data is populated
ALTER TABLE profiles ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN last_name SET NOT NULL;

-- Step 4: Drop old full_name and recreate as generated column
ALTER TABLE profiles DROP COLUMN full_name;
ALTER TABLE profiles ADD COLUMN full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED;
