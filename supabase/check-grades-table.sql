-- Check if homework_grades table exists and its structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'homework_grades'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'homework_grades'
  AND schemaname = 'public';

-- Check if table exists at all
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'homework_grades'
) as table_exists;
