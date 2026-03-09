-- Check user_roles table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_roles'
ORDER BY ordinal_position;

-- Show sample data
SELECT * FROM user_roles LIMIT 5;
