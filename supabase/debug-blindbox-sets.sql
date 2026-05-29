-- Run this in Supabase SQL editor to verify blindbox_sets is set up correctly

-- 1. Check table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'blindbox_sets';

-- 2. Check columns on blindbox_images include set_id
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'blindbox_images' AND column_name = 'set_id';

-- 3. Check columns on blindbox_claims include set_id
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'blindbox_claims' AND column_name = 'set_id';

-- 4. Check RLS policies on blindbox_sets
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'blindbox_sets';

-- 5. Check existing sets (should be empty if none created yet)
SELECT * FROM blindbox_sets LIMIT 10;
